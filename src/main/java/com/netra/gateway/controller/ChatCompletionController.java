package com.netra.gateway.controller;

import com.netra.gateway.exception.GatewayException;
import com.netra.gateway.exception.InvalidRequestException;
import com.netra.gateway.exception.UpstreamException;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.service.AdmissionService;
import com.netra.gateway.service.AuditLogService;
import com.netra.gateway.service.CostCalculationService;
import com.netra.gateway.service.StreamingRelayService;
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

import java.math.BigDecimal;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
public class ChatCompletionController {

    private final TenantAuthService authService;
    private final AdmissionService admissionService;
    private final UpstreamClientService upstreamClientService;
    private final CostCalculationService costService;
    private final AuditLogService auditLogService;
    private final StreamingRelayService streamingRelayService;

    @PostMapping(value = "/chat/completions", produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public Object createChatCompletion(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader,
            @RequestBody(required = false) ChatCompletionRequest request,
            HttpServletResponse servletResponse
    ) {
        long startTime = System.currentTimeMillis();
        String requestId = "req_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String virtualKey = extractVirtualKey(authHeader);
        String requestedModel = request != null ? request.getModel() : null;
        boolean isStream = request != null && Boolean.TRUE.equals(request.getStream());

        Tenant tenant = null;
        try {
            // 1. Authenticate Virtual Key (Caffeine L1 + DB fallback)
            tenant = authService.authenticate(authHeader);
            virtualKey = tenant.getVirtualKey();

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

            // 5. Atomic Redis Lua Admission Check (Zero Over-Admission Guarantee)
            admissionService.checkAdmission(tenant, requestId);

            // 6. Handle Streaming vs Non-Streaming
            if (isStream) {
                return streamingRelayService.streamChatCompletion(requestId, tenant, request, target, startTime, servletResponse);
            } else {
                return handleNonStreamingCompletion(requestId, tenant, request, target, startTime);
            }
        } catch (GatewayException ex) {
            long latencyMs = System.currentTimeMillis() - startTime;
            recordRejectionAsync(requestId, virtualKey, requestedModel, ex.getErrorCode(), ex.getStatus().value(), latencyMs, isStream);
            throw ex;
        } catch (Exception ex) {
            long latencyMs = System.currentTimeMillis() - startTime;
            recordRejectionAsync(requestId, virtualKey, requestedModel, "internal_error", 500, latencyMs, isStream);
            throw ex;
        }
    }

    private ResponseEntity<ChatCompletionResponse> handleNonStreamingCompletion(
            String requestId,
            Tenant tenant,
            ChatCompletionRequest request,
            UpstreamClientService.ResolvedTarget target,
            long startTime
    ) {
        UpstreamClientService.UpstreamResult result;
        try {
            result = upstreamClientService.forwardNonStreaming(request, target);
        } catch (Exception e) {
            admissionService.rollbackAdmission(tenant.getVirtualKey(), requestId);
            throw e;
        }

        ChatCompletionResponse response = result.getResponse();
        if (response == null || result.getStatusCode() >= 400) {
            admissionService.rollbackAdmission(tenant.getVirtualKey(), requestId);
            throw new UpstreamException("Upstream provider returned status " + result.getStatusCode());
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

    private void recordRejectionAsync(
            String requestId,
            String virtualKey,
            String requestedModel,
            String errorType,
            int statusCode,
            long latencyMs,
            boolean isStream
    ) {
        Thread.ofVirtual().name("rejection-log-", 0).start(() -> {
            try {
                auditLogService.recordRejection(
                        requestId,
                        virtualKey,
                        requestedModel,
                        errorType,
                        statusCode,
                        latencyMs,
                        isStream
                );
            } catch (Exception e) {
                log.warn("Failed to record rejection log for [{}]: {}", requestId, e.getMessage());
            }
        });
    }

    private String extractVirtualKey(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String key = authHeader.substring(7).trim();
            if (!key.isEmpty()) {
                return key;
            }
        }
        return "unauthenticated";
    }
}
