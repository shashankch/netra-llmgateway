package com.netra.gateway;

import com.netra.gateway.exception.BudgetExceededException;
import com.netra.gateway.exception.RateLimitException;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.MonthlySpendRepository;
import com.netra.gateway.service.AdmissionResult;
import com.netra.gateway.service.AdmissionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings({"unchecked", "rawtypes"})
class AdmissionServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    @SuppressWarnings("rawtypes")
    private RedisScript<List> admissionScript;

    @Mock
    private MonthlySpendRepository monthlySpendRepository;

    @Mock
    private ZSetOperations<String, String> zSetOperations;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private AdmissionService admissionService;

    private Tenant testTenant;

    @BeforeEach
    void setUp() {
        testTenant = Tenant.builder()
                .virtualKey("netra-sk-search-1a2b3c")
                .team("search")
                .rpmLimit(10)
                .monthlyBudgetUsd(new BigDecimal("10.00"))
                .build();
    }

    @Test
    @DisplayName("checkAdmission allows request when Lua script returns 200 and returns IETF RateLimit parameters")
    void testCheckAdmissionAllowed() {
        when(redisTemplate.hasKey(anyString())).thenReturn(true);
        when(redisTemplate.execute(eq(admissionScript), anyList(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(200L, "admitted", "1", "45", "9"));

        AdmissionResult result = admissionService.checkAdmission(testTenant, "req_123");
        assertThat(result).isNotNull();
        assertThat(result.limit()).isEqualTo(10);
        assertThat(result.remaining()).isEqualTo(9);
        assertThat(result.resetSeconds()).isEqualTo(45);
        assertThat(result.policy()).isEqualTo("10;w=60");
    }

    @Test
    @DisplayName("checkAdmission throws RateLimitException when Lua script returns 429 for RPM")
    void testCheckAdmissionRateLimited() {
        when(redisTemplate.hasKey(anyString())).thenReturn(true);
        when(redisTemplate.execute(eq(admissionScript), anyList(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(429L, "rate_limit_exceeded", "11", "30"));

        assertThatThrownBy(() -> admissionService.checkAdmission(testTenant, "req_123"))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("Rate limit exceeded")
                .satisfies(ex -> {
                    RateLimitException rle = (RateLimitException) ex;
                    assertThat(rle.getRetryAfterSeconds()).isEqualTo(30);
                    assertThat(rle.getLimitType()).isEqualTo("requests/minute");
                });
    }

    @Test
    @DisplayName("checkAdmission throws RateLimitException when Lua script returns 429 for TPM")
    void testCheckAdmissionTpmRateLimited() {
        testTenant.setTpmLimit(50000);
        when(redisTemplate.hasKey(anyString())).thenReturn(true);
        when(redisTemplate.execute(eq(admissionScript), anyList(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(429L, "tpm_limit_exceeded", "50120", "25"));

        assertThatThrownBy(() -> admissionService.checkAdmission(testTenant, "req_123"))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("tokens/minute limit")
                .satisfies(ex -> {
                    RateLimitException rle = (RateLimitException) ex;
                    assertThat(rle.getRetryAfterSeconds()).isEqualTo(25);
                    assertThat(rle.getLimit()).isEqualTo(50000);
                    assertThat(rle.getLimitType()).isEqualTo("tokens/minute");
                    assertThat(rle.getErrorCode()).isEqualTo("tpm_limit_exceeded");
                    assertThat(rle.getErrorType()).isEqualTo("tpm_limit_exceeded");
                });
    }

    @Test
    @DisplayName("checkAdmission throws BudgetExceededException when Lua script returns 402")
    void testCheckAdmissionBudgetExceeded() {
        when(redisTemplate.hasKey(anyString())).thenReturn(true);
        when(redisTemplate.execute(eq(admissionScript), anyList(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(402L, 15.5));

        assertThatThrownBy(() -> admissionService.checkAdmission(testTenant, "req_123"))
                .isInstanceOf(BudgetExceededException.class)
                .hasMessageContaining("Monthly budget of $10.00 exhausted");
    }

    @Test
    @DisplayName("rollbackAdmission removes request ID from Redis ZSET and refunds tokens")
    void testRollbackAdmission() {
        when(redisTemplate.opsForZSet()).thenReturn(zSetOperations);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        admissionService.rollbackAdmission("netra-sk-search-1a2b3c", "req_failed", 150);

        verify(zSetOperations).remove("netra:ratelimit:netra-sk-search-1a2b3c", "req_failed");
        verify(valueOperations).decrement(startsWith("netra:ratelimit:tpm:netra-sk-search-1a2b3c:"), eq(150L));
    }

    @Test
    @DisplayName("settleTokens across minute boundary executes atomic Lua settlement")
    void testSettleTokensAcrossMinuteBoundary() {
        long admissionMinute = (System.currentTimeMillis() / 60000L) - 1; // 1 minute ago
        long completionMinute = System.currentTimeMillis() / 60000L;
        admissionService.settleTokens("netra-sk-search-1a2b3c", 200, 100, admissionMinute);

        verify(redisTemplate).execute(
                any(RedisScript.class),
                eq(List.of(
                        "netra:ratelimit:tpm:netra-sk-search-1a2b3c:" + admissionMinute,
                        "netra:ratelimit:tpm:netra-sk-search-1a2b3c:" + completionMinute
                )),
                eq("100"),
                eq("200"),
                eq("180")
        );
    }

    @Test
    @DisplayName("rollbackAdmission followed by settleTokens prevents double refund")
    void testRollbackFollowedBySettlePreventsDoubleRefund() {
        when(redisTemplate.opsForZSet()).thenReturn(zSetOperations);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        com.netra.gateway.context.RequestContext ctx = new com.netra.gateway.context.RequestContext(
                "req_cancelled", "netra-sk-search-1a2b3c", null, "fast", "fast", null,
                System.currentTimeMillis(), true, null, 100, System.currentTimeMillis() / 60000L,
                new java.util.concurrent.atomic.AtomicBoolean(false)
        );

        ctx.run(() -> {
            // First: stream cancel rolls back admission
            admissionService.rollbackAdmission("netra-sk-search-1a2b3c", "req_cancelled", 100);
            verify(valueOperations, times(1)).decrement(anyString(), eq(100L));

            // Second: subsequent settleTokens on the same request context is a no-op
            admissionService.settleTokens("netra-sk-search-1a2b3c", 50, 100);
            // No settleScript execution should occur
            verify(redisTemplate, never()).execute(any(RedisScript.class), anyList(), any(), any(), any());
        });
    }

    @Test
    @DisplayName("recordTokens invokes atomic Lua settlement script")
    void testRecordTokens() {
        admissionService.recordTokens("netra-sk-search-1a2b3c", 250);

        verify(redisTemplate).execute(
                any(RedisScript.class),
                eq(List.of(
                        "netra:ratelimit:tpm:netra-sk-search-1a2b3c:" + (System.currentTimeMillis() / 60000L),
                        "netra:ratelimit:tpm:netra-sk-search-1a2b3c:" + (System.currentTimeMillis() / 60000L)
                )),
                eq("0"),
                eq("250"),
                eq("180")
        );
    }

    @Test
    @DisplayName("recordSpend increments Redis monthly spend counter")
    void testRecordSpend() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        admissionService.recordSpend("netra-sk-search-1a2b3c", "2026-10", new BigDecimal("0.005000"));

        verify(valueOperations).increment(eq("netra:spend:netra-sk-search-1a2b3c:2026-10"), eq(0.005));
    }

    @Test
    @DisplayName("checkAdmission seeds spend key with 0.000000 when missing in Redis and DB")
    void testLazySeedingWhenSpendKeyAbsent() {
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(monthlySpendRepository.findByVirtualKeyAndYearMonth(anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(redisTemplate.execute(eq(admissionScript), anyList(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(200L, 1L));

        admissionService.checkAdmission(testTenant, "req_123");

        verify(valueOperations).setIfAbsent(contains("netra:spend:"), eq("0.000000"), any(Duration.class));
    }
}
