package com.netra.gateway.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
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
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Service managing high-throughput, unbuffered pass-through Server-Sent Events (SSE)
 * over Java 25 Virtual Threads with client disconnect detection, premature severance handling,
 * terminal token usage extraction, and micro-USD post-stream financial settlement.
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

    public ResponseBodyEmitter streamChatCompletion(
            String requestId,
            Tenant tenant,
            ChatCompletionRequest request,
            UpstreamClientService.ResolvedTarget target,
            long startTime,
            HttpServletResponse servletResponse
    ) {
        String providerHeader = target.providerName() + "/" + target.modelName();

        // 1. Set Streaming Response Headers upfront before any chunks are flushed
        servletResponse.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
        servletResponse.setCharacterEncoding("UTF-8");
        servletResponse.setHeader("Cache-Control", "no-cache");
        servletResponse.setHeader("Connection", "keep-alive");
        servletResponse.setHeader("x-netra-provider", providerHeader);
        servletResponse.setHeader("x-netra-cache", "miss");
        servletResponse.setHeader("x-netra-fallback", String.valueOf(target.fallback()));

        ResponseBodyEmitter emitter = new ResponseBodyEmitter(STREAM_TIMEOUT_MS);
        AtomicBoolean clientDisconnected = new AtomicBoolean(false);

        // 2. Register lifecycle callbacks to detect client disconnection
        emitter.onCompletion(() -> clientDisconnected.set(true));
        emitter.onTimeout(() -> {
            clientDisconnected.set(true);
            emitter.complete();
        });
        emitter.onError(ex -> clientDisconnected.set(true));

        GatewayConfigProperties.ProviderConfig providerConfig = configProperties.getProvider(target.providerName());
        if (providerConfig == null) {
            admissionService.rollbackAdmission(tenant.getVirtualKey(), requestId);
            throw new UpstreamException("Provider '" + target.providerName() + "' not configured in gateway registry");
        }

        String base = providerConfig.getBaseUrl().replaceAll("/+$", "");
        String targetUrl = base.endsWith("/v1") ? base + "/chat/completions" : base + "/v1/chat/completions";

        // 3. Launch unbuffered stream pump on dedicated Java 25 Virtual Thread
        Thread.ofVirtual().name("sse-relay-" + requestId).start(() -> {
            int promptTokens = 0;
            int completionTokens = 0;
            int inferredCompletionTokens = 0;
            boolean sawDone = false;
            String status = "ok";
            int statusCode = 200;
            String errorType = null;
            InputStream upstreamStream = null;

            try {
                ChatCompletionRequest upstreamPayload = ChatCompletionRequest.builder()
                        .model(target.modelName())
                        .messages(request.getMessages())
                        .stream(true)
                        .temperature(request.getTemperature())
                        .maxTokens(request.getMaxTokens())
                        .build();

                String jsonBody = objectMapper.writeValueAsString(upstreamPayload);
                HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                        .uri(URI.create(targetUrl))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(60))
                        .POST(HttpRequest.BodyPublishers.ofString(jsonBody));

                if (providerConfig.getApiKey() != null && !providerConfig.getApiKey().isBlank()) {
                    reqBuilder.header("Authorization", "Bearer " + providerConfig.getApiKey());
                }

                HttpResponse<InputStream> resp = httpClient.send(
                        reqBuilder.build(),
                        HttpResponse.BodyHandlers.ofInputStream()
                );

                if (resp.statusCode() >= 400) {
                    status = "upstream_error";
                    statusCode = resp.statusCode();
                    errorType = "upstream_http_" + resp.statusCode();
                    try {
                        emitter.send("data: {\"error\":{\"message\":\"Upstream provider returned status " + resp.statusCode() + "\",\"type\":\"upstream_error\",\"code\":\"upstream_error\"}}\n\n");
                    } catch (Exception ignored) {
                    }
                    emitter.completeWithError(new UpstreamException("Upstream stream error HTTP " + resp.statusCode()));
                    return;
                }

                upstreamStream = resp.body();

                // 4. Read upstream chunks line-by-line with small 1KB buffer for zero-delay pass-through
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(upstreamStream, StandardCharsets.UTF_8), 1024)) {
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
                            try {
                                JsonNode chunk = objectMapper.readTree(jsonStr);

                                // Extract terminal usage block if provided by upstream
                                if (chunk.has("usage") && !chunk.get("usage").isNull()) {
                                    JsonNode usage = chunk.get("usage");
                                    if (usage.has("prompt_tokens")) {
                                        promptTokens = usage.get("prompt_tokens").asInt();
                                    }
                                    if (usage.has("completion_tokens")) {
                                        completionTokens = usage.get("completion_tokens").asInt();
                                    }
                                }

                                // Accumulate delta content for fallback heuristic
                                if (chunk.has("choices") && chunk.get("choices").isArray() && !chunk.get("choices").isEmpty()) {
                                    JsonNode choice = chunk.get("choices").get(0);
                                    if (choice.has("delta") && choice.get("delta").has("content")) {
                                        String content = choice.get("delta").get("content").asText();
                                        inferredCompletionTokens += estimateTokenCount(content);
                                    }
                                }
                            } catch (Exception ignored) {
                            }
                        }
                    }
                }

                // 5. Handle stream outcome
                if (clientDisconnected.get()) {
                    status = "client_disconnected";
                } else if (!sawDone) {
                    // Upstream provider terminated prematurely without emitting data: [DONE]
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
                if (upstreamStream != null) {
                    try {
                        upstreamStream.close();
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
                    // For upstream errors where 0 completion tokens were delivered, do not charge prompt tokens
                    if (completionTokens == 0) {
                        promptTokens = 0;
                    }
                }

                // If 0 tokens delivered and request was aborted/failed, restore rate limit slot
                if (completionTokens == 0 && !"ok".equals(status)) {
                    admissionService.rollbackAdmission(tenant.getVirtualKey(), requestId);
                }

                long latencyMs = System.currentTimeMillis() - startTime;
                BigDecimal cost = (completionTokens > 0 || "ok".equals(status))
                        ? costService.calculateCost(target.modelName(), promptTokens, completionTokens)
                        : BigDecimal.ZERO;

                // 6. Post-stream financial settlement & audit logging
                auditLogService.recordAuditAndSpend(
                        requestId,
                        tenant.getVirtualKey(),
                        request.getModel(),
                        target.providerName(),
                        target.modelName(),
                        status,
                        statusCode,
                        promptTokens,
                        completionTokens,
                        cost,
                        "miss",
                        target.fallback(),
                        null,
                        0,
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
        String[] words = text.trim().split("\\s+");
        return Math.max(1, words.length);
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
        if (t == null) return false;
        String msg = t.getMessage();
        if (msg != null) {
            String lower = msg.toLowerCase();
            if (lower.contains("broken pipe") || lower.contains("connection reset") || lower.contains("closed by client")) {
                return true;
            }
        }
        return isClientAbort(t.getCause());
    }
}
