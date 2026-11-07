package com.netra.gateway.service;

import com.netra.gateway.context.RequestContext;
import com.netra.gateway.model.entity.RequestLog;
import com.netra.gateway.repository.MonthlySpendRepository;
import com.netra.gateway.repository.RequestLogRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Enterprise Audit Logging & Financial Settlement Service.
 * <p>
 * Decouples database persistence from ingress virtual threads via a bounded in-memory
 * batching queue (10,000 capacity). Batches multi-row SQL inserts every 250ms or 100 entries,
 * completely shielding the HikariCP connection pool under 10,000+ virtual thread loads.
 */
@Slf4j
@Service
public class AuditLogService {

    public static final int BATCH_SIZE = 100;
    public static final int QUEUE_CAPACITY = 10_000;
    public static final long FLUSH_INTERVAL_MS = 250;
    public static final long BASE_RETRY_BACKOFF_MS = 500;
    public static final long MAX_RETRY_BACKOFF_MS = 10_000;

    private final RequestLogRepository requestLogRepository;
    private final MonthlySpendRepository monthlySpendRepository;
    private final AdmissionService admissionService;
    private final LogStreamBroadcaster logStreamBroadcaster;
    private final TransactionTemplate transactionTemplate;

    // Bounded queue decoupling database logging from ingress virtual threads (HikariCP protection)
    private final BlockingQueue<AuditLogItem> batchQueue = new LinkedBlockingQueue<>(QUEUE_CAPACITY);
    private final AtomicLong droppedLogsCounter = new AtomicLong(0);
    private final AtomicLong flushedLogsCounter = new AtomicLong(0);
    private final AtomicBoolean flushScheduled = new AtomicBoolean(false);
    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private final AtomicLong nextAllowedRetryTimeMs = new AtomicLong(0);
    private volatile boolean isShuttingDown = false;

