package com.netra.gateway.service;

import com.netra.gateway.exception.BudgetExceededException;
import com.netra.gateway.exception.RateLimitException;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.MonthlySpendRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.YearMonth;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdmissionService {

    private final StringRedisTemplate redisTemplate;
    @SuppressWarnings("rawtypes")
    private final RedisScript<List> admissionScript;
    private final MonthlySpendRepository monthlySpendRepository;

    /**
     * Executes atomic sliding-window RPM check and monthly spend check via Redis Lua.
     * Guarantees zero over-admission under concurrent bursts.
     * Returns AdmissionResult containing IETF rate-limit parameters.
     */
    public AdmissionResult checkAdmission(Tenant tenant, String requestId) {
        String virtualKey = tenant.getVirtualKey();
        String yearMonth = YearMonth.now().toString();
        String zsetKey = "netra:ratelimit:" + virtualKey;
        String spendKey = "netra:spend:" + virtualKey + ":" + yearMonth;

        // Lazy initialize Redis spend string from Postgres if missing (seed with 0.000000 if no records exist)
        try {
            if (Boolean.FALSE.equals(redisTemplate.hasKey(spendKey))) {
                BigDecimal initialSpend = monthlySpendRepository.findByVirtualKeyAndYearMonth(virtualKey, yearMonth)
                        .map(com.netra.gateway.model.entity.MonthlySpend::getTotalSpendUsd)
                        .orElse(BigDecimal.ZERO);
                redisTemplate.opsForValue().setIfAbsent(spendKey, initialSpend.setScale(6, java.math.RoundingMode.HALF_UP).toPlainString(), Duration.ofDays(90));
            }
        } catch (Exception e) {
            log.warn("Failed to check/seed spend key in Redis: {}", e.getMessage());
        }

        long now = System.currentTimeMillis();
        long windowMs = 60_000L;
        int rpmLimit = tenant.getRpmLimit();
        BigDecimal budgetCap = tenant.getMonthlyBudgetUsd();
        String budgetCapStr = budgetCap != null ? budgetCap.toPlainString() : "-1.0";

        List<String> keys = List.of(zsetKey, spendKey);
        List<?> result;
        try {
            result = redisTemplate.execute(
                    admissionScript,
                    keys,
                    String.valueOf(now),
                    String.valueOf(windowMs),
                    String.valueOf(rpmLimit),
                    budgetCapStr,
                    requestId
            );
        } catch (Exception e) {
            log.error("Redis admission execution failed for key [{}]: {}", virtualKey, e.getMessage());
            // In case of Redis outage, rethrow or propagate to protect system from unmetered spend
            throw e;
        }

        if (result != null && !result.isEmpty()) {
            Number statusCodeNum = (Number) result.get(0);
            int statusCode = statusCodeNum.intValue();
            if (statusCode == 429) {
                int retryAfter = 60;
                if (result.size() >= 4) {
                    try {
                        retryAfter = Integer.parseInt(result.get(3).toString());
                    } catch (Exception ignored) {}
                }
                log.warn("Rate limit breached for key [{}]: limit={}, retryAfter={}", virtualKey, rpmLimit, retryAfter);
                throw new RateLimitException(rpmLimit, retryAfter);
            } else if (statusCode == 402) {
                log.warn("Monthly budget exhausted for key [{}]: cap=${}", virtualKey, budgetCapStr);
                throw new BudgetExceededException(budgetCap);
            } else if (statusCode == 200) {
                int resetSeconds = 60;
                int remaining = Math.max(0, rpmLimit - 1);
                if (result.size() >= 4) {
                    try {
                        resetSeconds = Integer.parseInt(result.get(3).toString());
                    } catch (Exception ignored) {}
                }
                if (result.size() >= 5) {
                    try {
                        remaining = Integer.parseInt(result.get(4).toString());
                    } catch (Exception ignored) {}
                }
                return AdmissionResult.admitted(rpmLimit, remaining, resetSeconds);
            }
        }
        return AdmissionResult.defaultAdmitted(rpmLimit);
    }

    /**
     * Automatic slot rollback: if upstream fails before token generation, invoke ZREM to restore quota.
     */
    public void rollbackAdmission(String virtualKey, String requestId) {
        String zsetKey = "netra:ratelimit:" + virtualKey;
        try {
            redisTemplate.opsForZSet().remove(zsetKey, requestId);
            log.debug("Rolled back admission slot for key [{}] req [{}]", virtualKey, requestId);
        } catch (Exception e) {
            log.warn("Failed to rollback slot in Redis for req [{}]: {}", requestId, e.getMessage());
        }
    }

    /**
     * Atomically increments Redis monthly spend counter.
     */
    public void recordSpend(String virtualKey, String yearMonth, BigDecimal costUsd) {
        String spendKey = "netra:spend:" + virtualKey + ":" + yearMonth;
        try {
            redisTemplate.opsForValue().increment(spendKey, costUsd.doubleValue());
            redisTemplate.expire(spendKey, Duration.ofDays(90));
        } catch (Exception e) {
            log.warn("Failed to increment spend in Redis for key [{}]: {}", virtualKey, e.getMessage());
        }
    }
}
