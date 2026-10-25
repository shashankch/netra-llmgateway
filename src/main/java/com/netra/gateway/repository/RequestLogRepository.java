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
}
