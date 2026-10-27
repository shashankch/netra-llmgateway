package com.netra.gateway.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.exception.InvalidRequestException;
import com.netra.gateway.exception.UpstreamException;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatMessage;
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
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
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

    // 120s timeout for deep reasoning and long-context streaming
    private static final long STREAM_TIMEOUT_MS = 120_000L;

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
