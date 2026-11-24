package com.netra.gateway.service;

import com.netra.gateway.exception.BudgetExceededException;
import com.netra.gateway.exception.RateLimitException;
import com.netra.gateway.model.entity.MonthlySpend;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.MonthlySpendRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
    private final RedisScript<String> settleScript = RedisScript.of(
            """
            local old_key = KEYS[1]
            local new_key = KEYS[2]
            local est_tokens = tonumber(ARGV[1]) or 0
            local act_tokens = tonumber(ARGV[2]) or 0
            local ttl = tonumber(ARGV[3]) or 180

            if old_key == new_key then
                local delta = act_tokens - est_tokens
                if delta > 0 then
                    redis.call("INCRBY", new_key, delta)
                    redis.call("EXPIRE", new_key, ttl)
                elseif delta < 0 then
                    redis.call("DECRBY", new_key, -delta)
                end
            else
                if est_tokens > 0 then
                    redis.call("DECRBY", old_key, est_tokens)
                end
                if act_tokens > 0 then
                    redis.call("INCRBY", new_key, act_tokens)
                    redis.call("EXPIRE", new_key, ttl)
                end
            end
            return "OK"
            """,
            String.class
    );

    /**
     * Executes atomic sliding-window RPM check, TPM check, and monthly spend check via Redis Lua.
     * Guarantees zero over-admission under concurrent bursts.
     * Returns AdmissionResult containing IETF rate-limit parameters.
     */
    public AdmissionResult checkAdmission(Tenant tenant, String requestId) {
        return checkAdmission(tenant, requestId, com.netra.gateway.context.RequestContext.currentEstimatedTokens());
    }

    /**
     * Executes atomic sliding-window RPM check, TPM check (with estimated prompt tokens), and monthly spend check.
     */
    public AdmissionResult checkAdmission(Tenant tenant, String requestId, int estimatedPromptTokens) {
        String virtualKey = tenant.getVirtualKey();
        String yearMonth = YearMonth.now().toString();
        String zsetKey = "netra:ratelimit:" + virtualKey;
        String spendKey = "netra:spend:" + virtualKey + ":" + yearMonth;
        String tpmPrefix = "netra:ratelimit:tpm:" + virtualKey;

        // Lazy initialize Redis spend string from Postgres if missing (seed with 0.000000 if no records exist)
        try {
            if (Boolean.FALSE.equals(redisTemplate.hasKey(spendKey))) {
                BigDecimal initialSpend = monthlySpendRepository.findByVirtualKeyAndYearMonth(virtualKey, yearMonth)
                        .map(MonthlySpend::getTotalSpendUsd)
                        .orElse(BigDecimal.ZERO);
                redisTemplate.opsForValue().setIfAbsent(spendKey, initialSpend.setScale(6, RoundingMode.HALF_UP).toPlainString(), Duration.ofDays(90));
            }
        } catch (Exception e) {
            log.warn("Failed to check/seed spend key in Redis: {}", e.getMessage());
        }

        long now = System.currentTimeMillis();
        long windowMs = 60_000L;
        int rpmLimit = tenant.getRpmLimit();
        Integer tpmLimitObj = tenant.getTpmLimit();
        int tpmLimit = (tpmLimitObj != null && tpmLimitObj > 0) ? tpmLimitObj : -1;
        BigDecimal budgetCap = tenant.getMonthlyBudgetUsd();
        String budgetCapStr = budgetCap != null ? budgetCap.toPlainString() : "-1.0";

        List<String> keys = List.of(zsetKey, spendKey, tpmPrefix);
        List<?> result;
        try {
            result = redisTemplate.execute(
                    admissionScript,
                    keys,
                    String.valueOf(now),
                    String.valueOf(windowMs),
                    String.valueOf(rpmLimit),
                    budgetCapStr,
                    requestId,
                    String.valueOf(tpmLimit),
                    String.valueOf(Math.max(0, estimatedPromptTokens))
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
                String reason = result.size() >= 2 ? String.valueOf(result.get(1)) : "rate_limit_exceeded";
                int retryAfter = 60;
                if (result.size() >= 4) {
                    try {
                        retryAfter = Integer.parseInt(result.get(3).toString());
                    } catch (Exception ignored) {}
                }
                if ("tpm_limit_exceeded".equalsIgnoreCase(reason)) {
                    log.warn("TPM limit breached for key [{}]: limit={}, retryAfter={}", virtualKey, tpmLimit, retryAfter);
                    throw new RateLimitException(tpmLimit, retryAfter, "tokens/minute");
                } else {
                    log.warn("Rate limit breached for key [{}]: limit={}, retryAfter={}", virtualKey, rpmLimit, retryAfter);
                    throw new RateLimitException(rpmLimit, retryAfter, "requests/minute");
                }
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
     * Automatic slot rollback: if upstream fails before token generation, invoke ZREM to restore quota
     * and automatically refund any in-flight estimated tokens bound in RequestContext.
     */
    public void rollbackAdmission(String virtualKey, String requestId) {
        rollbackAdmission(virtualKey, requestId, com.netra.gateway.context.RequestContext.currentEstimatedTokens(), com.netra.gateway.context.RequestContext.currentAdmissionMinute());
    }

    /**
     * Automatic slot rollback with token refund: restores RPM slot and refunds estimated tokens.
     */
    public void rollbackAdmission(String virtualKey, String requestId, int estimatedTokens) {
        rollbackAdmission(virtualKey, requestId, estimatedTokens, com.netra.gateway.context.RequestContext.currentAdmissionMinute());
    }

    public void rollbackAdmission(String virtualKey, String requestId, int estimatedTokens, long admissionMinute) {
        if (com.netra.gateway.context.RequestContext.isAdmissionRolledBack()) {
            log.debug("Admission already rolled back for req [{}]; skipping redundant rollback", requestId);
            return;
        }
        com.netra.gateway.context.RequestContext.markAdmissionRolledBack();

        String zsetKey = "netra:ratelimit:" + virtualKey;
        try {
            redisTemplate.opsForZSet().remove(zsetKey, requestId);
            log.debug("Rolled back admission slot for key [{}] req [{}]", virtualKey, requestId);
        } catch (Exception e) {
            log.warn("Failed to rollback slot in Redis for req [{}]: {}", requestId, e.getMessage());
        }

        if (estimatedTokens > 0) {
            long bucketMinute = admissionMinute > 0 ? admissionMinute : (System.currentTimeMillis() / 60000L);
            String tpmKey = "netra:ratelimit:tpm:" + virtualKey + ":" + bucketMinute;
            try {
                redisTemplate.opsForValue().decrement(tpmKey, estimatedTokens);
            } catch (Exception ignored) {}
        }
    }

    /**
     * Atomically settles actual token consumption against previously reserved estimated tokens in Redis TPM.
     * When request completes in the same minute, only the delta is adjusted.
     * When crossing a minute boundary, the reserved estimate is refunded from the admission minute bucket
     * and actual tokens are attributed to the completion minute bucket, preventing phantom lingering tokens or negative counters.
     */
    public void settleTokens(String virtualKey, int totalTokens, int estimatedTokens) {
        settleTokens(virtualKey, totalTokens, estimatedTokens, com.netra.gateway.context.RequestContext.currentAdmissionMinute());
    }

    public void settleTokens(String virtualKey, int totalTokens, int estimatedTokens, long admissionMinute) {
        if (totalTokens <= 0 || virtualKey == null || virtualKey.isBlank()) {
            return;
        }
        if (com.netra.gateway.context.RequestContext.isAdmissionRolledBack()) {
            log.debug("Skipping settleTokens for key [{}] as admission was already rolled back", virtualKey);
            return;
        }

        long completionMinute = System.currentTimeMillis() / 60000L;
        long reservationBucket = admissionMinute > 0 ? admissionMinute : completionMinute;
        String admissionTpmKey = "netra:ratelimit:tpm:" + virtualKey + ":" + reservationBucket;
        String completionTpmKey = "netra:ratelimit:tpm:" + virtualKey + ":" + completionMinute;

        try {
            redisTemplate.execute(
                    settleScript,
                    List.of(admissionTpmKey, completionTpmKey),
                    String.valueOf(Math.max(0, estimatedTokens)),
                    String.valueOf(totalTokens),
                    "180"
            );
        } catch (Exception e) {
            log.warn("Failed to atomically settle TPM tokens in Redis for key [{}]: {}", virtualKey, e.getMessage());
        }
    }

    /**
     * Atomically records actual token consumption into the sliding-window TPM accumulator.
     */
    public void recordTokens(String virtualKey, int totalTokens) {
        settleTokens(virtualKey, totalTokens, 0);
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
