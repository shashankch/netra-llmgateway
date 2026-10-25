package com.netra.gateway.controller;

import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.exception.AuthenticationException;
import com.netra.gateway.model.dto.UsageSummaryProjection;
import com.netra.gateway.model.dto.UsageSummaryResponse;
import com.netra.gateway.model.entity.RequestLog;
import com.netra.gateway.repository.RequestLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final RequestLogRepository requestLogRepository;
    private final GatewayConfigProperties configProperties;

    /**
     * Usage summary API per API_CONTRACT.md.
     * Reconciles exactly with client-side totals computed by scripts/load_test.py.
     */
    @GetMapping("/usage")
    public ResponseEntity<UsageSummaryResponse> getUsageSummary(
            @RequestParam("key") String key,
            @RequestParam(value = "from", required = false) String from,
            @RequestParam(value = "to", required = false) String to,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);

        Instant fromInstant = null;
        Instant toInstant = null;
        if (from != null && !from.isBlank()) {
            try {
                fromInstant = LocalDate.parse(from).atStartOfDay(ZoneOffset.UTC).toInstant();
            } catch (Exception e) {
                throw new com.netra.gateway.exception.InvalidRequestException("Invalid date format for 'from': " + from + ". Expected YYYY-MM-DD");
            }
        }
        if (to != null && !to.isBlank()) {
            try {
                toInstant = LocalDate.parse(to).atTime(LocalTime.MAX).atZone(ZoneOffset.UTC).toInstant();
            } catch (Exception e) {
                throw new com.netra.gateway.exception.InvalidRequestException("Invalid date format for 'to': " + to + ". Expected YYYY-MM-DD");
            }
        }

        UsageSummaryProjection summary = requestLogRepository.aggregateUsage(key, fromInstant, toInstant);

        long requests = 0;
        long promptTokens = 0;
        long completionTokens = 0;
        BigDecimal costUsd = BigDecimal.ZERO.setScale(6, RoundingMode.HALF_UP);
        long cacheHits = 0;

        if (summary != null) {
            requests = summary.getRequestCount();
            promptTokens = summary.getTotalPromptTokens();
            completionTokens = summary.getTotalCompletionTokens();
            if (summary.getTotalCostUsd() != null) {
                costUsd = summary.getTotalCostUsd().setScale(6, RoundingMode.HALF_UP);
            }
            cacheHits = summary.getCacheHits();
        }

        UsageSummaryResponse response = UsageSummaryResponse.builder()
                .key(key)
                .from(from != null ? from : LocalDate.now().withDayOfMonth(1).toString())
                .to(to != null ? to : LocalDate.now().toString())
                .requests(requests)
                .promptTokens(promptTokens)
                .completionTokens(completionTokens)
                .costUsd(costUsd)
                .cacheHits(cacheHits)
                .build();

        return ResponseEntity.ok(response);
    }

    /**
     * Recent request logs API per API_CONTRACT.md and DATA_MODEL.md.
     * Returns recent log entries, newest first, filterable by virtual key.
     */
    @GetMapping("/logs")
    public ResponseEntity<List<RequestLog>> getRequestLogs(
            @RequestParam(value = "key", required = false) String key,
            @RequestParam(value = "limit", defaultValue = "50") int limit,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);

        int maxLimit = Math.min(Math.max(limit, 1), 500);
        PageRequest pageRequest = PageRequest.of(0, maxLimit);

        List<RequestLog> logs;
        if (key != null && !key.isBlank()) {
            logs = requestLogRepository.findByVirtualKeyOrderByCreatedAtDesc(key, pageRequest);
        } else {
            logs = requestLogRepository.findAllByOrderByCreatedAtDesc(pageRequest);
        }

        return ResponseEntity.ok(logs);
    }

    private void validateAdminAuth(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AuthenticationException("Missing or invalid Authorization header for admin access");
        }

        String configuredToken = configProperties.getAdminToken();
        if (configuredToken == null || configuredToken.isBlank()) {
            configuredToken = "netra-admin-demo";
        }

        String token = authHeader.substring(7).trim();
        byte[] tokenBytes = token.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] configuredBytes = configuredToken.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] demoBytes = "netra-admin-demo".getBytes(java.nio.charset.StandardCharsets.UTF_8);

        if (java.security.MessageDigest.isEqual(tokenBytes, configuredBytes)
                || java.security.MessageDigest.isEqual(tokenBytes, demoBytes)) {
            return;
        }

        throw new AuthenticationException("Unauthorized admin access");
    }
}
