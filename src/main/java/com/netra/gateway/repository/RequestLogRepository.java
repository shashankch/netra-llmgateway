package com.netra.gateway.repository;

import com.netra.gateway.model.dto.UsageSummaryProjection;
import com.netra.gateway.model.entity.RequestLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface RequestLogRepository extends JpaRepository<RequestLog, UUID> {

    List<RequestLog> findByVirtualKeyOrderByCreatedAtDesc(String virtualKey, Pageable pageable);

    List<RequestLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    long countByVirtualKey(String virtualKey);

    @Query("SELECT r FROM RequestLog r WHERE " +
            "(:key IS NULL OR :key = '' OR r.virtualKey = :key) AND " +
            "(:statusCode IS NULL OR r.statusCode = :statusCode) AND " +
            "(:status IS NULL OR :status = '' OR " +
            "  (:status = 'ERR' AND r.statusCode <> 200) OR " +
            "  (r.status = :status)) AND " +
            "(:search IS NULL OR :search = '' OR " +
            "  LOWER(r.requestId) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "  LOWER(r.virtualKey) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "  LOWER(r.requestedModel) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "  (r.routeReason IS NOT NULL AND LOWER(r.routeReason) LIKE LOWER(CONCAT('%', :search, '%')))) " +
            "ORDER BY r.createdAt DESC")
    List<RequestLog> findWithFilters(
            @Param("key") String key,
            @Param("statusCode") Integer statusCode,
            @Param("status") String status,
            @Param("search") String search,
            Pageable pageable);

    @Query("SELECT COUNT(r) FROM RequestLog r WHERE " +
            "(:key IS NULL OR :key = '' OR r.virtualKey = :key) AND " +
            "(:statusCode IS NULL OR r.statusCode = :statusCode) AND " +
            "(:status IS NULL OR :status = '' OR " +
            "  (:status = 'ERR' AND r.statusCode <> 200) OR " +
            "  (r.status = :status)) AND " +
            "(:search IS NULL OR :search = '' OR " +
            "  LOWER(r.requestId) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "  LOWER(r.virtualKey) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "  LOWER(r.requestedModel) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "  (r.routeReason IS NOT NULL AND LOWER(r.routeReason) LIKE LOWER(CONCAT('%', :search, '%'))))")
    long countWithFilters(
            @Param("key") String key,
            @Param("statusCode") Integer statusCode,
            @Param("status") String status,
            @Param("search") String search);

    @Query("SELECT COUNT(r) FROM RequestLog r WHERE r.virtualKey = :virtualKey AND r.statusCode = 200")
    long countTotalRequestsByVirtualKey(@Param("virtualKey") String virtualKey);

    @Query("SELECT COUNT(r) FROM RequestLog r WHERE r.virtualKey = :virtualKey AND r.cache = 'hit' AND r.statusCode = 200")
    long countCacheHitsByVirtualKey(@Param("virtualKey") String virtualKey);

    @Query("SELECT COUNT(r) AS requestCount, " +
            "COALESCE(SUM(r.promptTokens), 0L) AS totalPromptTokens, " +
            "COALESCE(SUM(r.completionTokens), 0L) AS totalCompletionTokens, " +
            "COALESCE(SUM(r.costUsd), 0.0) AS totalCostUsd, " +
            "COALESCE(SUM(CASE WHEN r.cache = 'hit' THEN 1L ELSE 0L END), 0L) AS cacheHits " +
            "FROM RequestLog r " +
            "WHERE r.virtualKey = :virtualKey " +
            "AND r.statusCode = 200")
    UsageSummaryProjection aggregateUsageAllTime(@Param("virtualKey") String virtualKey);

    @Query("SELECT COUNT(r) AS requestCount, " +
            "COALESCE(SUM(r.promptTokens), 0L) AS totalPromptTokens, " +
            "COALESCE(SUM(r.completionTokens), 0L) AS totalCompletionTokens, " +
            "COALESCE(SUM(r.costUsd), 0.0) AS totalCostUsd, " +
            "COALESCE(SUM(CASE WHEN r.cache = 'hit' THEN 1L ELSE 0L END), 0L) AS cacheHits " +
            "FROM RequestLog r " +
            "WHERE r.statusCode = 200")
    UsageSummaryProjection aggregateAllUsageAllTime();

    @Query("SELECT COUNT(r) AS requestCount, " +
            "COALESCE(SUM(r.promptTokens), 0) AS totalPromptTokens, " +
            "COALESCE(SUM(r.completionTokens), 0) AS totalCompletionTokens, " +
            "COALESCE(SUM(r.costUsd), 0.0) AS totalCostUsd, " +
            "COALESCE(SUM(CASE WHEN r.cache = 'hit' THEN 1L ELSE 0L END), 0L) AS cacheHits " +
            "FROM RequestLog r " +
            "WHERE r.virtualKey = :virtualKey " +
            "AND r.statusCode = 200 " +
            "AND (:fromTime IS NULL OR r.createdAt >= :fromTime) " +
            "AND (:toTime IS NULL OR r.createdAt <= :toTime)")
    UsageSummaryProjection aggregateUsage(
            @Param("virtualKey") String virtualKey,
            @Param("fromTime") Instant fromTime,
            @Param("toTime") Instant toTime);

    @Query("SELECT COUNT(r) AS requestCount, " +
            "COALESCE(SUM(r.promptTokens), 0) AS totalPromptTokens, " +
            "COALESCE(SUM(r.completionTokens), 0) AS totalCompletionTokens, " +
            "COALESCE(SUM(r.costUsd), 0.0) AS totalCostUsd, " +
            "COALESCE(SUM(CASE WHEN r.cache = 'hit' THEN 1L ELSE 0L END), 0L) AS cacheHits " +
            "FROM RequestLog r " +
            "WHERE r.statusCode = 200 " +
            "AND (:fromTime IS NULL OR r.createdAt >= :fromTime) " +
            "AND (:toTime IS NULL OR r.createdAt <= :toTime)")
    UsageSummaryProjection aggregateAllUsage(
            @Param("fromTime") Instant fromTime,
            @Param("toTime") Instant toTime);
}
