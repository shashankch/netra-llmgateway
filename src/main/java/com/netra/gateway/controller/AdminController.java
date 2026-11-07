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
import com.netra.gateway.repository.ModelPricingRepository;
import com.netra.gateway.model.entity.ModelPricing;
import java.util.Map;
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
    private final ModelPricingRepository modelPricingRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.netra.gateway.service.ProviderCircuitBreakerService providerCircuitBreakerService;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.core.env.Environment env;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.data.redis.core.StringRedisTemplate redisTemplate;

    // Short-lived, single-use stream tickets for secure EventSource connections (Issue 3 & 6)
    private final com.github.benmanes.caffeine.cache.Cache<String, Instant> streamTicketCache =
            com.github.benmanes.caffeine.cache.Caffeine.newBuilder()
                    .maximumSize(500)
                    .expireAfterWrite(java.time.Duration.ofSeconds(60))
                    .build();

    @jakarta.annotation.PostConstruct
    public void validateProductionSecurity() {
        if (env != null && java.util.Arrays.asList(env.getActiveProfiles()).contains("prod")) {
            String token = configProperties.getAdminToken();
            if (token == null || token.isBlank() || "netra-admin-demo".equals(token.trim())) {
                throw new IllegalStateException("CRITICAL SECURITY VIOLATION: Production profile (prod) requires a secure, non-demo NETRA_ADMIN_TOKEN to be configured!");
            }
        }
    }

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
     * Cache content inspector API per API_CONTRACT.md.
     * Returns detailed cached prompt/response entries, filterable by virtual key and search text.
     */
    @GetMapping("/cache/entries")
    public ResponseEntity<List<CacheEntryDetailDto>> getCacheEntries(
            @RequestParam(value = "key", required = false) String key,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "limit", defaultValue = "50") int limit,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "offset", required = false) Integer offset,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);
        int maxLimit = Math.min(Math.max(limit, 1), 200);
        int effectiveOffset = (offset != null) ? Math.max(0, offset) : Math.max(0, page) * maxLimit;
        return ResponseEntity.ok(semanticCacheService.getCacheEntries(key, search, maxLimit, effectiveOffset));
    }

    /**
     * Delete/purge a specific cache entry.
     */
    @DeleteMapping("/cache/entries/{id}")
    public ResponseEntity<Map<String, Object>> deleteCacheEntry(
            @PathVariable("id") UUID id,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);
        boolean deleted = semanticCacheService.deleteCacheEntry(id);
        return ResponseEntity.ok(Map.of("success", deleted, "id", id.toString()));
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
            if (fromInstant == null && toInstant == null) {
                summary = requestLogRepository.aggregateUsageAllTime(key);
            } else {
                summary = requestLogRepository.aggregateUsage(key, fromInstant, toInstant);
            }
        } else {
            if (fromInstant == null && toInstant == null) {
                summary = requestLogRepository.aggregateAllUsageAllTime();
            } else {
                summary = requestLogRepository.aggregateAllUsage(fromInstant, toInstant);
            }
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
     * Supports cursor/offset and page-based pagination for enterprise datasets.
     */
    @GetMapping("/logs")
    public ResponseEntity<List<RequestLog>> getRequestLogs(
            @RequestParam(value = "key", required = false) String key,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "limit", defaultValue = "50") int limit,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "offset", required = false) Integer offset,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);

        int maxLimit = Math.min(Math.max(limit, 1), 500);
        org.springframework.data.domain.Pageable pageRequest;
        int pageNumber;
        if (offset != null) {
            long exactOffset = Math.max(0, offset.longValue());
            pageRequest = new com.netra.gateway.model.dto.OffsetBasedPageRequest(exactOffset, maxLimit);
            pageNumber = (int) (exactOffset / maxLimit);
        } else {
            pageNumber = Math.max(0, page);
            pageRequest = PageRequest.of(pageNumber, maxLimit);
        }

        String cleanKey = (key != null && !key.isBlank()) ? key.trim() : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;

        Integer statusCode = null;
        String statusString = null;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())) {
            String trimmed = status.trim();
            if ("ERR".equalsIgnoreCase(trimmed)) {
                statusString = "ERR";
            } else {
                try {
                    statusCode = Integer.parseInt(trimmed);
                } catch (NumberFormatException e) {
                    statusString = trimmed;
                }
            }
        }

        List<RequestLog> logs;
        long totalCount;
        if (cleanKey == null && statusCode == null && statusString == null && cleanSearch == null) {
            logs = requestLogRepository.findAllByOrderByCreatedAtDesc(pageRequest);
            totalCount = requestLogRepository.count();
        } else if (cleanKey != null && statusCode == null && statusString == null && cleanSearch == null) {
            logs = requestLogRepository.findByVirtualKeyOrderByCreatedAtDesc(cleanKey, pageRequest);
            totalCount = requestLogRepository.countByVirtualKey(cleanKey);
        } else {
            logs = requestLogRepository.findWithFilters(cleanKey, statusCode, statusString, cleanSearch, pageRequest);
            totalCount = requestLogRepository.countWithFilters(cleanKey, statusCode, statusString, cleanSearch);
        }

        int totalPages = totalCount > 0 ? (int) Math.ceil((double) totalCount / maxLimit) : 1;

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set("X-Total-Count", String.valueOf(totalCount));
        headers.set("X-Page-Number", String.valueOf(pageNumber));
        headers.set("X-Page-Size", String.valueOf(maxLimit));
        headers.set("X-Total-Pages", String.valueOf(totalPages));
        if (offset != null) {
            headers.set("X-Offset", String.valueOf(offset));
        }

        return ResponseEntity.ok()
                .headers(headers)
                .body(logs);
    }

    /**
     * Issues a short-lived single-use ticket for secure EventSource SSE streaming (Issues 3 & 6).
     * Prevents leaking long-lived admin credentials in URL query parameters.
     */
    @PostMapping("/logs/stream-ticket")
    public ResponseEntity<Map<String, Object>> issueStreamTicket(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);
        String ticket = "stk-" + UUID.randomUUID().toString();
        if (redisTemplate != null) {
            try {
                redisTemplate.opsForValue().set("netra:stream:ticket:" + ticket, "valid", java.time.Duration.ofSeconds(60));
            } catch (Exception e) {
                log.warn("Redis stream ticket storage failed; falling back to local cache: {}", e.getMessage());
                streamTicketCache.put(ticket, Instant.now());
            }
        } else {
            streamTicketCache.put(ticket, Instant.now());
        }
        return ResponseEntity.ok(Map.of("ticket", ticket, "expires_in", 60));
    }

    /**
     * Live SSE request log stream for Ops Console real-time monitoring.
     * Supports scoped single-use ticket, standard Authorization header, and legacy query parameter.
     */
    @GetMapping(value = "/logs/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamRequestLogs(
            @RequestParam(value = "ticket", required = false) String ticket,
            @RequestParam(value = "token", required = false) String queryToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        if (authHeader != null && !authHeader.isBlank()) {
            validateAdminAuth(authHeader);
        } else if (ticket != null && !ticket.isBlank()) {
            boolean valid = false;
            String ticketKey = "netra:stream:ticket:" + ticket.trim();
            if (redisTemplate != null) {
                try {
                    Boolean deleted = redisTemplate.delete(ticketKey);
                    if (Boolean.TRUE.equals(deleted)) {
                        valid = true;
                    }
                } catch (Exception e) {
                    log.warn("Redis stream ticket lookup failed; falling back to local cache: {}", e.getMessage());
                }
            }
            if (!valid) {
                Instant created = streamTicketCache.asMap().remove(ticket.trim());
                if (created != null) {
                    valid = true;
                }
            }
            if (!valid) {
                throw new AuthenticationException("Invalid or expired stream ticket");
            }
        } else if (queryToken != null && !queryToken.isBlank()) {
            log.warn("Query parameter 'token' for /admin/logs/stream is deprecated for security reasons; use POST /admin/logs/stream-ticket");
            validateAdminAuth("Bearer " + queryToken.trim());
        } else {
            throw new AuthenticationException("Missing authentication for log stream");
        }
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

        // High-performance batch spend lookup: eliminates N+1 SQL queries across tenant keys
        final Map<String, BigDecimal> spendByVirtualKey = loadMonthlySpendMap(currentYm);

        List<TenantAdminResponse> responses = tenants.stream().map(tenant -> {
            BigDecimal currentSpend = spendByVirtualKey.get(tenant.getVirtualKey());
            if (currentSpend == null) {
                currentSpend = monthlySpendRepository
                        .findByVirtualKeyAndYearMonth(tenant.getVirtualKey(), currentYm)
                        .map(MonthlySpend::getTotalSpendUsd)
                        .orElse(BigDecimal.ZERO)
                        .setScale(6, RoundingMode.HALF_UP);
            }

            String status;
            if (!tenant.isActive()) {
                status = "REVOKED";
            } else if (tenant.getMonthlyBudgetUsd().compareTo(BigDecimal.ZERO) >= 0
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
                .modelAllowlist(request.getModelAllowlist() != null ? request.getModelAllowlist() : List.of("fast", "smart", "auto"))
                .semanticCacheEnabled(request.getSemanticCacheEnabled() != null ? request.getSemanticCacheEnabled() : true)
                .similarityThreshold(request.getSimilarityThreshold() != null ? request.getSimilarityThreshold().setScale(3, RoundingMode.HALF_UP) : new BigDecimal("0.850"))
                .isActive(true)
                .createdAt(Instant.now())
                .build();

        Tenant saved = tenantRepository.save(tenant);
        tenantAuthService.invalidate(saved.getVirtualKey());
        if (saved.isActive()) {
            tenantAuthService.unrevoke(saved.getVirtualKey());
        } else {
            tenantAuthService.revoke(saved.getVirtualKey());
        }

        String initialStatus = !saved.isActive() ? "REVOKED"
                : (saved.getMonthlyBudgetUsd().compareTo(BigDecimal.ZERO) >= 0 && BigDecimal.ZERO.compareTo(saved.getMonthlyBudgetUsd()) >= 0)
                ? "EXHAUSTED" : "ACTIVE";

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
                .status(initialStatus)
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
        if (saved.isActive()) {
            tenantAuthService.unrevoke(saved.getVirtualKey());
        } else {
            tenantAuthService.revoke(saved.getVirtualKey());
        }

        String currentYm = YearMonth.now().toString();
        BigDecimal currentSpend = monthlySpendRepository
                .findByVirtualKeyAndYearMonth(saved.getVirtualKey(), currentYm)
                .map(MonthlySpend::getTotalSpendUsd)
                .orElse(BigDecimal.ZERO)
                .setScale(6, RoundingMode.HALF_UP);

        String status = !saved.isActive() ? "REVOKED"
                : (saved.getMonthlyBudgetUsd().compareTo(BigDecimal.ZERO) >= 0 && currentSpend.compareTo(saved.getMonthlyBudgetUsd()) >= 0)
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
        tenantAuthService.revoke(tenant.getVirtualKey());

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

    /**
     * Dynamic Models and Pricing Catalog API: Returns configured model aliases, active pricing rates, and providers.
     */
    @GetMapping("/pricing")
    public ResponseEntity<Map<String, Object>> getModelPricingCatalog(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);

        List<ModelPricing> models = modelPricingRepository.findAll();
        Map<String, ModelPricing> modelMap = models.stream()
                .collect(java.util.stream.Collectors.toMap(ModelPricing::getModel, m -> m, (a, b) -> a));

        Map<String, Object> aliases = new java.util.LinkedHashMap<>();
        if (configProperties.getModelAliases() != null) {
            for (Map.Entry<String, GatewayConfigProperties.ModelAliasConfig> entry : configProperties.getModelAliases().entrySet()) {
                String alias = entry.getKey();
                GatewayConfigProperties.ModelAliasConfig cfg = entry.getValue();
                Map<String, Object> aliasData = new java.util.LinkedHashMap<>();
                aliasData.put("primary", cfg.getPrimary());
                aliasData.put("fallbacks", cfg.getFallbacks());
                if (cfg.getRouteByDifficulty() != null) {
                    aliasData.put("route_by_difficulty", cfg.getRouteByDifficulty());
                }
                if (cfg.getPrimary() != null) {
                    String primary = cfg.getPrimary().trim();
                    String lookupKey = primary;
                    if (lookupKey.contains(":")) {
                        lookupKey = lookupKey.substring(lookupKey.indexOf(":") + 1).trim();
                    }
                    ModelPricing mp = modelMap.get(primary);
                    if (mp == null) {
                        mp = modelMap.get(lookupKey);
                    }
                    if (mp != null) {
                        aliasData.put("input_per_1m", mp.getInputPer1m());
                        aliasData.put("output_per_1m", mp.getOutputPer1m());
                        aliasData.put("inputPer1m", mp.getInputPer1m());
                        aliasData.put("outputPer1m", mp.getOutputPer1m());
                        aliasData.put("provider", mp.getProvider());
                    }
                }
                aliases.put(alias, aliasData);
            }
        }

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("aliases", aliases);
        response.put("models", models);

        return ResponseEntity.ok(response);
    }

    /**
     * Provider Health API (GET /admin/providers/health) per Phase 7.3.
     * Exposes live health snapshots, circuit breaker states, rolling error rates, and p95 latency.
     */
    @GetMapping("/providers/health")
    public ResponseEntity<List<ProviderHealthSnapshot>> getProviderHealth(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        validateAdminAuth(authHeader);
        if (providerCircuitBreakerService != null) {
            return ResponseEntity.ok(providerCircuitBreakerService.getProviderHealthSnapshots());
        }
        return ResponseEntity.ok(List.of());
    }

    private Map<String, BigDecimal> loadMonthlySpendMap(String currentYm) {
        try {
            List<MonthlySpend> batchSpend = monthlySpendRepository.findByYearMonth(currentYm);
            if (batchSpend != null && !batchSpend.isEmpty()) {
                return batchSpend.stream().collect(java.util.stream.Collectors.toMap(
                        MonthlySpend::getVirtualKey,
                        ms -> ms.getTotalSpendUsd() != null ? ms.getTotalSpendUsd().setScale(6, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(6, RoundingMode.HALF_UP),
                        (existing, replacement) -> existing
                ));
            }
        } catch (Exception ex) {
            log.debug("Batch spend lookup fallback: {}", ex.getMessage());
        }
        return Map.of();
    }

    private void validateAdminAuth(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AuthenticationException("Missing or invalid Authorization header for admin access");
        }

        String configuredToken = configProperties.getAdminToken();
        boolean hasCustomConfig = configuredToken != null && !configuredToken.isBlank() && !"netra-admin-demo".equals(configuredToken);

        String token = authHeader.substring(7).trim();
        byte[] tokenBytes = token.getBytes(java.nio.charset.StandardCharsets.UTF_8);

        if (hasCustomConfig) {
            byte[] configuredBytes = configuredToken.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (java.security.MessageDigest.isEqual(tokenBytes, configuredBytes)) {
                return;
            }
        } else {
            byte[] demoBytes = "netra-admin-demo".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (java.security.MessageDigest.isEqual(tokenBytes, demoBytes)) {
                return;
            }
        }

        throw new AuthenticationException("Unauthorized admin access");
    }
}
