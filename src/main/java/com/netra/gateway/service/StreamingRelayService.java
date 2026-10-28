package com.netra.gateway.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.exception.InvalidRequestException;
import com.netra.gateway.exception.UpstreamException;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.model.dto.UsageInfo;
import com.netra.gateway.model.entity.Tenant;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Service managing high-throughput, unbuffered pass-through Server-Sent Events (SSE)
 * over Java 25 Virtual Threads with client disconnect detection, premature severance handling,
 * terminal token usage extraction, multi-provider failover, and micro-USD post-stream settlement.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StreamingRelayService {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final GatewayConfigProperties configProperties;
    private final CostCalculationService costService;
    private final AdmissionService admissionService;
    private final AuditLogService auditLogService;
    @org.springframework.context.annotation.Lazy
    private final SemanticCacheService semanticCacheService;

    // 120s timeout for deep reasoning and long-context streaming
    private static final long STREAM_TIMEOUT_MS = 120_000L;

    public StreamingRelayService(
            HttpClient httpClient,
            ObjectMapper objectMapper,
            GatewayConfigProperties configProperties,
            CostCalculationService costService,
            AdmissionService admissionService,
            AuditLogService auditLogService
    ) {
        this(httpClient, objectMapper, configProperties, costService, admissionService, auditLogService, null);
    }

    /**
     * Backward-compatible overload for single target streaming.
     */
    public ResponseBodyEmitter streamChatCompletion(
            String requestId,
            Tenant tenant,
            ChatCompletionRequest request,
            UpstreamClientService.ResolvedTarget target,
            long startTime,
            HttpServletResponse servletResponse
    ) {
        UpstreamClientService.CandidateChain chain = new UpstreamClientService.CandidateChain(
                request.getModel(), request.getModel(), target.routeReason(), List.of(target)
        );
        return streamChatCompletion(requestId, tenant, request, chain, startTime, servletResponse);
    }

    /**
     * Replays a cached completion response as Server-Sent Events (SSE).
     */
    public ResponseBodyEmitter replayCachedStream(
            String requestId,
            Tenant tenant,
            ChatCompletionRequest request,
            SemanticCacheService.CacheHitResult cacheHit,
            long startTime,
            HttpServletResponse servletResponse
    ) {
        String providerHeader = cacheHit.resolvedProvider() != null ? cacheHit.resolvedProvider() : "alpha/alpha-small";

        servletResponse.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
        servletResponse.setCharacterEncoding("UTF-8");
        servletResponse.setHeader("Cache-Control", "no-cache");
        servletResponse.setHeader("Connection", "keep-alive");
        servletResponse.setHeader("x-netra-provider", providerHeader);
        servletResponse.setHeader("x-netra-cache", "hit");
        servletResponse.setHeader("x-netra-fallback", "false");
        servletResponse.setHeader("x-netra-cost-usd", "0.000000");
        servletResponse.setHeader("x-netra-route-reason", "semantic_cache_hit");
        servletResponse.setHeader("x-netra-retries", "0");

        ResponseBodyEmitter emitter = new ResponseBodyEmitter(60_000L);

        Thread.ofVirtual().name("sse-cache-replay-" + requestId).start(() -> {
            try {
                ChatCompletionResponse resp = cacheHit.response();
                String content = "";
                if (resp.getChoices() != null && !resp.getChoices().isEmpty()) {
                    ChatMessage msg = resp.getChoices().get(0).getMessage();
                    if (msg != null && msg.getContent() != null) {
                        content = msg.getContent().toString();
                    }
                }

                String chunkId = "chatcmpl-" + requestId;
                String model = resp.getModel() != null ? resp.getModel() : request.getModel();

                // 1. Content delta chunks
                if (content != null && !content.isEmpty()) {
                    String[] tokens = content.split("(?<=\\s+)");
                    if (tokens.length == 0) {
                        tokens = new String[]{content};
                    }
                    for (String token : tokens) {
                        Map<String, Object> deltaChoice = new HashMap<>();
                        deltaChoice.put("index", 0);
                        deltaChoice.put("delta", Map.of("content", token));
                        deltaChoice.put("finish_reason", null);

                        Map<String, Object> deltaChunk = new HashMap<>();
                        deltaChunk.put("id", chunkId);
                        deltaChunk.put("object", "chat.completion.chunk");
                        deltaChunk.put("created", System.currentTimeMillis() / 1000);
                        deltaChunk.put("model", model);
                        deltaChunk.put("choices", List.of(deltaChoice));

                        emitter.send("data: " + objectMapper.writeValueAsString(deltaChunk) + "\n\n");
                    }
                } else {
                    Map<String, Object> deltaChoice = new HashMap<>();
                    deltaChoice.put("index", 0);
                    deltaChoice.put("delta", Map.of());
                    deltaChoice.put("finish_reason", null);

                    Map<String, Object> deltaChunk = new HashMap<>();
                    deltaChunk.put("id", chunkId);
                    deltaChunk.put("object", "chat.completion.chunk");
                    deltaChunk.put("created", System.currentTimeMillis() / 1000);
                    deltaChunk.put("model", model);
                    deltaChunk.put("choices", List.of(deltaChoice));

                    emitter.send("data: " + objectMapper.writeValueAsString(deltaChunk) + "\n\n");
                }

                // 2. Terminal usage chunk
                int promptTokens = resp.getUsage() != null ? resp.getUsage().getPromptTokens() : 0;
                int completionTokens = resp.getUsage() != null ? resp.getUsage().getCompletionTokens() : 0;
                int totalTokens = resp.getUsage() != null ? resp.getUsage().getTotalTokens() : promptTokens + completionTokens;

                Map<String, Object> terminalChunk = new HashMap<>();
                terminalChunk.put("id", chunkId);
                terminalChunk.put("object", "chat.completion.chunk");
                terminalChunk.put("created", System.currentTimeMillis() / 1000);
                terminalChunk.put("model", model);
                terminalChunk.put("choices", List.of(Map.of(
                        "index", 0,
                        "delta", Map.of(),
                        "finish_reason", "stop"
                )));
                terminalChunk.put("usage", Map.of(
                        "prompt_tokens", promptTokens,
                        "completion_tokens", completionTokens,
                        "total_tokens", totalTokens
                ));
                emitter.send("data: " + objectMapper.writeValueAsString(terminalChunk) + "\n\n");

                // 3. Sentinel [DONE]
                emitter.send("data: [DONE]\n\n");
                emitter.complete();

                long latencyMs = System.currentTimeMillis() - startTime;
                auditLogService.recordAuditAndSpend(
                        requestId,
                        tenant.getVirtualKey(),
                        request.getModel(),
                        providerHeader.contains("/") ? providerHeader.split("/")[0] : providerHeader,
                        model,
                        "cache_hit",
                        200,
                        promptTokens,
                        completionTokens,
                        BigDecimal.ZERO.setScale(6, RoundingMode.HALF_UP),
                        "hit",
                        false,
                        "semantic_cache_hit",
                        0,
                        latencyMs,
                        true,
                        null
                );
            } catch (Exception e) {
                log.warn("Error during SSE cache replay: {}", e.getMessage());
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    /**
     * Initiates unbuffered SSE streaming with multi-provider failover across the candidate chain.
     */
    public ResponseBodyEmitter streamChatCompletion(
            String requestId,
            Tenant tenant,
            ChatCompletionRequest request,
            UpstreamClientService.CandidateChain chain,
            long startTime,
            HttpServletResponse servletResponse
    ) {
        InputStream upstreamStream = null;
        UpstreamClientService.ResolvedTarget connectedTarget = null;
        int totalRetries = 0;

        // Multi-provider connection attempt with retries and failover
        for (int i = 0; i < chain.targets().size(); i++) {
            UpstreamClientService.ResolvedTarget candidate = chain.targets().get(i);
            GatewayConfigProperties.ProviderConfig providerConfig = configProperties.getProvider(candidate.providerName());
            if (providerConfig == null) {
                log.warn("Provider [{}] not configured in registry; skipping to next fallback", candidate.providerName());
                continue;
            }

            String base = providerConfig.getBaseUrl().replaceAll("/+$", "");
            String targetUrl = base.endsWith("/v1") ? base + "/chat/completions" : base + "/v1/chat/completions";

            ChatCompletionRequest upstreamPayload = ChatCompletionRequest.builder()
                    .model(candidate.modelName())
                    .messages(request.getMessages())
                    .stream(true)
                    .temperature(request.getTemperature())
                    .maxTokens(request.getMaxTokens())
                    .build();

            String jsonBody;
            try {
                jsonBody = objectMapper.writeValueAsString(upstreamPayload);
            } catch (Exception e) {
                admissionService.rollbackAdmission(tenant.getVirtualKey(), requestId);
                throw new InvalidRequestException("Failed to serialize request payload: " + e.getMessage());
            }

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(3))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody));

            if (providerConfig.getApiKey() != null && !providerConfig.getApiKey().isBlank()) {
                reqBuilder.header("Authorization", "Bearer " + providerConfig.getApiKey());
            }

            int maxAttempts = configProperties.getRetry().getMaxAttempts();
            long initialBackoff = configProperties.getRetry().getInitialBackoffMs();
            double multiplier = configProperties.getRetry().getBackoffMultiplier();

            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    HttpResponse<InputStream> resp = httpClient.send(
                            reqBuilder.build(),
                            HttpResponse.BodyHandlers.ofInputStream()
                    );

                    if (resp.statusCode() == 200) {
                        upstreamStream = resp.body();
                        connectedTarget = candidate;
                        break;
                    } else {
                        log.warn("Streaming attempt {}/{} to [{}] returned HTTP {}",
                                attempt, maxAttempts, candidate.providerName(), resp.statusCode());
                        if (attempt < maxAttempts || i < chain.targets().size() - 1) {
                            totalRetries++;
                        }
                        if (attempt < maxAttempts) {
                            sleepBackoff(initialBackoff, multiplier, attempt);
                        }
                    }
                } catch (Exception e) {
                    log.warn("Streaming attempt {}/{} to [{}] failed: {}",
                            attempt, maxAttempts, candidate.providerName(), e.getMessage());
                    if (attempt < maxAttempts || i < chain.targets().size() - 1) {
                        totalRetries++;
                    }
                    if (attempt < maxAttempts) {
                        sleepBackoff(initialBackoff, multiplier, attempt);
                    }
                }
            }

            if (upstreamStream != null) {
                break;
            }

            if (i < chain.targets().size() - 1) {
                UpstreamClientService.ResolvedTarget next = chain.targets().get(i + 1);
                log.info("Streaming target [{}/{}] failed. Failing over to [{}/{}]",
                        candidate.providerName(), candidate.modelName(), next.providerName(), next.modelName());
            }
        }

        if (upstreamStream == null || connectedTarget == null) {
            admissionService.rollbackAdmission(tenant.getVirtualKey(), requestId);
            throw new UpstreamException("All upstream providers exhausted for alias " + chain.requestedModel());
        }

        // Set Streaming Response Headers upfront before any chunks are flushed
        servletResponse.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
        servletResponse.setCharacterEncoding("UTF-8");
        servletResponse.setHeader("Cache-Control", "no-cache");
        servletResponse.setHeader("Connection", "keep-alive");
        servletResponse.setHeader("x-netra-provider", connectedTarget.providerName() + "/" + connectedTarget.modelName());
        servletResponse.setHeader("x-netra-cache", "miss");
        servletResponse.setHeader("x-netra-fallback", String.valueOf(connectedTarget.fallback()));
        if (connectedTarget.routeReason() != null) {
            servletResponse.setHeader("x-netra-route-reason", connectedTarget.routeReason());
        }
        servletResponse.setHeader("x-netra-retries", String.valueOf(totalRetries));

        ResponseBodyEmitter emitter = new ResponseBodyEmitter(STREAM_TIMEOUT_MS);
        AtomicBoolean clientDisconnected = new AtomicBoolean(false);

        // Register lifecycle callbacks to detect client disconnection
        emitter.onCompletion(() -> clientDisconnected.set(true));
        emitter.onTimeout(() -> {
            clientDisconnected.set(true);
            emitter.complete();
        });
        emitter.onError(ex -> clientDisconnected.set(true));

        final InputStream streamToPump = upstreamStream;
        final UpstreamClientService.ResolvedTarget targetSettlement = connectedTarget;
        final int retriesSettlement = totalRetries;

        // Launch unbuffered stream pump on dedicated Java 25 Virtual Thread
        Thread.ofVirtual().name("sse-relay-" + requestId).start(() -> {
            int promptTokens = 0;
            int completionTokens = 0;
            int inferredCompletionTokens = 0;
            StringBuilder fullContent = new StringBuilder();
            boolean sawDone = false;
            String status = "ok";
            int statusCode = 200;
            String errorType = null;

            try {
                // Read upstream chunks line-by-line with small 1KB buffer for zero-delay pass-through
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(streamToPump, StandardCharsets.UTF_8), 1024)) {
                    String line;
                    while (!clientDisconnected.get() && (line = reader.readLine()) != null) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty()) {
                            continue;
                        }

                        try {
                            emitter.send(trimmed + "\n\n");
                        } catch (Exception sendEx) {
                            clientDisconnected.set(true);
                            log.debug("Client disconnected mid-stream on [{}] (Broken pipe): {}", requestId, sendEx.getMessage());
                            break;
                        }

                        if ("data: [DONE]".equals(trimmed)) {
                            sawDone = true;
                            break;
                        }

                        if (trimmed.startsWith("data: ")) {
                            String jsonStr = trimmed.substring(6).trim();
                            if (!"[DONE]".equals(jsonStr)) {
                                try {
                                    JsonNode chunkNode = objectMapper.readTree(jsonStr);

                                    // Extract token usage if emitted in chunk
                                    if (chunkNode.has("usage") && !chunkNode.get("usage").isNull()) {
                                        JsonNode usageNode = chunkNode.get("usage");
                                        if (usageNode.has("prompt_tokens")) {
                                            promptTokens = usageNode.get("prompt_tokens").asInt();
                                        }
                                        if (usageNode.has("completion_tokens")) {
                                            completionTokens = usageNode.get("completion_tokens").asInt();
                                        }
                                    }

                                    // Count words in delta content for heuristic fallback
                                    if (chunkNode.has("choices") && chunkNode.get("choices").isArray()) {
                                        for (JsonNode choice : chunkNode.get("choices")) {
                                            if (choice.has("delta") && choice.get("delta").has("content")) {
                                                String deltaText = choice.get("delta").get("content").asText();
                                                fullContent.append(deltaText);
                                                inferredCompletionTokens += estimateTokenCount(deltaText);
                                            }
                                        }
                                    }
                                } catch (Exception parseEx) {
                                    log.trace("Non-fatal JSON parse error on stream chunk [{}]: {}", jsonStr, parseEx.getMessage());
                                }
                            }
                        }
                    }
                }

                // Handle stream outcome
                if (clientDisconnected.get()) {
                    status = "client_disconnected";
                } else if (!sawDone) {
                    status = "upstream_error";
                    statusCode = 502;
                    errorType = "stream_severed";
                    try {
                        emitter.send("data: {\"error\":{\"message\":\"Upstream provider disconnected mid-stream\",\"type\":\"upstream_error\",\"code\":\"stream_severed\"}}\n\n");
                    } catch (Exception ignored) {
                    }
                    emitter.completeWithError(new UpstreamException("Upstream stream severed prematurely"));
                } else {
                    emitter.complete();
                }

            } catch (Exception e) {
                if (clientDisconnected.get() || isClientAbort(e)) {
                    log.debug("Client closed stream for request [{}]: {}", requestId, e.getMessage());
                    status = "client_disconnected";
                } else {
                    log.error("Streaming error for request [{}]: {}", requestId, e.getMessage());
                    status = "upstream_error";
                    statusCode = 502;
                    errorType = "stream_error";
                    emitter.completeWithError(e);
                }
            } finally {
                // Ensure upstream socket is closed immediately to halt compute
                if (streamToPump != null) {
                    try {
                        streamToPump.close();
                    } catch (Exception ignored) {
                    }
                }

                // Fallback token estimations if upstream omitted usage block on served stream
                if ("ok".equals(status) || "client_disconnected".equals(status)) {
                    if (completionTokens == 0 && inferredCompletionTokens > 0) {
                        completionTokens = inferredCompletionTokens;
                    }
                    if (promptTokens == 0) {
                        promptTokens = estimatePromptTokens(request);
                    }
                } else {
                    if (completionTokens == 0) {
                        promptTokens = 0;
                    }
                }

                // If 0 tokens delivered and request was aborted/failed, restore rate limit slot
                if (completionTokens == 0 && !"ok".equals(status)) {
                    admissionService.rollbackAdmission(tenant.getVirtualKey(), requestId);
                }

                long latencyMs = System.currentTimeMillis() - startTime;
                String modelName = targetSettlement != null ? targetSettlement.modelName() : chain.requestedModel();
                String providerName = targetSettlement != null ? targetSettlement.providerName() : null;
                boolean fallbackFlag = targetSettlement != null && targetSettlement.fallback();
                String routeReason = targetSettlement != null ? targetSettlement.routeReason() : chain.routeReason();

                BigDecimal cost = (completionTokens > 0 || "ok".equals(status)) && targetSettlement != null
                        ? costService.calculateCost(targetSettlement.modelName(), promptTokens, completionTokens)
                        : BigDecimal.ZERO;

                // Post-stream financial settlement & audit logging
                auditLogService.recordAuditAndSpend(
                        requestId,
                        tenant.getVirtualKey(),
                        request.getModel(),
                        providerName,
                        modelName,
                        status,
                        statusCode,
                        promptTokens,
                        completionTokens,
                        cost,
                        "miss",
                        fallbackFlag,
                        routeReason,
                        retriesSettlement,
                        latencyMs,
                        true,
                        errorType
                );

                // Store successful stream response in semantic cache
                if (sawDone && "ok".equals(status) && fullContent.length() > 0 && semanticCacheService != null) {
                    try {
                        ChatCompletionResponse cachedResp = ChatCompletionResponse.builder()
                                .id("chatcmpl-" + requestId)
                                .object("chat.completion")
                                .created(System.currentTimeMillis() / 1000)
                                .model(modelName)
                                .choices(List.of(ChatCompletionResponse.Choice.builder()
                                        .index(0)
                                        .message(ChatMessage.builder()
                                                .role("assistant")
                                                .content(fullContent.toString())
                                                .build())
                                        .finishReason("stop")
                                        .build()))
                                .usage(UsageInfo.builder()
                                        .promptTokens(promptTokens)
                                        .completionTokens(completionTokens)
                                        .totalTokens(promptTokens + completionTokens)
                                        .build())
                                .build();
                        String cachedProviderHeader = (providerName != null ? providerName : "mock") + "/" + modelName;
                        semanticCacheService.store(tenant, request.getModel(), request.getMessages(), cachedResp, cachedProviderHeader);
                    } catch (Exception ex) {
                        log.warn("Failed to store stream completion in semantic cache: {}", ex.getMessage());
                    }
                }
            }
        });

        return emitter;
    }

    private int estimateTokenCount(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        return Math.max(1, text.trim().split("\\s+").length);
    }

    private int estimatePromptTokens(ChatCompletionRequest request) {
        if (request == null || request.getMessages() == null) {
            return 0;
        }
        int tokens = 0;
        for (ChatMessage msg : request.getMessages()) {
            if (msg.getContent() != null) {
                tokens += estimateTokenCount(msg.getContent().toString());
            }
        }
        return Math.max(1, tokens);
    }

    private boolean isClientAbort(Throwable t) {
        while (t != null) {
            if (t instanceof IOException) {
                String msg = t.getMessage();
                if (msg != null && (msg.contains("Broken pipe") || msg.contains("Connection reset") || msg.contains("ClosedByInterruptException"))) {
                    return true;
                }
            }
            t = t.getCause();
        }
        return false;
    }

    private void sleepBackoff(long initialBackoffMs, double multiplier, int attempt) {
        long delay = (long) (initialBackoffMs * Math.pow(multiplier, attempt - 1));
        try {
            Thread.sleep(Math.max(10, delay));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
