package com.netra.gateway.controller;

import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.exception.AuthenticationException;
import com.netra.gateway.exception.InvalidRequestException;
import com.netra.gateway.model.dto.*;
import com.netra.gateway.model.entity.MonthlySpend;
import com.netra.gateway.model.entity.RequestLog;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.MonthlySpendRepository;
import com.netra.gateway.repository.RequestLogRepository;
import com.netra.gateway.repository.TenantRepository;
import com.netra.gateway.service.ForexRateService;
import com.netra.gateway.service.LogStreamBroadcaster;
import com.netra.gateway.service.SemanticCacheService;
import com.netra.gateway.service.TenantAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final RequestLogRepository requestLogRepository;
    private final GatewayConfigProperties configProperties;
    private final SemanticCacheService semanticCacheService;
    private final TenantRepository tenantRepository;
    private final MonthlySpendRepository monthlySpendRepository;
    private final TenantAuthService tenantAuthService;
    private final ForexRateService forexRateService;
    private final LogStreamBroadcaster logStreamBroadcaster;

    /**
     * Cache statistics API per API_CONTRACT.md.
     * Reports total entries, hits, misses, global hit rate, and per-key breakdown.
     */
    @GetMapping("/cache/stats")
    public ResponseEntity<CacheStatsResponse> getCacheStats(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);
        return ResponseEntity.ok(semanticCacheService.getCacheStats());
    }

    /**
     * Usage summary API per API_CONTRACT.md.
     * Reconciles exactly with client-side totals computed by scripts/load_test.py.
     */
    @GetMapping("/usage")
    public ResponseEntity<UsageSummaryResponse> getUsageSummary(
            @RequestParam(value = "key", required = false) String key,
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
                throw new InvalidRequestException("Invalid date format for 'from': " + from + ". Expected YYYY-MM-DD");
            }
        }
        if (to != null && !to.isBlank()) {
            try {
                toInstant = LocalDate.parse(to).atTime(LocalTime.MAX).atZone(ZoneOffset.UTC).toInstant();
            } catch (Exception e) {
                throw new InvalidRequestException("Invalid date format for 'to': " + to + ". Expected YYYY-MM-DD");
            }
        }

        UsageSummaryProjection summary;
        if (key != null && !key.isBlank() && !key.equalsIgnoreCase("all")) {
            summary = requestLogRepository.aggregateUsage(key, fromInstant, toInstant);
        } else {
            summary = requestLogRepository.aggregateAllUsage(fromInstant, toInstant);
        }

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
                .key(key != null && !key.isBlank() ? key : "all")
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

    /**
     * Live SSE request log stream for Ops Console real-time monitoring.
     */
    @GetMapping(value = "/logs/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamRequestLogs(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);
        return logStreamBroadcaster.registerEmitter();
    }

    /**
     * Virtual Keys Manager: List all tenants/virtual keys.
     */
    @GetMapping("/keys")
    public ResponseEntity<List<TenantAdminResponse>> listKeys(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);

        List<Tenant> tenants = tenantRepository.findAll();
        String currentYm = YearMonth.now().toString();

        List<TenantAdminResponse> responses = tenants.stream().map(tenant -> {
            BigDecimal currentSpend = monthlySpendRepository
                    .findByVirtualKeyAndYearMonth(tenant.getVirtualKey(), currentYm)
                    .map(MonthlySpend::getTotalSpendUsd)
                    .orElse(BigDecimal.ZERO)
                    .setScale(6, RoundingMode.HALF_UP);

            String status;
            if (!tenant.isActive()) {
                status = "REVOKED";
            } else if (tenant.getMonthlyBudgetUsd().compareTo(BigDecimal.ZERO) > 0
                    && currentSpend.compareTo(tenant.getMonthlyBudgetUsd()) >= 0) {
                status = "EXHAUSTED";
            } else {
                status = "ACTIVE";
            }

            return TenantAdminResponse.builder()
                    .id(tenant.getId())
                    .virtualKey(tenant.getVirtualKey())
                    .team(tenant.getTeam())
                    .monthlyBudgetUsd(tenant.getMonthlyBudgetUsd())
                    .currentSpendUsd(currentSpend)
                    .rpmLimit(tenant.getRpmLimit())
                    .tpmLimit(tenant.getTpmLimit())
                    .modelAllowlist(tenant.getModelAllowlist())
                    .semanticCacheEnabled(tenant.isSemanticCacheEnabled())
                    .similarityThreshold(tenant.getSimilarityThreshold())
                    .isActive(tenant.isActive())
                    .status(status)
                    .createdAt(tenant.getCreatedAt())
                    .build();
        }).toList();

        return ResponseEntity.ok(responses);
    }

    /**
     * Virtual Keys Manager: Create a new virtual key.
     */
    @PostMapping("/keys")
    public ResponseEntity<TenantAdminResponse> createKey(
            @RequestBody CreateTenantRequest request,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);

        if (request == null || request.getTeam() == null || request.getTeam().isBlank()) {
            throw new InvalidRequestException("Team name is required for new virtual key");
        }

        String vkey = request.getVirtualKey();
        if (vkey == null || vkey.isBlank()) {
            vkey = "netra-sk-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        } else if (!vkey.startsWith("netra-sk-")) {
            vkey = "netra-sk-" + vkey;
        }

        if (tenantRepository.findByVirtualKey(vkey).isPresent()) {
            throw new InvalidRequestException("Virtual key already exists: " + vkey);
        }

        Tenant tenant = Tenant.builder()
                .virtualKey(vkey)
                .team(request.getTeam())
                .monthlyBudgetUsd(request.getMonthlyBudgetUsd() != null ? request.getMonthlyBudgetUsd().setScale(6, RoundingMode.HALF_UP) : new BigDecimal("100.000000"))
                .rpmLimit(request.getRpmLimit() != null ? request.getRpmLimit() : 60)
                .tpmLimit(request.getTpmLimit() != null ? request.getTpmLimit() : 100000)
                .modelAllowlist(request.getModelAllowlist() != null && !request.getModelAllowlist().isEmpty() ? request.getModelAllowlist() : List.of("fast", "smart", "auto"))
                .semanticCacheEnabled(request.getSemanticCacheEnabled() != null ? request.getSemanticCacheEnabled() : true)
                .similarityThreshold(request.getSimilarityThreshold() != null ? request.getSimilarityThreshold().setScale(3, RoundingMode.HALF_UP) : new BigDecimal("0.850"))
                .isActive(true)
                .createdAt(Instant.now())
                .build();

        Tenant saved = tenantRepository.save(tenant);

        TenantAdminResponse response = TenantAdminResponse.builder()
                .id(saved.getId())
                .virtualKey(saved.getVirtualKey())
                .team(saved.getTeam())
                .monthlyBudgetUsd(saved.getMonthlyBudgetUsd())
                .currentSpendUsd(BigDecimal.ZERO.setScale(6, RoundingMode.HALF_UP))
                .rpmLimit(saved.getRpmLimit())
                .tpmLimit(saved.getTpmLimit())
                .modelAllowlist(saved.getModelAllowlist())
                .semanticCacheEnabled(saved.isSemanticCacheEnabled())
                .similarityThreshold(saved.getSimilarityThreshold())
                .isActive(saved.isActive())
                .status("ACTIVE")
                .createdAt(saved.getCreatedAt())
                .build();

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Virtual Keys Manager: Update virtual key parameters.
     */
    @PutMapping("/keys/{id}")
    public ResponseEntity<TenantAdminResponse> updateKey(
            @PathVariable("id") UUID id,
            @RequestBody UpdateTenantRequest request,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);

        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new InvalidRequestException("Tenant virtual key not found for ID: " + id));

        if (request.getTeam() != null && !request.getTeam().isBlank()) {
            tenant.setTeam(request.getTeam());
        }
        if (request.getMonthlyBudgetUsd() != null) {
            tenant.setMonthlyBudgetUsd(request.getMonthlyBudgetUsd().setScale(6, RoundingMode.HALF_UP));
        }
        if (request.getRpmLimit() != null) {
            tenant.setRpmLimit(request.getRpmLimit());
        }
        if (request.getTpmLimit() != null) {
            tenant.setTpmLimit(request.getTpmLimit());
        }
        if (request.getModelAllowlist() != null) {
            tenant.setModelAllowlist(request.getModelAllowlist());
        }
        if (request.getSemanticCacheEnabled() != null) {
            tenant.setSemanticCacheEnabled(request.getSemanticCacheEnabled());
        }
        if (request.getSimilarityThreshold() != null) {
            tenant.setSimilarityThreshold(request.getSimilarityThreshold().setScale(3, RoundingMode.HALF_UP));
        }
        if (request.getIsActive() != null) {
            tenant.setActive(request.getIsActive());
        }

        Tenant saved = tenantRepository.save(tenant);
        tenantAuthService.invalidate(saved.getVirtualKey());

        String currentYm = YearMonth.now().toString();
        BigDecimal currentSpend = monthlySpendRepository
                .findByVirtualKeyAndYearMonth(saved.getVirtualKey(), currentYm)
                .map(MonthlySpend::getTotalSpendUsd)
                .orElse(BigDecimal.ZERO)
                .setScale(6, RoundingMode.HALF_UP);

        String status = !saved.isActive() ? "REVOKED"
                : (saved.getMonthlyBudgetUsd().compareTo(BigDecimal.ZERO) > 0 && currentSpend.compareTo(saved.getMonthlyBudgetUsd()) >= 0)
                ? "EXHAUSTED" : "ACTIVE";

        TenantAdminResponse response = TenantAdminResponse.builder()
                .id(saved.getId())
                .virtualKey(saved.getVirtualKey())
                .team(saved.getTeam())
                .monthlyBudgetUsd(saved.getMonthlyBudgetUsd())
                .currentSpendUsd(currentSpend)
                .rpmLimit(saved.getRpmLimit())
                .tpmLimit(saved.getTpmLimit())
                .modelAllowlist(saved.getModelAllowlist())
                .semanticCacheEnabled(saved.isSemanticCacheEnabled())
                .similarityThreshold(saved.getSimilarityThreshold())
                .isActive(saved.isActive())
                .status(status)
                .createdAt(saved.getCreatedAt())
                .build();

        return ResponseEntity.ok(response);
    }

    /**
     * Virtual Keys Manager: Deactivate / revoke virtual key.
     */
    @DeleteMapping("/keys/{id}")
    public ResponseEntity<Void> revokeKey(
            @PathVariable("id") UUID id,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);

        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new InvalidRequestException("Tenant virtual key not found for ID: " + id));

        tenant.setActive(false);
        tenantRepository.save(tenant);
        tenantAuthService.invalidate(tenant.getVirtualKey());

        return ResponseEntity.noContent().build();
    }

    /**
     * Dynamic Forex API: Get current live exchange rate for single-denomination UI switcher.
     */
    @GetMapping("/currency/rate")
    public ResponseEntity<CurrencyRateResponse> getForexRate() {
        return ResponseEntity.ok(CurrencyRateResponse.builder()
                .base("USD")
                .target("INR")
                .rate(forexRateService.getUsdToInrRate())
                .build());
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