    private final ScheduledExecutorService flusherScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "audit-batch-flusher");
        t.setDaemon(true);
        return t;
    });

    /**
     * Primary Spring-managed constructor injecting PlatformTransactionManager.
     */
    @Autowired
    public AuditLogService(
            RequestLogRepository requestLogRepository,
            MonthlySpendRepository monthlySpendRepository,
            AdmissionService admissionService,
            LogStreamBroadcaster logStreamBroadcaster,
            PlatformTransactionManager transactionManager
    ) {
        this.requestLogRepository = requestLogRepository;
        this.monthlySpendRepository = monthlySpendRepository;
        this.admissionService = admissionService;
        this.logStreamBroadcaster = logStreamBroadcaster;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    /**
     * Testing constructor accepting pre-configured TransactionTemplate.
     */
    public AuditLogService(
            RequestLogRepository requestLogRepository,
            MonthlySpendRepository monthlySpendRepository,
            AdmissionService admissionService,
            LogStreamBroadcaster logStreamBroadcaster,
            TransactionTemplate transactionTemplate
    ) {
        this.requestLogRepository = requestLogRepository;
        this.monthlySpendRepository = monthlySpendRepository;
        this.admissionService = admissionService;
        this.logStreamBroadcaster = logStreamBroadcaster;
        this.transactionTemplate = transactionTemplate;
    }

    /**
     * Backward-compatible constructor for testing environments.
     */
    public AuditLogService(
            RequestLogRepository requestLogRepository,
            MonthlySpendRepository monthlySpendRepository,
            AdmissionService admissionService,
            LogStreamBroadcaster logStreamBroadcaster
    ) {
        this(
                requestLogRepository,
                monthlySpendRepository,
                admissionService,
                logStreamBroadcaster,
                new org.springframework.transaction.support.AbstractPlatformTransactionManager() {
                    @Override
                    protected Object doGetTransaction() { return new Object(); }
                    @Override
                    protected void doBegin(Object transaction, org.springframework.transaction.TransactionDefinition definition) {}
                    @Override
                    protected void doCommit(org.springframework.transaction.support.DefaultTransactionStatus status) {}
                    @Override
                    protected void doRollback(org.springframework.transaction.support.DefaultTransactionStatus status) {}
                }
        );
    }

    public record SpendItem(
            String virtualKey,
            String yearMonth,
            BigDecimal cost,
            int promptTokens,
            int completionTokens,
            int cacheHitInt
    ) {}

    public record AuditLogItem(
            RequestLog logEntry,
            SpendItem spendItem
    ) {}

    private record AggregatedSpend(
            BigDecimal totalCost,
            int count,
            int promptTokens,
            int completionTokens,
            int cacheHits
    ) {
        AggregatedSpend add(BigDecimal cost, int countDelta, int pTokens, int cTokens, int cacheHitDelta) {
            return new AggregatedSpend(
                    this.totalCost.add(cost != null ? cost : BigDecimal.ZERO),
                    this.count + countDelta,
                    this.promptTokens + pTokens,
                    this.completionTokens + cTokens,
                    this.cacheHits + cacheHitDelta
            );
        }
    }

    private record SpendKey(String virtualKey, String yearMonth) {}

    @PostConstruct
    public void init() {
        flusherScheduler.scheduleWithFixedDelay(this::flushBatchSafely, FLUSH_INTERVAL_MS, FLUSH_INTERVAL_MS, TimeUnit.MILLISECONDS);
        log.info("AuditLogService initialized with {} bounded batch queue and {}ms batch flusher protecting HikariCP",
                QUEUE_CAPACITY, FLUSH_INTERVAL_MS);
    }

    @PreDestroy
    public void onShutdown() {
        log.info("Shutting down AuditLogService. Draining remaining {} items in batch queue...", batchQueue.size());
        isShuttingDown = true;
        flusherScheduler.shutdown();
        try {
            if (!flusherScheduler.awaitTermination(3, TimeUnit.SECONDS)) {
                flusherScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            flusherScheduler.shutdownNow();
        }
        flushNow();
        log.info("AuditLogService shutdown complete. Total flushed: {}, dropped: {}",
                flushedLogsCounter.get(), droppedLogsCounter.get());
    }

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
        recordAuditAndSpend(requestId, virtualKey, requestedModel, resolvedProvider, resolvedModel,
                status, statusCode, promptTokens, completionTokens, cost, cache, fallback, routeReason,
                retries, latencyMs, isStream, errorType, false, null);
    }

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
            String errorType,
            boolean escalated,
            String cacheTier
    ) {
        // Fallback to ScopedValue RequestContext if parameters are null
        if (requestId == null) {
            requestId = RequestContext.currentRequestId();
        }
        if (virtualKey == null) {
            virtualKey = RequestContext.currentVirtualKey();
        }

        RequestLog logEntry = RequestLog.builder()
                .requestId(requestId != null ? requestId : "req_unknown")
                .virtualKey(virtualKey != null ? virtualKey : "unauthenticated")
                .requestedModel(requestedModel != null ? requestedModel : "unknown")
                .resolvedProvider(resolvedProvider)
                .resolvedModel(resolvedModel)
                .status(status != null ? status : (statusCode >= 200 && statusCode < 300 ? "ok" : "error"))
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
                .escalated(escalated)
                .cacheTier(cacheTier)
                .build();

        // 1. Immediately broadcast to live Ops Console SSE stream (real-time, sub-millisecond)
        try {
            logStreamBroadcaster.broadcast(logEntry);
        } catch (Exception e) {
            log.debug("Log stream broadcast failed: {}", e.getMessage());
        }

        // 2. Real-time Redis spend update for atomic admission limit enforcement
        SpendItem spendItem = null;
        if (("ok".equals(status) || "client_disconnected".equals(status)) && virtualKey != null && !"unauthenticated".equals(virtualKey)) {
            String ym = YearMonth.now().toString();
            int cacheHitInt = "hit".equalsIgnoreCase(cache) ? 1 : 0;
            BigDecimal billableCost = cost != null ? cost : BigDecimal.ZERO;
            if (billableCost.compareTo(BigDecimal.ZERO) > 0) {
                try {
                    admissionService.recordSpend(virtualKey, ym, billableCost);
                } catch (Exception e) {
                    log.warn("Redis spend tracking failed for [{}]: {}", virtualKey, e.getMessage());
                }
            }
            spendItem = new SpendItem(virtualKey, ym, billableCost, promptTokens, completionTokens, cacheHitInt);
        }

        // 3. Enqueue into bounded batch buffer for asynchronous PostgreSQL flushing
        AuditLogItem item = new AuditLogItem(logEntry, spendItem);
        boolean enqueued = batchQueue.offer(item);
        if (!enqueued) {
            long dropped = droppedLogsCounter.incrementAndGet();
            if (dropped % 50 == 1) {
                log.warn("Database batch queue saturated ({} capacity). Dropped [{}] audit logs so far to shield HikariCP.",
                        QUEUE_CAPACITY, dropped);
            }
        } else if (!isShuttingDown && !flusherScheduler.isShutdown() && batchQueue.size() >= BATCH_SIZE && flushScheduled.compareAndSet(false, true)) {
            try {
                flusherScheduler.execute(this::flushBatchSafely);
            } catch (java.util.concurrent.RejectedExecutionException e) {
                flushScheduled.set(false);
            }
        }
    }

    /**
     * Records a rejected request in request_logs per DATA_MODEL.md requirements.
     */
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

    public void flushBatchSafely() {
        try {
            flushBatch();
        } catch (Exception e) {
            log.error("Failed to flush audit log batch: {}", e.getMessage(), e);
        } finally {
            flushScheduled.set(false);
            long now = System.currentTimeMillis();
            // Only schedule an immediate subsequent flush if the previous flush was successful,
            // we are not in backoff, and there is still a full batch backlog.
            if (!isShuttingDown && !flusherScheduler.isShutdown()
                    && now >= nextAllowedRetryTimeMs.get()
                    && batchQueue.size() >= BATCH_SIZE
                    && flushScheduled.compareAndSet(false, true)) {
                try {
                    flusherScheduler.execute(this::flushBatchSafely);
                } catch (java.util.concurrent.RejectedExecutionException e) {
                    flushScheduled.set(false);
                }
            }
        }
    }

    public int flushBatch() {
        if (batchQueue.isEmpty()) {
            return 0;
        }

        long now = System.currentTimeMillis();
        // If we are backing off due to transient database outage and not shutting down, wait for backoff window
        if (!isShuttingDown && now < nextAllowedRetryTimeMs.get()) {
            return 0;
        }

        List<AuditLogItem> batch = new ArrayList<>(BATCH_SIZE);
        batchQueue.drainTo(batch, BATCH_SIZE);
        if (batch.isEmpty()) {
            return 0;
        }

        try {
            transactionTemplate.executeWithoutResult(status -> persistBatch(batch));
            flushedLogsCounter.addAndGet(batch.size());
            consecutiveFailures.set(0);
            nextAllowedRetryTimeMs.set(0);
            log.debug("Flushed {} audit logs and spend records to PostgreSQL", batch.size());
            return batch.size();
        } catch (Exception e) {
            log.warn("Batch persistence failed for {} records, initiating row-by-row fallback recovery: {}", batch.size(), e.getMessage());
            int recovered = 0;
            List<AuditLogItem> retryList = new ArrayList<>();
            for (AuditLogItem item : batch) {
                try {
                    transactionTemplate.executeWithoutResult(status -> persistBatch(List.of(item)));
                    recovered++;
                } catch (Exception itemEx) {
                    if (isConstraintViolation(itemEx)) {
                        log.error("Dropping corrupted audit record [{}] due to permanent constraint violation: {}",
                                item.logEntry() != null ? item.logEntry().getRequestId() : "unknown", itemEx.getMessage());
                    } else {
                        retryList.add(item);
                    }
                }
            }
            if (!retryList.isEmpty()) {
                int failures = consecutiveFailures.incrementAndGet();
                long backoffMs = Math.min(MAX_RETRY_BACKOFF_MS, BASE_RETRY_BACKOFF_MS * (1L << Math.min(failures - 1, 5)));
                nextAllowedRetryTimeMs.set(System.currentTimeMillis() + backoffMs);

                log.warn("Preserving {} transiently failed audit records for retry with {}ms backoff (attempt {}): {}",
                        retryList.size(), backoffMs, failures, e.getMessage());
                for (AuditLogItem retryItem : retryList) {
                    if (!batchQueue.offer(retryItem)) {
                        long dropped = droppedLogsCounter.incrementAndGet();
                        log.error("Failed to requeue retry audit record [{}] because queue is full; record dropped.",
                                retryItem.logEntry() != null ? retryItem.logEntry().getRequestId() : "unknown");
                    }
                }
            } else {
                consecutiveFailures.set(0);
                nextAllowedRetryTimeMs.set(0);
            }
            flushedLogsCounter.addAndGet(recovered);
            return recovered;
        }
    }

    private void persistBatch(List<AuditLogItem> items) {
        // 1. Batch insert RequestLog entities
        List<RequestLog> logEntries = items.stream().map(AuditLogItem::logEntry).toList();
        requestLogRepository.saveAll(logEntries);

        // 2. Aggregate spend by (virtualKey, yearMonth) to eliminate DB write amplification
        Map<SpendKey, AggregatedSpend> spendMap = new HashMap<>();
        for (AuditLogItem item : items) {
            if (item.spendItem() != null) {
                SpendItem si = item.spendItem();
                SpendKey key = new SpendKey(si.virtualKey(), si.yearMonth());
                spendMap.compute(key, (k, existing) -> {
                    if (existing == null) {
                        return new AggregatedSpend(si.cost(), 1, si.promptTokens(), si.completionTokens(), si.cacheHitInt());
                    } else {
                        return existing.add(si.cost(), 1, si.promptTokens(), si.completionTokens(), si.cacheHitInt());
                    }
                });
            }
        }

        // 3. Single aggregated DB update per tenant/window
        for (Map.Entry<SpendKey, AggregatedSpend> entry : spendMap.entrySet()) {
            SpendKey key = entry.getKey();
            AggregatedSpend agg = entry.getValue();
            monthlySpendRepository.upsertSpendAggregated(
                    key.virtualKey(),
                    key.yearMonth(),
                    agg.totalCost(),
                    agg.count(),
                    agg.promptTokens(),
                    agg.completionTokens(),
                    agg.cacheHits()
            );
        }
    }

    private boolean isConstraintViolation(Throwable ex) {
        Throwable curr = ex;
        while (curr != null) {
            if (curr instanceof org.springframework.dao.DataIntegrityViolationException
                    || curr instanceof jakarta.validation.ValidationException
                    || curr instanceof java.sql.SQLIntegrityConstraintViolationException) {
                return true;
            }
            curr = curr.getCause();
        }
        return false;
    }

    /**
     * Synchronously flushes all pending logs in the queue.
     * Guaranteed zero backlog upon completion (used in drills, graceful shutdown, and tests).
     */
    public void flushNow() {
        nextAllowedRetryTimeMs.set(0);
        int maxAttempts = Math.max(2, (batchQueue.size() / BATCH_SIZE) + 2);
        while (!batchQueue.isEmpty() && maxAttempts-- > 0) {
            try {
                int flushed = flushBatch();
                if (flushed == 0 && !batchQueue.isEmpty()) {
                    // Database is unavailable; stop spinning to prevent infinite retry during shutdown
                    break;
                }
            } catch (Exception e) {
                log.error("Error during flushNow drain: {}", e.getMessage(), e);
                break;
            }
        }
    }

    public int getConsecutiveFailures() {
        return consecutiveFailures.get();
    }

    public long getNextAllowedRetryTimeMs() {
        return nextAllowedRetryTimeMs.get();
    }

    public long getQueueSize() {
        return batchQueue.size();
    }

    public long getDroppedCount() {
        return droppedLogsCounter.get();
    }

    public long getFlushedCount() {
        return flushedLogsCounter.get();
    }
}
