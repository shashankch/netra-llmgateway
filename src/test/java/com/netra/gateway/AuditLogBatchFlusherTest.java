package com.netra.gateway;

import com.netra.gateway.model.entity.RequestLog;
import com.netra.gateway.repository.MonthlySpendRepository;
import com.netra.gateway.repository.RequestLogRepository;
import com.netra.gateway.service.AdmissionService;
import com.netra.gateway.service.AuditLogService;
import com.netra.gateway.service.LogStreamBroadcaster;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditLogBatchFlusherTest {

    @Mock
    private RequestLogRepository requestLogRepository;
    @Mock
    private MonthlySpendRepository monthlySpendRepository;
    @Mock
    private AdmissionService admissionService;
    @Mock
    private LogStreamBroadcaster logStreamBroadcaster;

    private AuditLogService auditLogService;

    @BeforeEach
    void setUp() {
        auditLogService = new AuditLogService(
                requestLogRepository,
                monthlySpendRepository,
                admissionService,
                logStreamBroadcaster
        );
        auditLogService.init();
    }

    @AfterEach
    void tearDown() {
        reset(requestLogRepository, monthlySpendRepository, admissionService, logStreamBroadcaster);
        auditLogService.onShutdown();
    }

    @Test
    @DisplayName("Audit logs are enqueued non-blocking and flushed in a single batch to PostgreSQL")
    void testBatchEnqueuingAndFlushing() {
        // Enqueue 5 requests
        for (int i = 1; i <= 5; i++) {
            auditLogService.recordAuditAndSpend(
                    "req_batch_" + i,
                    "netra-sk-search-1a2b3c",
                    "fast",
                    "alpha",
                    "alpha-small",
                    "ok",
                    200,
                    10,
                    20,
                    new BigDecimal("0.000150"),
                    "miss",
                    false,
                    "direct",
                    0,
                    35L,
                    false,
                    null
            );
        }

        // Verify broadcast and redis spend were executed immediately for all 5
        verify(logStreamBroadcaster, times(5)).broadcast(any(RequestLog.class));
        verify(admissionService, times(5)).recordSpend(eq("netra-sk-search-1a2b3c"), anyString(), any(BigDecimal.class));

        // Flush batch synchronously
        auditLogService.flushNow();

        // Verify single saveAll call with all 5 logs
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RequestLog>> batchCaptor = ArgumentCaptor.forClass(List.class);
        verify(requestLogRepository, atLeastOnce()).saveAll(batchCaptor.capture());

        List<RequestLog> savedLogs = batchCaptor.getValue();
        assertThat(savedLogs).hasSize(5);
        assertThat(savedLogs.get(0).getRequestId()).isEqualTo("req_batch_1");
        assertThat(savedLogs.get(4).getRequestId()).isEqualTo("req_batch_5");

        // Verify spend aggregation: 5 requests aggregated into 1 DB upsert with 5x cost and tokens
        verify(monthlySpendRepository, times(1)).upsertSpendAggregated(
                eq("netra-sk-search-1a2b3c"),
                anyString(),
                eq(new BigDecimal("0.000750")), // 5 * 0.000150
                eq(5),
                eq(50), // 5 * 10
                eq(100), // 5 * 20
                eq(0)
        );

        assertThat(auditLogService.getFlushedCount()).isEqualTo(5);
        assertThat(auditLogService.getQueueSize()).isEqualTo(0);
    }

    @Test
    @DisplayName("Aggregated spend groups multiple virtual keys independently during batch flush")
    void testMultiTenantSpendAggregation() {
        // 3 requests for Tenant A
        for (int i = 1; i <= 3; i++) {
            auditLogService.recordAuditAndSpend(
                    "req_a_" + i,
                    "netra-sk-search-1a2b3c",
                    "fast",
                    "alpha",
                    "alpha-small",
                    "ok",
                    200,
                    10,
                    10,
                    new BigDecimal("0.000100"),
                    "miss",
                    false,
                    "direct",
                    0,
                    20L,
                    false,
                    null
            );
        }

        // 2 requests for Tenant B
        for (int i = 1; i <= 2; i++) {
            auditLogService.recordAuditAndSpend(
                    "req_b_" + i,
                    "netra-sk-research-4d5e6f",
                    "smart",
                    "alpha",
                    "alpha-large",
                    "ok",
                    200,
                    20,
                    40,
                    new BigDecimal("0.000500"),
                    "hit",
                    false,
                    "direct",
                    0,
                    5L,
                    false,
                    null
            );
        }

        auditLogService.flushNow();

        // Verify monthly spend upsert was called once per tenant
        verify(monthlySpendRepository, times(1)).upsertSpendAggregated(
                eq("netra-sk-search-1a2b3c"),
                anyString(),
                eq(new BigDecimal("0.000300")),
                eq(3),
                eq(30),
                eq(30),
                eq(0)
        );

        verify(monthlySpendRepository, times(1)).upsertSpendAggregated(
                eq("netra-sk-research-4d5e6f"),
                anyString(),
                eq(new BigDecimal("0.001000")),
                eq(2),
                eq(40),
                eq(80),
                eq(2) // 2 cache hits
        );
    }

    @Test
    @DisplayName("Rejection logs are enqueued and persisted with null providers")
    void testRejectionLogging() {
        auditLogService.recordRejection(
                "req_rejected_429",
                "netra-sk-free-7g8h9i",
                "fast",
                "rate_limit_exceeded",
                429,
                2L,
                false
        );

        auditLogService.flushNow();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RequestLog>> captor = ArgumentCaptor.forClass(List.class);
        verify(requestLogRepository).saveAll(captor.capture());

        List<RequestLog> saved = captor.getValue();
        assertThat(saved).hasSize(1);
        RequestLog logEntry = saved.get(0);
        assertThat(logEntry.getRequestId()).isEqualTo("req_rejected_429");
        assertThat(logEntry.getStatus()).isEqualTo("rejected_rate_limit");
        assertThat(logEntry.getStatusCode()).isEqualTo(429);
        assertThat(logEntry.getResolvedProvider()).isNull();
        assertThat(logEntry.getCostUsd()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("Batch failure with constraint violation separates bad record and persists valid ones")
    void testBatchFailureWithConstraintViolationRecovery() {
        auditLogService.recordAuditAndSpend(
                "req_valid",
                "netra-sk-search-1a2b3c",
                "fast",
                "alpha",
                "alpha-small",
                "ok",
                200,
                10,
                20,
                new BigDecimal("0.000150"),
                "miss",
                false,
                "direct",
                0,
                30L,
                false,
                null
        );

        auditLogService.recordAuditAndSpend(
                "req_corrupted",
                "netra-sk-search-1a2b3c",
                "fast",
                "alpha",
                "alpha-small",
                "ok",
                200,
                10,
                20,
                new BigDecimal("0.000150"),
                "miss",
                false,
                "direct",
                0,
                30L,
                false,
                null
        );

        // Batch saveAll throws DataIntegrityViolationException on the full batch
        org.mockito.Mockito.doAnswer(invocation -> {
            List<RequestLog> list = invocation.getArgument(0);
            if (list.size() > 1) {
                throw new org.springframework.dao.DataIntegrityViolationException("Batch constraint failure");
            }
            if (list.get(0).getRequestId().equals("req_corrupted")) {
                throw new org.springframework.dao.DataIntegrityViolationException("Row constraint violation");
            }
            return list;
        }).when(requestLogRepository).saveAll(any());

        int flushed = auditLogService.flushBatch();

        // Exactly 1 valid record was recovered and persisted, corrupted record was isolated and discarded
        assertThat(flushed).isEqualTo(1);
        assertThat(auditLogService.getFlushedCount()).isEqualTo(1);
        assertThat(auditLogService.getQueueSize()).isEqualTo(0);
    }

    @Test
    @DisplayName("Batch failure with transient database error re-enqueues records and applies exponential backoff")
    void testBatchFailureWithTransientErrorReenqueues() {
        auditLogService.recordAuditAndSpend(
                "req_transient_1",
                "netra-sk-search-1a2b3c",
                "fast",
                "alpha",
                "alpha-small",
                "ok",
                200,
                10,
                20,
                new BigDecimal("0.000150"),
                "miss",
                false,
                "direct",
                0,
                30L,
                false,
                null
        );

        // Entire DB is down: throws transient exception on both batch and individual attempts
        org.mockito.Mockito.doThrow(new org.springframework.dao.TransientDataAccessException("DB connection down") {})
                .when(requestLogRepository).saveAll(any());

        int flushed = auditLogService.flushBatch();

        // Zero records flushed, but records are NOT lost - re-enqueued for retry
        assertThat(flushed).isEqualTo(0);
        assertThat(auditLogService.getQueueSize()).isEqualTo(1);
        assertThat(auditLogService.getConsecutiveFailures()).isEqualTo(1);
        assertThat(auditLogService.getNextAllowedRetryTimeMs()).isGreaterThan(System.currentTimeMillis() - 50);

        // Immediate subsequent flush attempts during backoff period skip execution to prevent tight retry spin loop
        int secondFlushed = auditLogService.flushBatch();
        assertThat(secondFlushed).isEqualTo(0);
        assertThat(auditLogService.getQueueSize()).isEqualTo(1);
    }
}
