package com.netra.gateway.controller;

import com.netra.gateway.context.RequestContext;
import com.netra.gateway.exception.GatewayException;
import com.netra.gateway.exception.InvalidRequestException;
import com.netra.gateway.exception.UpstreamException;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.service.AdmissionResult;
import com.netra.gateway.service.AdmissionService;
import com.netra.gateway.service.AuditLogService;
import com.netra.gateway.service.CostCalculationService;
import com.netra.gateway.service.RefusalEscalationService;
import com.netra.gateway.service.SemanticCacheService;
import com.netra.gateway.service.SemanticCacheService.CacheHitResult;
import com.netra.gateway.service.StreamingRelayService;
import com.netra.gateway.service.TenantAuthService;
import com.netra.gateway.service.UpstreamClientService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
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
    private final SemanticCacheService semanticCacheService;
    private final com.netra.gateway.telemetry.OpenTelemetryGenAiService oTelService;
    @Autowired(required = false)
    private RefusalEscalationService refusalEscalationService;

    @PostMapping(value = "/chat/completions", produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_EVENT_STREAM_VALUE})
    public Object createChatCompletion(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader,
            @RequestBody(required = false) ChatCompletionRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        long startTime = System.currentTimeMillis();
        String requestId = "req_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        if (servletRequest != null) {
            servletRequest.setAttribute(RequestContext.REQUEST_ID_ATTR, requestId);
        }
        String virtualKey = extractVirtualKey(authHeader);
        String requestedModel = request != null ? request.getModel() : null;
        boolean isStream = request != null && Boolean.TRUE.equals(request.getStream());

        com.netra.gateway.telemetry.W3cTraceContext traceContext = oTelService != null
                ? oTelService.extractOrCreateTraceContext(servletRequest)
                : com.netra.gateway.telemetry.W3cTraceContext.generateNew(null);

        // Java 25 Scoped Values RequestContext (JEP 506): zero-allocation, immutable context propagation
        RequestContext initialContext = new RequestContext(
                requestId,
                virtualKey,
                null,
                requestedModel,
                requestedModel,
                null,
                startTime,
                isStream,
                traceContext
        );

        try {
            return initialContext.call(() -> {
                // 1. Authenticate Virtual Key (Caffeine L1 + DB fallback)
                Tenant tenant = authService.authenticate(authHeader);
                String authenticatedVirtualKey = tenant.getVirtualKey();

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
                if (request.getMaxTokens() != null && request.getMaxTokens() <= 0) {
                    throw new InvalidRequestException("max_tokens must be a positive integer (got " + request.getMaxTokens() + ")");
                }
                if (request.getTemperature() != null && (request.getTemperature() < 0.0 || request.getTemperature() > 2.0)) {
                    throw new InvalidRequestException("temperature must be between 0.0 and 2.0 (got " + request.getTemperature() + ")");
                }

                // Estimate prompt tokens for sliding-window TPM reservation
                int estimatedTokens = estimatePromptTokens(request);

                // Bind authenticated tenant into the ScopedValue hierarchy
                RequestContext tenantContext = initialContext.withTenant(tenant).withEstimatedTokens(estimatedTokens);
                return ScopedValue.where(RequestContext.CURRENT, tenantContext).call(() -> {
                    // 3. Resolve Candidate Chain (Primary + Fallbacks; runs Prompt Difficulty Classifier for 'auto')
                    UpstreamClientService.CandidateChain chain = upstreamClientService.resolveCandidateChain(request.getModel(), request.getMessages());

                    // 4. Enforce Model Allowlist (Returns 403 if not permitted for this key)
                    authService.validateModelAllowed(tenant, request.getModel());

                    // 5. Atomic Redis Lua Admission Check with In-Flight Token Reservation (Zero Over-Admission Guarantee)
                    AdmissionResult admission = admissionService.checkAdmission(tenant, requestId);
                    if (admission == null) {
                        admission = AdmissionResult.defaultAdmitted(tenant.getRpmLimit());
                    }

                    // 6. Semantic Vector Cache Lookup (Two-Tier: Tier 1 Exact Hash + Tier 2 pgvector HNSW)
                    // Adaptive 'auto' tier dynamically queries its classified target tier (e.g. fast or smart)
                    String effectiveCacheModel = "auto".equalsIgnoreCase(request.getModel()) && chain != null && chain.chosenTier() != null
                            ? chain.chosenTier()
                            : request.getModel();
                    Optional<CacheHitResult> cacheHitOpt =
                            semanticCacheService.lookup(tenant, effectiveCacheModel, request.getMessages());

                    if (cacheHitOpt.isPresent()) {
                        CacheHitResult cacheHit = cacheHitOpt.get();
                        if (isStream) {
                            return streamingRelayService.replayCachedStream(requestId, tenant, request, cacheHit, startTime, servletResponse, admission);
                        } else {
                            return handleCachedNonStreamingCompletion(requestId, tenant, request, cacheHit, startTime, admission);
                        }
                    }

                    // 7. Handle Streaming vs Non-Streaming Forwarding
                    if (isStream) {
                        return streamingRelayService.streamChatCompletion(requestId, tenant, request, chain, startTime, servletResponse, admission);
                    } else {
                        return handleNonStreamingCompletion(requestId, tenant, request, chain, startTime, admission);
                    }
                });
            });
        } catch (GatewayException ex) {
            long latencyMs = System.currentTimeMillis() - startTime;
            recordRejectionAsync(requestId, virtualKey, requestedModel, ex.getErrorCode(), ex.getStatus().value(), latencyMs, isStream);
            throw ex;
        } catch (Exception ex) {
            if (ex.getCause() instanceof GatewayException ge) {
                long latencyMs = System.currentTimeMillis() - startTime;
                recordRejectionAsync(requestId, virtualKey, requestedModel, ge.getErrorCode(), ge.getStatus().value(), latencyMs, isStream);
                throw ge;
            }
            long latencyMs = System.currentTimeMillis() - startTime;
            recordRejectionAsync(requestId, virtualKey, requestedModel, "internal_error", 500, latencyMs, isStream);
            if (ex instanceof RuntimeException re) {
                throw re;
            }
            throw new RuntimeException(ex);
        }
    }

    private ResponseEntity<ChatCompletionResponse> handleNonStreamingCompletion(
            String requestId,
            Tenant tenant,
            ChatCompletionRequest request,
            UpstreamClientService.CandidateChain chain,
            long startTime,
            AdmissionResult admission
    ) {
        UpstreamClientService.UpstreamResult result;
        try {
            result = upstreamClientService.forwardWithFailover(request, chain);
        } catch (Exception e) {
            admissionService.rollbackAdmission(tenant.getVirtualKey(), requestId);
            throw e;
        }

        ChatCompletionResponse response = result.getResponse();
        if (response == null || result.getStatusCode() >= 400) {
            admissionService.rollbackAdmission(tenant.getVirtualKey(), requestId);
            throw new UpstreamException("Upstream provider returned status " + result.getStatusCode());
        }

        // Small-Model Refusal & Degradation Auto-Escalation Engine (Phase 7.4)
        boolean isEscalated = false;
        int initialPromptTokens = 0;
        int initialCompletionTokens = 0;
        int initialCachedTokens = 0;
        BigDecimal initialCost = BigDecimal.ZERO;

        if (refusalEscalationService != null
                && refusalEscalationService.isEscalatable(result.getTier(), result.getResolvedModel())
                && refusalEscalationService.isRefusal(response)) {
            // Respect tenant model allowlist before auto-escalating to smart tier
            if (authService.isModelAllowed(tenant, "smart")) {
                try {
                    log.info("Refusal marker detected from cheap model [{}]. Auto-escalating to smart tier...", result.getResolvedModel());
                    int prevPromptTokens = response.getUsage() != null ? response.getUsage().getPromptTokens() : 0;
                    int prevCompletionTokens = response.getUsage() != null ? response.getUsage().getCompletionTokens() : 0;
                    int prevCachedTokens = response.getUsage() != null ? response.getUsage().getCachedTokens() : 0;
                    String prevAccountingModel = result.getCatalogModel() != null ? result.getCatalogModel() : result.getResolvedModel();
                    BigDecimal prevCost = prevCachedTokens > 0
                            ? costService.calculateCost(prevAccountingModel, prevPromptTokens, prevCompletionTokens, prevCachedTokens)
                            : costService.calculateCost(prevAccountingModel, prevPromptTokens, prevCompletionTokens);

                    UpstreamClientService.UpstreamResult escalatedResult = refusalEscalationService.escalate(request);
                    if (escalatedResult != null && escalatedResult.getStatusCode() < 400 && escalatedResult.getResponse() != null) {
                        result = escalatedResult;
                        response = result.getResponse();
                        initialPromptTokens = prevPromptTokens;
                        initialCompletionTokens = prevCompletionTokens;
                        initialCachedTokens = prevCachedTokens;
                        initialCost = prevCost;
                        isEscalated = true;
                    } else {
                        log.warn("Escalation to smart tier returned unviable result (status {}); keeping original response",
                                escalatedResult != null ? escalatedResult.getStatusCode() : "null");
                    }
                } catch (Exception escEx) {
                    log.warn("Auto-escalation attempt failed, proceeding with original response: {}", escEx.getMessage());
                    initialPromptTokens = 0;
                    initialCompletionTokens = 0;
                    initialCachedTokens = 0;
                    initialCost = BigDecimal.ZERO;
                    isEscalated = false;
                }
            } else {
                log.warn("Auto-escalation skipped for tenant [{}] because 'smart' tier is not permitted by model allowlist", tenant.getVirtualKey());
            }
        }

        long latencyMs = System.currentTimeMillis() - startTime;
        int finalPromptTokens = response.getUsage() != null ? response.getUsage().getPromptTokens() : 0;
        int finalCompletionTokens = response.getUsage() != null ? response.getUsage().getCompletionTokens() : 0;
        int finalCachedTokens = response.getUsage() != null ? response.getUsage().getCachedTokens() : 0;
        int promptTokens = finalPromptTokens + initialPromptTokens;
        int completionTokens = finalCompletionTokens + initialCompletionTokens;
        int cachedTokens = finalCachedTokens + initialCachedTokens;

        // Compute Cost (escalated smart model cost + initial small model cost with prompt caching discount)
        String accountingModel = result.getCatalogModel() != null ? result.getCatalogModel() : result.getResolvedModel();
        BigDecimal finalCost = finalCachedTokens > 0
                ? costService.calculateCost(accountingModel, finalPromptTokens, finalCompletionTokens, finalCachedTokens)
                : costService.calculateCost(accountingModel, finalPromptTokens, finalCompletionTokens);
        if (finalCost == null) {
            finalCost = BigDecimal.ZERO;
        }
        BigDecimal cost = initialCost.add(finalCost);
        String costFormatted = costService.formatCostHeader(cost);
        String providerHeader = result.getResolvedProvider() + "/" + result.getResolvedModel();
        String cacheHeader = "miss";
        String fallbackHeader = String.valueOf(result.isFallback());

        // Construct Headers (Canonical x-netra-* and IETF RateLimit)
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-netra-provider", providerHeader);
        headers.set("x-netra-cache", cacheHeader);
        headers.set("x-netra-fallback", fallbackHeader);
        headers.set("x-netra-cost-usd", costFormatted);
        headers.set("x-netra-cached-tokens", String.valueOf(cachedTokens));
        if (result.getRouteReason() != null) {
            headers.set("x-netra-route-reason", result.getRouteReason());
        }
        headers.set("x-netra-retries", String.valueOf(result.getRetries()));
        if (isEscalated) {
            headers.set("x-netra-escalated", "true");
        }

        if (admission != null) {
            headers.set("RateLimit-Limit", String.valueOf(admission.limit()));
            headers.set("RateLimit-Remaining", String.valueOf(admission.remaining()));
            headers.set("RateLimit-Reset", String.valueOf(admission.resetSeconds()));
            headers.set("RateLimit-Policy", admission.policy());
        }

        com.netra.gateway.telemetry.W3cTraceContext traceCtx = RequestContext.currentTraceContext();
        if (oTelService != null && traceCtx != null) {
            oTelService.injectResponseHeaders(headers, traceCtx);
            oTelService.recordChatCompletion(traceCtx, result.getResolvedProvider(), request.getModel(), result.getResolvedModel(), promptTokens, completionTokens, cachedTokens, latencyMs, 0, false, cacheHeader, 200);
        }

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
                result.getRouteReason(),
                result.getRetries(),
                latencyMs,
                false,
                null,
                isEscalated,
                null,
                cachedTokens
        );

        // Store non-refusal response into semantic cache under the concrete/effective model tier
        String cacheStoreModel = "auto".equalsIgnoreCase(request.getModel()) && chain != null && chain.chosenTier() != null
                ? chain.chosenTier()
                : request.getModel();
        semanticCacheService.store(tenant, cacheStoreModel, request.getMessages(), response, providerHeader);

        return ResponseEntity.ok()
                .headers(headers)
                .body(response);
    }

    private ResponseEntity<ChatCompletionResponse> handleCachedNonStreamingCompletion(
            String requestId,
            Tenant tenant,
            ChatCompletionRequest request,
            CacheHitResult cacheHit,
            long startTime,
            AdmissionResult admission
    ) {
        long latencyMs = System.currentTimeMillis() - startTime;
        ChatCompletionResponse response = cacheHit.response();
        if (response != null) {
            response.setId("chatcmpl-" + requestId.replace("req_", ""));
            response.setCreated(System.currentTimeMillis() / 1000);
        }
        int promptTokens = response != null && response.getUsage() != null ? response.getUsage().getPromptTokens() : 0;
        int completionTokens = response != null && response.getUsage() != null ? response.getUsage().getCompletionTokens() : 0;

        String providerHeader = cacheHit.resolvedProvider() != null ? cacheHit.resolvedProvider() : "mock/" + request.getModel();
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-netra-provider", providerHeader);
        headers.set("x-netra-cache", "hit");
        headers.set("x-netra-cache-tier", cacheHit.cacheTier() != null ? cacheHit.cacheTier() : "tier2_semantic");
        headers.set("x-netra-fallback", "false");
        headers.set("x-netra-cost-usd", "0.000000");
        headers.set("x-netra-cached-tokens", "0");
        headers.set("x-netra-route-reason", "semantic_cache_hit");
        headers.set("x-netra-retries", "0");

        if (admission != null) {
            headers.set("RateLimit-Limit", String.valueOf(admission.limit()));
            headers.set("RateLimit-Remaining", String.valueOf(admission.remaining()));
            headers.set("RateLimit-Reset", String.valueOf(admission.resetSeconds()));
            headers.set("RateLimit-Policy", admission.policy());
        }

        String resolvedProvider = providerHeader.contains("/") ? providerHeader.split("/")[0] : providerHeader;
        String resolvedModel = response != null && response.getModel() != null ? response.getModel() : request.getModel();

        com.netra.gateway.telemetry.W3cTraceContext traceCtx = RequestContext.currentTraceContext();
        if (oTelService != null && traceCtx != null) {
            oTelService.injectResponseHeaders(headers, traceCtx);
            oTelService.recordChatCompletion(traceCtx, resolvedProvider, request.getModel(), resolvedModel, promptTokens, completionTokens, 0, latencyMs, 0, false, "hit", 200);
        }

        recordAuditAndSpend(
                requestId,
                tenant.getVirtualKey(),
                request.getModel(),
                resolvedProvider,
                resolvedModel,
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
                false,
                null,
                false,
                cacheHit.cacheTier(),
                0
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
            String errorType,
            boolean escalated,
            String cacheTier
    ) {
        recordAuditAndSpend(requestId, virtualKey, requestedModel, resolvedProvider, resolvedModel,
                status, statusCode, promptTokens, completionTokens, cost, cache, fallback, routeReason,
                retries, latencyMs, isStream, errorType, escalated, cacheTier, 0);
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
            String errorType,
            boolean escalated,
            String cacheTier,
            int cachedTokens
    ) {
        RequestContext ctx = RequestContext.get();
        Runnable task = () -> {
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
                        errorType,
                        escalated,
                        cacheTier,
                        cachedTokens
                );
            } catch (Exception e) {
                log.error("Failed to persist request log for [{}]: {}", requestId, e.getMessage());
            }
        };
        Thread.ofVirtual().name("audit-log-", 0).start(ctx != null ? ctx.wrap(task) : task);
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
        RequestContext ctx = RequestContext.get();
        Runnable task = () -> {
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
            if (oTelService != null) {
                try {
                    com.netra.gateway.telemetry.W3cTraceContext traceCtx = ctx != null ? ctx.traceContext() : RequestContext.currentTraceContext();
                    oTelService.recordChatCompletion(
                            traceCtx,
                            "none",
                            requestedModel,
                            "error",
                            0,
                            0,
                            0,
                            latencyMs,
                            0,
                            isStream,
                            "none",
                            statusCode
                    );
                } catch (Exception ignored) {}
            }
        };
        Thread.ofVirtual().name("rejection-log-", 0).start(ctx != null ? ctx.wrap(task) : task);
    }

    public static int estimatePromptTokens(ChatCompletionRequest request) {
        if (request == null || request.getMessages() == null) {
            return 0;
        }
        int tokens = 0;
        for (ChatMessage msg : request.getMessages()) {
            if (msg.getContent() != null) {
                String str = msg.getContent().toString();
                if (!str.isBlank()) {
                    tokens += Math.max(1, (int) Math.ceil(str.length() / 4.0));
                }
            }
        }
        return Math.max(1, tokens);
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
