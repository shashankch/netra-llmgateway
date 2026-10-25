package com.netra.gateway.service;

import com.netra.gateway.model.entity.RequestLog;
import com.netra.gateway.repository.MonthlySpendRepository;
import com.netra.gateway.repository.RequestLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final RequestLogRepository requestLogRepository;
    private final MonthlySpendRepository monthlySpendRepository;
    private final AdmissionService admissionService;

    // Concurrency throttle to prevent HikariCP connection starvation under high bursts (AUD-01)
    private final java.util.concurrent.Semaphore dbPermits = new java.util.concurrent.Semaphore(14);

    @Transactional
    public void recordAuditAndSpend(
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
        boolean acquired = false;
        try {
            acquired = dbPermits.tryAcquire(5, java.util.concurrent.TimeUnit.SECONDS);
            if (!acquired) {
                log.warn("Database concurrency throttle: HikariCP pool saturated, dropped request log [{}]", requestId);
                return;
            }

            RequestLog logEntry = RequestLog.builder()
                .requestId(requestId)
                .virtualKey(virtualKey != null ? virtualKey : "unauthenticated")
                .requestedModel(requestedModel != null ? requestedModel : "unknown")
                .resolvedProvider(resolvedProvider)
                .resolvedModel(resolvedModel)
                .status(status)
                .statusCode(statusCode)
                .promptTokens(promptTokens)
                .completionTokens(completionTokens)
                .costUsd(cost != null ? cost : BigDecimal.ZERO)
                .cache(cache != null ? cache : "miss")
                .fallback(fallback)
                .routeReason(routeReason)
                .retries(retries)
                .latencyMs(latencyMs)
                .isStream(isStream)
                .errorType(errorType)
                .build();

        requestLogRepository.save(logEntry);

        if (("ok".equals(status) || "client_disconnected".equals(status)) && cost != null && cost.compareTo(BigDecimal.ZERO) > 0) {
            String ym = YearMonth.now().toString();
            int cacheHitInt = "hit".equalsIgnoreCase(cache) ? 1 : 0;
            monthlySpendRepository.upsertSpend(virtualKey, ym, cost, promptTokens, completionTokens, cacheHitInt);
            admissionService.recordSpend(virtualKey, ym, cost);
        }
    } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Audit logging interrupted for [{}]", requestId);
        } finally {
            if (acquired) {
                dbPermits.release();
            }
        }
    }

    /**
     * Records a rejected request in request_logs per DATA_MODEL.md requirements.
     */
    @Transactional
    public void recordRejection(
            String requestId,
            String virtualKey,
            String requestedModel,
            String errorType,
            int statusCode,
            long latencyMs,
            boolean isStream
    ) {
        String status = switch (statusCode) {
            case 401 -> "rejected_auth";
            case 403 -> "rejected_allowlist";
            case 429 -> "rejected_rate_limit";
            case 402 -> "rejected_budget";
            case 404 -> "rejected_model_not_found";
            case 400 -> "rejected_invalid_request";
            default -> "rejected_error";
        };

        recordAuditAndSpend(
                requestId,
                virtualKey != null ? virtualKey : "unauthenticated",
                requestedModel != null ? requestedModel : "unknown",
                null, // resolvedProvider explicitly null on rejections
                null, // resolvedModel explicitly null on rejections
                status,
                statusCode,
                0,
                0,
                BigDecimal.ZERO,
                "miss",
                false,
                null,
                0,
                latencyMs,
                isStream,
                errorType
        );
    }
}
