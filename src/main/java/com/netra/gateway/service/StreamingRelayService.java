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
public class StreamingRelayService {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final GatewayConfigProperties configProperties;
    private final CostCalculationService costService;
    private final AdmissionService admissionService;
    private final AuditLogService auditLogService;
    private final SemanticCacheService semanticCacheService;
    private final ProviderCircuitBreakerService circuitBreakerService;

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
        this(httpClient, objectMapper, configProperties, costService, admissionService, auditLogService, null, null);
    }

    public StreamingRelayService(
            HttpClient httpClient,
            ObjectMapper objectMapper,
            GatewayConfigProperties configProperties,
            CostCalculationService costService,
            AdmissionService admissionService,
            AuditLogService auditLogService,
            SemanticCacheService semanticCacheService
    ) {
        this(httpClient, objectMapper, configProperties, costService, admissionService, auditLogService, semanticCacheService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public StreamingRelayService(
            HttpClient httpClient,
            ObjectMapper objectMapper,
            GatewayConfigProperties configProperties,
            CostCalculationService costService,
            AdmissionService admissionService,
            AuditLogService auditLogService,
            @org.springframework.context.annotation.Lazy SemanticCacheService semanticCacheService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) ProviderCircuitBreakerService circuitBreakerService
    ) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.configProperties = configProperties;
        this.costService = costService;
        this.admissionService = admissionService;
        this.auditLogService = auditLogService;
        this.semanticCacheService = semanticCacheService;
        this.circuitBreakerService = circuitBreakerService;
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
        return replayCachedStream(requestId, tenant, request, cacheHit, startTime, servletResponse, null);
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
            HttpServletResponse servletResponse,
            AdmissionResult admission
    ) {
        String providerHeader = cacheHit.resolvedProvider() != null ? cacheHit.resolvedProvider() : "alpha/alpha-small";

        servletResponse.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
        servletResponse.setCharacterEncoding("UTF-8");
        servletResponse.setHeader("Cache-Control", "no-cache");
        servletResponse.setHeader("Connection", "keep-alive");
        servletResponse.setHeader("x-netra-provider", providerHeader);
        servletResponse.setHeader("x-netra-cache", "hit");
        servletResponse.setHeader("x-netra-cache-tier", cacheHit.cacheTier() != null ? cacheHit.cacheTier() : "tier2_semantic");
        servletResponse.setHeader("x-netra-fallback", "false");
        servletResponse.setHeader("x-netra-cost-usd", "0.000000");
        servletResponse.setHeader("x-netra-route-reason", "semantic_cache_hit");
        servletResponse.setHeader("x-netra-retries", "0");
        if (admission != null) {
            servletResponse.setHeader("RateLimit-Limit", String.valueOf(admission.limit()));
            servletResponse.setHeader("RateLimit-Remaining", String.valueOf(admission.remaining()));
            servletResponse.setHeader("RateLimit-Reset", String.valueOf(admission.resetSeconds()));
            servletResponse.setHeader("RateLimit-Policy", admission.policy() != null ? admission.policy() : (admission.limit() + ";w=60"));
        } else if (tenant.getRpmLimit() > 0) {
            servletResponse.setHeader("RateLimit-Limit", String.valueOf(tenant.getRpmLimit()));
            servletResponse.setHeader("RateLimit-Policy", tenant.getRpmLimit() + ";w=60");
        }

        ResponseBodyEmitter emitter = new ResponseBodyEmitter(60_000L);

        com.netra.gateway.context.RequestContext ctx = com.netra.gateway.context.RequestContext.get();
        Runnable replayTask = () -> {
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
                        null,
                        false,
                        cacheHit.cacheTier() != null ? cacheHit.cacheTier() : "tier2_semantic"
                );
            } catch (Exception e) {
                log.warn("Error during SSE cache replay: {}", e.getMessage());
                emitter.completeWithError(e);
            }
        };
        Thread.ofVirtual().name("sse-cache-replay-" + requestId).start(ctx != null ? ctx.wrap(replayTask) : replayTask);

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
        return streamChatCompletion(requestId, tenant, request, chain, startTime, servletResponse, null);
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
            HttpServletResponse servletResponse,
            AdmissionResult admission
    ) {
        InputStream upstreamStream = null;
        UpstreamClientService.ResolvedTarget connectedTarget = null;
        int totalRetries = 0;
        long chainStartTime = System.currentTimeMillis();
        long maxChainTimeoutMs = configProperties.getRetry().getMaxChainTimeoutMs();

        // Multi-provider connection attempt with retries and failover
        for (int i = 0; i < chain.targets().size(); i++) {
            UpstreamClientService.ResolvedTarget candidate = chain.targets().get(i);

            long elapsed = System.currentTimeMillis() - chainStartTime;
            if (elapsed >= maxChainTimeoutMs) {
                log.error("Streaming candidate chain deadline of {}ms exceeded (elapsed: {}ms) before target [{}]",
                        maxChainTimeoutMs, elapsed, candidate.providerName());
                break;
            }

            GatewayConfigProperties.ProviderConfig providerConfig = configProperties.getProvider(candidate.providerName());
            if (providerConfig == null && configProperties.getProvider("openrouter") != null) {
                providerConfig = configProperties.getProvider("openrouter");
            }
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
                long remChain = maxChainTimeoutMs - (System.currentTimeMillis() - chainStartTime);
                if (remChain <= 50) {
                    log.error("Streaming candidate chain deadline of {}ms exceeded before attempt {}/{} to target [{}]",
                            maxChainTimeoutMs, attempt, maxAttempts, candidate.providerName());
                    break;
                }

                // Resilience4j Circuit Breaker check: acquire exactly 1 permission per actual attempt
                if (circuitBreakerService != null && !circuitBreakerService.tryAcquirePermission(candidate.providerName())) {
                    log.warn("Fast-failing streaming attempt {}/{} to candidate [{}] because circuit breaker is OPEN",
                            attempt, maxAttempts, candidate.providerName());
                    totalRetries++;
                    break;
                }

                long startNanos = System.nanoTime();
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
                        // Close unconsumed upstream response stream to prevent connection leak
                        try {
                            if (resp.body() != null) {
                                resp.body().close();
                            }
                        } catch (Exception ignored) {}

                        boolean isRequestSpecific = resp.statusCode() == 400 || resp.statusCode() == 422;
                        boolean isThrottled = resp.statusCode() == 429;

                        // Request-specific errors (HTTP 400, 422) are deterministic client/request errors - do not retry or trip breaker
                        if (isRequestSpecific) {
                            throw new UpstreamException(resp.statusCode(), "Upstream provider '" + candidate.providerName() + "' returned HTTP " + resp.statusCode());
                        }

                        if (!isThrottled && circuitBreakerService != null) {
                            circuitBreakerService.recordError(candidate.providerName(), System.nanoTime() - startNanos, new UpstreamException(resp.statusCode(), "HTTP " + resp.statusCode()));
                        }
                        log.warn("Streaming attempt {}/{} to [{}] returned HTTP {}",
                                attempt, maxAttempts, candidate.providerName(), resp.statusCode());

                        // Provider throttling (HTTP 429) releases permit on every candidate/attempt and triggers immediate failover
                        if (isThrottled) {
                            if (circuitBreakerService != null) {
                                circuitBreakerService.releasePermission(candidate.providerName());
                            }
                            if (i < chain.targets().size() - 1) {
                                log.warn("Streaming provider [{}] throttled request (HTTP 429). Triggering immediate failover to next candidate in chain...", candidate.providerName());
                                totalRetries++;
                                break;
                            }
                        }

                        if (attempt < maxAttempts || i < chain.targets().size() - 1) {
                            totalRetries++;
                        }
                        if (attempt < maxAttempts) {
                            long rem = maxChainTimeoutMs - (System.currentTimeMillis() - chainStartTime);
                            if (rem <= 50) {
                                log.error("Streaming candidate chain deadline exceeded during backoff (elapsed: {}ms)",
                                        System.currentTimeMillis() - chainStartTime);
                                break;
                            }
                            // Cap backoff sleep to remaining budget
                            sleepBackoff(initialBackoff, multiplier, attempt, rem);
                        }
                    }
                } catch (UpstreamException ue) {
                    boolean isRequestSpecific = ue.isRequestSpecificError();
                    if (isRequestSpecific) {
                        if (circuitBreakerService != null) {
                            circuitBreakerService.releasePermission(candidate.providerName());
                        }
                        admissionService.rollbackAdmission(tenant.getVirtualKey(), requestId);
                        throw ue;
                    }
                    if (circuitBreakerService != null) {
                        circuitBreakerService.recordError(candidate.providerName(), System.nanoTime() - startNanos, ue);
                    }
                    log.warn("Streaming attempt {}/{} to [{}] failed (status {}): {}",
                            attempt, maxAttempts, candidate.providerName(), ue.getUpstreamStatusCode(), ue.getMessage());
                    if (attempt < maxAttempts || i < chain.targets().size() - 1) {
                        totalRetries++;
                    }
                    if (attempt < maxAttempts) {
                        long rem = maxChainTimeoutMs - (System.currentTimeMillis() - chainStartTime);
                        if (rem <= 50) {
                            log.error("Streaming candidate chain deadline exceeded during backoff (elapsed: {}ms)",
                                    System.currentTimeMillis() - chainStartTime);
                            break;
                        }
                        sleepBackoff(initialBackoff, multiplier, attempt, rem);
                    }
                } catch (Exception e) {
                    if (circuitBreakerService != null) {
                        circuitBreakerService.recordError(candidate.providerName(), System.nanoTime() - startNanos, e);
                    }
                    log.warn("Streaming attempt {}/{} to [{}] failed: {}",
                            attempt, maxAttempts, candidate.providerName(), e.getMessage());
                    if (attempt < maxAttempts || i < chain.targets().size() - 1) {
                        totalRetries++;
                    }
                    if (attempt < maxAttempts) {
                        long rem = maxChainTimeoutMs - (System.currentTimeMillis() - chainStartTime);
                        if (rem <= 50) {
                            log.error("Streaming candidate chain deadline exceeded during backoff (elapsed: {}ms)",
                                    System.currentTimeMillis() - chainStartTime);
                            break;
                        }
                        // Cap backoff sleep to remaining budget
                        sleepBackoff(initialBackoff, multiplier, attempt, rem);
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
        // Dynamic IETF RateLimit protocol headers from Redis token-bucket admission
        if (admission != null) {
            servletResponse.setHeader("RateLimit-Limit", String.valueOf(admission.limit()));
            servletResponse.setHeader("RateLimit-Remaining", String.valueOf(admission.remaining()));
            servletResponse.setHeader("RateLimit-Reset", String.valueOf(admission.resetSeconds()));
            servletResponse.setHeader("RateLimit-Policy", admission.policy() != null ? admission.policy() : (admission.limit() + ";w=60"));
        } else if (tenant.getRpmLimit() > 0) {
            servletResponse.setHeader("RateLimit-Limit", String.valueOf(tenant.getRpmLimit()));
            servletResponse.setHeader("RateLimit-Policy", tenant.getRpmLimit() + ";w=60");
        }

        ResponseBodyEmitter emitter = new ResponseBodyEmitter(STREAM_TIMEOUT_MS);
        AtomicBoolean clientDisconnected = new AtomicBoolean(false);
        AtomicBoolean permitHandled = new AtomicBoolean(false);

        final InputStream streamToPump = upstreamStream;
        final UpstreamClientService.ResolvedTarget targetSettlement = connectedTarget;
        final int retriesSettlement = totalRetries;

        Runnable releasePermitOnce = () -> {
            if (permitHandled.compareAndSet(false, true)) {
                if (circuitBreakerService != null && targetSettlement != null) {
                    circuitBreakerService.releasePermission(targetSettlement.providerName());
                }
            }
        };

        // Register lifecycle callbacks to detect client disconnection and release breaker permits promptly on timeout
        emitter.onCompletion(() -> clientDisconnected.set(true));
        emitter.onTimeout(() -> {
            clientDisconnected.set(true);
            try {
                if (streamToPump != null) {
                    streamToPump.close();
                }
            } catch (Exception ignored) {
            }
            releasePermitOnce.run();
            emitter.complete();
        });
        emitter.onError(ex -> {
            clientDisconnected.set(true);
            try {
                if (streamToPump != null) {
                    streamToPump.close();
                }
            } catch (Exception ignored) {
            }
            releasePermitOnce.run();
        });

        // Launch unbuffered stream pump on dedicated Java 25 Virtual Thread
        com.netra.gateway.context.RequestContext relayContext = com.netra.gateway.context.RequestContext.get();
        Runnable relayTask = () -> {
            long streamStartTimeNanos = System.nanoTime();
            long firstChunkLatencyNanos = 0;
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

                        if ("data: [DONE]".equals(trimmed) || "data:[DONE]".equals(trimmed) || trimmed.endsWith("[DONE]")) {
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

                                    // Count words in delta content and stop TTFT timer on the first non-empty output delta
                                    if (chunkNode.has("choices") && chunkNode.get("choices").isArray()) {
                                        for (JsonNode choice : chunkNode.get("choices")) {
                                            if (choice.has("delta")) {
                                                JsonNode deltaNode = choice.get("delta");
                                                boolean hasNonEmptyOutput = false;
                                                if (deltaNode.has("content") && !deltaNode.get("content").isNull()) {
                                                    String deltaText = deltaNode.get("content").asText();
                                                    if (!deltaText.isEmpty()) {
                                                        hasNonEmptyOutput = true;
                                                        fullContent.append(deltaText);
                                                        inferredCompletionTokens += estimateTokenCount(deltaText);
                                                    }
                                                }
                                                if (deltaNode.has("reasoning_content") && !deltaNode.get("reasoning_content").isNull()) {
                                                    String reasoningText = deltaNode.get("reasoning_content").asText();
                                                    if (!reasoningText.isEmpty()) {
                                                        hasNonEmptyOutput = true;
                                                        inferredCompletionTokens += estimateTokenCount(reasoningText);
                                                    }
                                                }
                                                if (deltaNode.has("tool_calls") && deltaNode.get("tool_calls").isArray() && !deltaNode.get("tool_calls").isEmpty()) {
                                                    for (JsonNode tc : deltaNode.get("tool_calls")) {
                                                        if (tc.has("function") && (tc.get("function").has("name") || tc.get("function").has("arguments"))) {
                                                            hasNonEmptyOutput = true;
                                                            break;
                                                        }
                                                    }
                                                }

                                                // Record TTFT at the first non-empty output delta (empty role headers do not count as output)
                                                if (hasNonEmptyOutput && firstChunkLatencyNanos == 0) {
                                                    firstChunkLatencyNanos = System.nanoTime() - streamStartTimeNanos;
                                                }
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
                    releasePermitOnce.run();
                } else if (!sawDone) {
                    status = "upstream_error";
                    statusCode = 502;
                    errorType = "stream_severed";
                    if (permitHandled.compareAndSet(false, true)) {
                        if (circuitBreakerService != null && targetSettlement != null) {
                            circuitBreakerService.recordError(targetSettlement.providerName(), System.nanoTime() - streamStartTimeNanos,
                                    new UpstreamException(502, "Upstream stream severed prematurely"));
                        }
                    }
                    try {
                        emitter.send("data: {\"error\":{\"message\":\"Upstream provider disconnected mid-stream\",\"type\":\"upstream_error\",\"code\":\"stream_severed\"}}\n\n");
                    } catch (Exception ignored) {
                    }
                    emitter.completeWithError(new UpstreamException("Upstream stream severed prematurely"));
                } else {
                    if (permitHandled.compareAndSet(false, true)) {
                        if (circuitBreakerService != null && targetSettlement != null) {
                            // Measure provider responsiveness (TTFT / wait for output) so long healthy streams do not breach 5s slow-call threshold
                            long waitDurationNanos = firstChunkLatencyNanos > 0
                                    ? firstChunkLatencyNanos
                                    : (System.nanoTime() - streamStartTimeNanos);
                            circuitBreakerService.recordSuccess(targetSettlement.providerName(), waitDurationNanos);
                        }
                    }
                    emitter.complete();
                }

            } catch (Exception e) {
                if (clientDisconnected.get() || isClientAbort(e)) {
                    log.debug("Client closed stream for request [{}]: {}", requestId, e.getMessage());
                    status = "client_disconnected";
                    releasePermitOnce.run();
                } else {
                    log.error("Streaming error for request [{}]: {}", requestId, e.getMessage());
                    status = "upstream_error";
                    statusCode = 502;
                    errorType = "stream_error";
                    if (permitHandled.compareAndSet(false, true)) {
                        if (circuitBreakerService != null && targetSettlement != null) {
                            circuitBreakerService.recordError(targetSettlement.providerName(), System.nanoTime() - streamStartTimeNanos, e);
                        }
                    }
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
                        ? costService.calculateCost(targetSettlement.accountingModel(), promptTokens, completionTokens)
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
        };
        Thread.ofVirtual().name("sse-relay-" + requestId).start(relayContext != null ? relayContext.wrap(relayTask) : relayTask);

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

    private void sleepBackoff(long initialBackoffMs, double multiplier, int attempt, long remainingBudgetMs) {
        long delay = (long) (initialBackoffMs * Math.pow(multiplier, attempt - 1));
        long effectiveSleep = Math.min(delay, remainingBudgetMs - 10);
        if (effectiveSleep > 0) {
            try {
                Thread.sleep(effectiveSleep);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
