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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
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
        when(redisTemplate.execute(eq(admissionScript), anyList(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(200L, "admitted", "1", "45", "9"));

        AdmissionResult result = admissionService.checkAdmission(testTenant, "req_123");
        assertThat(result).isNotNull();
        assertThat(result.limit()).isEqualTo(10);
        assertThat(result.remaining()).isEqualTo(9);
        assertThat(result.resetSeconds()).isEqualTo(45);
        assertThat(result.policy()).isEqualTo("10;w=60");
    }

    @Test
    @DisplayName("checkAdmission throws RateLimitException when Lua script returns 429")
    void testCheckAdmissionRateLimited() {
        when(redisTemplate.hasKey(anyString())).thenReturn(true);
        when(redisTemplate.execute(eq(admissionScript), anyList(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(429L, "rate_limit_exceeded", "11", "30"));

        assertThatThrownBy(() -> admissionService.checkAdmission(testTenant, "req_123"))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("Rate limit exceeded")
                .satisfies(ex -> assertThat(((RateLimitException) ex).getRetryAfterSeconds()).isEqualTo(30));
    }

    @Test
    @DisplayName("checkAdmission throws BudgetExceededException when Lua script returns 402")
    void testCheckAdmissionBudgetExceeded() {
        when(redisTemplate.hasKey(anyString())).thenReturn(true);
        when(redisTemplate.execute(eq(admissionScript), anyList(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(402L, 15.5));

        assertThatThrownBy(() -> admissionService.checkAdmission(testTenant, "req_123"))
                .isInstanceOf(BudgetExceededException.class)
                .hasMessageContaining("Monthly budget of $10.00 exhausted");
    }

    @Test
    @DisplayName("rollbackAdmission removes request ID from Redis ZSET")
    void testRollbackAdmission() {
        when(redisTemplate.opsForZSet()).thenReturn(zSetOperations);

        admissionService.rollbackAdmission("netra-sk-search-1a2b3c", "req_failed");

        verify(zSetOperations).remove("netra:ratelimit:netra-sk-search-1a2b3c", "req_failed");
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
                .thenReturn(java.util.Optional.empty());
        when(redisTemplate.execute(eq(admissionScript), anyList(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(200L, 1L));

        admissionService.checkAdmission(testTenant, "req_123");

        verify(valueOperations).setIfAbsent(contains("netra:spend:"), eq("0.000000"), any(java.time.Duration.class));
    }
}
