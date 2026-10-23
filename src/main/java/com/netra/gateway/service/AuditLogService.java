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
        RequestLog logEntry = RequestLog.builder()
                .requestId(requestId)
                .virtualKey(virtualKey)
                .requestedModel(requestedModel)
                .resolvedProvider(resolvedProvider)
                .resolvedModel(resolvedModel)
                .status(status)
                .statusCode(statusCode)
                .promptTokens(promptTokens)
                .completionTokens(completionTokens)
                .costUsd(cost)
                .cache(cache)
                .fallback(fallback)
                .routeReason(routeReason)
                .retries(retries)
                .latencyMs(latencyMs)
                .isStream(isStream)
                .errorType(errorType)
                .build();

        requestLogRepository.save(logEntry);

        if ("ok".equals(status)) {
            String ym = YearMonth.now().toString();
            int cacheHitInt = "hit".equalsIgnoreCase(cache) ? 1 : 0;
            monthlySpendRepository.upsertSpend(virtualKey, ym, cost, promptTokens, completionTokens, cacheHitInt);
        }
    }
}
