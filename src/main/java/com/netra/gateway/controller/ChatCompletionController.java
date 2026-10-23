package com.netra.gateway.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.exception.InvalidRequestException;
import com.netra.gateway.exception.UpstreamException;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.service.AuditLogService;
import com.netra.gateway.service.CostCalculationService;
import com.netra.gateway.service.TenantAuthService;
import com.netra.gateway.service.UpstreamClientService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
public class ChatCompletionController {

    private final TenantAuthService authService;
    private final UpstreamClientService upstreamClientService;
    private final CostCalculationService costService;
    private final AuditLogService auditLogService;
    private final GatewayConfigProperties configProperties;
    private final ObjectMapper objectMapper;
    private final HttpClient streamingHttpClient;

    @PostMapping(value = "/chat/completions", produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public Object createChatCompletion(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader,
            @RequestBody(required = false) ChatCompletionRequest request,
            HttpServletResponse servletResponse
    ) {
        long startTime = System.currentTimeMillis();
        String requestId = "req_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        // 1. Authenticate Virtual Key
        Tenant tenant = authService.authenticate(authHeader);

        // 2. Validate Request Shape
        if (request == null) {
            throw new InvalidRequestException("Request body cannot be null");
        }
        if (request.getModel() == null || request.getModel().isBlank()) {
            throw new InvalidRequestException("Model field is required");
        }
        if (request.getMessages() == null || request.getMessages().isEmpty()) {
            throw new InvalidRequestException("Messages array cannot be empty");
        }

        // 3. Resolve Model Target / Alias (Validates existence; returns 404 if unknown)
        UpstreamClientService.ResolvedTarget target = upstreamClientService.resolveTarget(request.getModel());

        // 4. Enforce Model Allowlist (Returns 403 if not permitted for this key)
        authService.validateModelAllowed(tenant, request.getModel());

        // 5. Handle Streaming vs Non-Streaming
        if (Boolean.TRUE.equals(request.getStream())) {
            return handleStreamingCompletion(requestId, tenant, request, target, startTime, servletResponse);
        } else {
            return handleNonStreamingCompletion(requestId, tenant, request, target, startTime);
        }
    }

    private ResponseEntity<ChatCompletionResponse> handleNonStreamingCompletion(
            String requestId,
            Tenant tenant,
            ChatCompletionRequest request,
            UpstreamClientService.ResolvedTarget target,
            long startTime
    ) {
        // Forward to primary upstream provider
        UpstreamClientService.UpstreamResult result = upstreamClientService.forwardNonStreaming(request, target);
        ChatCompletionResponse response = result.getResponse();
        if (response == null) {
            throw new UpstreamException("Upstream provider returned an empty or invalid response");
        }
        long latencyMs = System.currentTimeMillis() - startTime;

        int promptTokens = response.getUsage() != null ? response.getUsage().getPromptTokens() : 0;
        int completionTokens = response.getUsage() != null ? response.getUsage().getCompletionTokens() : 0;

        // Compute Cost
        BigDecimal cost = costService.calculateCost(result.getResolvedModel(), promptTokens, completionTokens);
        String costFormatted = costService.formatCostHeader(cost);
        String providerHeader = result.getResolvedProvider() + "/" + result.getResolvedModel();
        String cacheHeader = "miss";
        String fallbackHeader = String.valueOf(result.isFallback());

        // Construct Headers (Canonical x-netra-*)
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-netra-provider", providerHeader);
        headers.set("x-netra-cache", cacheHeader);
        headers.set("x-netra-fallback", fallbackHeader);
        headers.set("x-netra-cost-usd", costFormatted);

        // Async audit log & monthly spend update
        recordAuditAndSpend(
                requestId,
                tenant.getVirtualKey(),
                request.getModel(),
                result.getResolvedProvider(),
                result.getResolvedModel(),
                "ok",
                200,
                promptTokens,
                completionTokens,
                cost,
                cacheHeader,
                result.isFallback(),
                null,
                0,
                latencyMs,
                false,
                null
        );

        return ResponseEntity.ok()
                .headers(headers)
                .body(response);
    }

    private ResponseBodyEmitter handleStreamingCompletion(
            String requestId,
            Tenant tenant,
            ChatCompletionRequest request,
            UpstreamClientService.ResolvedTarget target,
            long startTime,
            HttpServletResponse servletResponse
    ) {
        String providerHeader = target.providerName() + "/" + target.modelName();

        // Set response headers upfront
        servletResponse.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
        servletResponse.setCharacterEncoding("UTF-8");
        servletResponse.setHeader("Cache-Control", "no-cache");
        servletResponse.setHeader("Connection", "keep-alive");

        servletResponse.setHeader("x-netra-provider", providerHeader);
        servletResponse.setHeader("x-netra-cache", "miss");
        servletResponse.setHeader("x-netra-fallback", "false");

        ResponseBodyEmitter emitter = new ResponseBodyEmitter(60000L);

        GatewayConfigProperties.ProviderConfig providerConfig = configProperties.getProvider(target.providerName());
        if (providerConfig == null) {
            throw new UpstreamException("Provider '" + target.providerName() + "' not configured");
        }

        String targetUrl = providerConfig.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";

        ChatCompletionRequest upstreamPayload = ChatCompletionRequest.builder()
                .model(target.modelName())
                .messages(request.getMessages())
                .stream(true)
                .temperature(request.getTemperature())
                .maxTokens(request.getMaxTokens())
                .build();

        // Run unbuffered SSE pump on Virtual Thread
        Thread.ofVirtual().name("sse-relay-", 0).start(() -> {
            int promptTokens = 0;
            int completionTokens = 0;
            String status = "ok";
            int statusCode = 200;
            String errorType = null;

            try {
                String jsonBody = objectMapper.writeValueAsString(upstreamPayload);
                HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                        .uri(URI.create(targetUrl))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(30))
                        .POST(HttpRequest.BodyPublishers.ofString(jsonBody));

                if (providerConfig.getApiKey() != null && !providerConfig.getApiKey().isBlank()) {
                    reqBuilder.header("Authorization", "Bearer " + providerConfig.getApiKey());
                }

                HttpResponse<java.io.InputStream> resp = streamingHttpClient.send(
                        reqBuilder.build(),
                        HttpResponse.BodyHandlers.ofInputStream()
                );

                if (resp.statusCode() >= 400) {
                    status = "upstream_error";
                    statusCode = resp.statusCode();
                    errorType = "upstream_http_" + resp.statusCode();
                    emitter.completeWithError(new UpstreamException("Upstream stream error HTTP " + resp.statusCode()));
                    return;
                }

                try (BufferedReader reader = new BufferedReader(new InputStreamReader(resp.body(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        emitter.send(line + "\n\n");

                        if (line.startsWith("data: ") && !line.equals("data: [DONE]")) {
                            try {
                                JsonNode chunkNode = objectMapper.readTree(line.substring(6).trim());
                                if (chunkNode.has("usage") && !chunkNode.get("usage").isNull()) {
                                    JsonNode usageNode = chunkNode.get("usage");
                                    if (usageNode.has("prompt_tokens")) {
                                        promptTokens = usageNode.get("prompt_tokens").asInt();
                                    }
                                    if (usageNode.has("completion_tokens")) {
                                        completionTokens = usageNode.get("completion_tokens").asInt();
                                    }
                                }
                            } catch (Exception ignored) {
                            }
                        }
                    }
                }
                emitter.complete();
            } catch (Exception e) {
                log.error("Streaming error for request [{}]: {}", requestId, e.getMessage());
                status = "upstream_error";
                statusCode = 502;
                errorType = "stream_error";
                emitter.completeWithError(e);
            } finally {
                long latencyMs = System.currentTimeMillis() - startTime;
                BigDecimal cost = costService.calculateCost(target.modelName(), promptTokens, completionTokens);
                recordAuditAndSpend(
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
                        false,
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

    private void recordAuditAndSpend(
            String requestId,
            String virtualKey,
            String requestedModel,
            String resolvedProvider,
            String resolvedModel,
            String status,
            int statusCode,
            int promptTokens,
            int completionTokens,
            BigDecimal cost,
            String cache,
            boolean fallback,
            String routeReason,
            int retries,
            long latencyMs,
            boolean isStream,
            String errorType
    ) {
        Thread.ofVirtual().name("audit-log-", 0).start(() -> {
            try {
                auditLogService.recordAuditAndSpend(
                        requestId,
                        virtualKey,
                        requestedModel,
                        resolvedProvider,
                        resolvedModel,
                        status,
                        statusCode,
                        promptTokens,
                        completionTokens,
                        cost,
                        cache,
                        fallback,
                        routeReason,
                        retries,
                        latencyMs,
                        isStream,
                        errorType
                );
            } catch (Exception e) {
                log.error("Failed to persist request log for [{}]: {}", requestId, e.getMessage());
            }
        });
    }
}
