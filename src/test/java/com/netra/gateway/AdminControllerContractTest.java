package com.netra.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.config.JacksonConfig;
import com.netra.gateway.controller.AdminController;
import com.netra.gateway.model.dto.CreateTenantRequest;
import com.netra.gateway.model.dto.UpdateTenantRequest;
import com.netra.gateway.model.dto.UsageSummaryProjection;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminController.class)
@Import(JacksonConfig.class)
@EnableConfigurationProperties(GatewayConfigProperties.class)
class AdminControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private RequestLogRepository requestLogRepository;

    @MockitoBean
    private SemanticCacheService semanticCacheService;

    @MockitoBean
    private TenantRepository tenantRepository;

    @MockitoBean
    private MonthlySpendRepository monthlySpendRepository;

    @MockitoBean
    private TenantAuthService tenantAuthService;

    @MockitoBean
    private ForexRateService forexRateService;

    @MockitoBean
    private LogStreamBroadcaster logStreamBroadcaster;

    @Test
    @DisplayName("GET /admin/usage returns 200 with reconciled metrics")
    void testGetUsageSummary() throws Exception {
        UsageSummaryProjection mockProjection = new UsageSummaryProjection() {
            @Override
            public long getRequestCount() {
                return 42L;
            }

            @Override
            public long getTotalPromptTokens() {
                return 420L;
            }

            @Override
            public long getTotalCompletionTokens() {
                return 840L;
            }

            @Override
            public BigDecimal getTotalCostUsd() {
                return new BigDecimal("0.001234");
            }

            @Override
            public long getCacheHits() {
                return 10L;
            }
        };

        when(requestLogRepository.aggregateUsage(eq("netra-sk-search-1a2b3c"), any(), any()))
                .thenReturn(mockProjection);

        mockMvc.perform(get("/admin/usage")
                        .param("key", "netra-sk-search-1a2b3c")
                        .param("from", "2026-10-01")
                        .param("to", "2026-10-31")
                        .header("Authorization", "Bearer netra-admin-demo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.key").value("netra-sk-search-1a2b3c"))
                .andExpect(jsonPath("$.from").value("2026-10-01"))
                .andExpect(jsonPath("$.to").value("2026-10-31"))
                .andExpect(jsonPath("$.requests").value(42))
                .andExpect(jsonPath("$.prompt_tokens").value(420))
                .andExpect(jsonPath("$.completion_tokens").value(840))
                .andExpect(jsonPath("$.cost_usd").value(0.001234))
                .andExpect(jsonPath("$.cache_hits").value(10));
    }

    @Test
    @DisplayName("GET /admin/logs returns 200 with recent request log entries")
    void testGetRequestLogs() throws Exception {
        RequestLog entry = RequestLog.builder()
                .id(UUID.randomUUID())
                .requestId("req_test123")
                .virtualKey("netra-sk-search-1a2b3c")
                .requestedModel("fast")
                .resolvedProvider("alpha")
                .resolvedModel("alpha-small")
                .status("ok")
                .statusCode(200)
                .promptTokens(10)
                .completionTokens(20)
                .costUsd(new BigDecimal("0.000015"))
                .cache("miss")
                .fallback(false)
                .routeReason("direct")
                .retries(0)
                .latencyMs(45L)
                .isStream(false)
                .createdAt(Instant.now())
                .build();

        when(requestLogRepository.findAllByOrderByCreatedAtDesc(any(PageRequest.class)))
                .thenReturn(List.of(entry));

        mockMvc.perform(get("/admin/logs")
                        .header("Authorization", "Bearer netra-admin-demo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].request_id").value("req_test123"))
                .andExpect(jsonPath("$[0].virtual_key").value("netra-sk-search-1a2b3c"))
                .andExpect(jsonPath("$[0].status_code").value(200));
    }

    @Test
    @DisplayName("Invalid admin token returns 401 Unauthorized")
    void testInvalidAdminToken() throws Exception {
        mockMvc.perform(get("/admin/usage")
                        .param("key", "netra-sk-search-1a2b3c")
                        .header("Authorization", "Bearer wrong-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.type").value("authentication_error"))
                .andExpect(jsonPath("$.error.message").value("Unauthorized admin access"));
    }

    @Test
    @DisplayName("Missing Authorization header on admin route returns 401 Unauthorized")
    void testMissingAdminToken() throws Exception {
        mockMvc.perform(get("/admin/usage")
                        .param("key", "netra-sk-search-1a2b3c"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.type").value("authentication_error"))
                .andExpect(jsonPath("$.error.message").value("Missing or invalid Authorization header for admin access"));
    }

    @Test
    @DisplayName("Invalid date format in from parameter returns HTTP 400 invalid_request_error")
    void testInvalidDateFormatReturns400() throws Exception {
        mockMvc.perform(get("/admin/usage")
                        .param("key", "netra-sk-search-1a2b3c")
                        .param("from", "not-a-valid-date")
                        .header("Authorization", "Bearer netra-admin-demo"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.type").value("invalid_request_error"))
                .andExpect(jsonPath("$.error.message").value("Invalid date format for 'from': not-a-valid-date. Expected YYYY-MM-DD"));
    }

    @Test
    @DisplayName("GET /admin/cache/stats returns 200 with cache metrics and per-key breakdown")
    void testGetCacheStats() throws Exception {
        com.netra.gateway.model.dto.CacheStatsResponse mockStats = com.netra.gateway.model.dto.CacheStatsResponse.builder()
                .totalEntries(150L)
                .totalHits(120L)
                .totalMisses(30L)
                .hitRate(0.80)
                .keys(java.util.Map.of("netra-sk-search-1a2b3c", com.netra.gateway.model.dto.CacheStatsResponse.KeyCacheStats.builder()
                        .entries(150L)
                        .hits(120L)
                        .misses(30L)
                        .hitRate(0.80)
                        .build()))
                .build();

        when(semanticCacheService.getCacheStats()).thenReturn(mockStats);

        mockMvc.perform(get("/admin/cache/stats")
                        .header("Authorization", "Bearer netra-admin-demo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total_entries").value(150))
                .andExpect(jsonPath("$.total_hits").value(120))
                .andExpect(jsonPath("$.total_misses").value(30))
                .andExpect(jsonPath("$.hit_rate").value(0.80))
                .andExpect(jsonPath("$.keys.['netra-sk-search-1a2b3c'].entries").value(150))
                .andExpect(jsonPath("$.keys.['netra-sk-search-1a2b3c'].hits").value(120));
    }

    @Test
    @DisplayName("GET /admin/keys returns 200 with tenant list and status")
    void testListKeys() throws Exception {
        Tenant tenant = Tenant.builder()
                .id(UUID.randomUUID())
                .virtualKey("netra-sk-search-1a2b3c")
                .team("Search Team")
                .monthlyBudgetUsd(new BigDecimal("100.000000"))
                .rpmLimit(60)
                .tpmLimit(100000)
                .modelAllowlist(List.of("fast"))
                .semanticCacheEnabled(true)
                .similarityThreshold(new BigDecimal("0.920"))
                .isActive(true)
                .createdAt(Instant.now())
                .build();

        when(tenantRepository.findAll()).thenReturn(List.of(tenant));
        when(monthlySpendRepository.findByVirtualKeyAndYearMonth(eq("netra-sk-search-1a2b3c"), any()))
                .thenReturn(Optional.of(MonthlySpend.builder()
                        .virtualKey("netra-sk-search-1a2b3c")
                        .yearMonth(YearMonth.now().toString())
                        .totalSpendUsd(new BigDecimal("12.500000"))
                        .build()));

        mockMvc.perform(get("/admin/keys")
                        .header("Authorization", "Bearer netra-admin-demo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].virtual_key").value("netra-sk-search-1a2b3c"))
                .andExpect(jsonPath("$[0].team").value("Search Team"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$[0].current_spend_usd").value(12.500000));
    }

    @Test
    @DisplayName("POST /admin/keys creates a new tenant key")
    void testCreateKey() throws Exception {
        CreateTenantRequest request = CreateTenantRequest.builder()
                .virtualKey("netra-sk-test-newkey")
                .team("Test Core Team")
                .monthlyBudgetUsd(new BigDecimal("50.000000"))
                .rpmLimit(30)
                .modelAllowlist(List.of("fast", "smart"))
                .semanticCacheEnabled(true)
                .similarityThreshold(new BigDecimal("0.880"))
                .build();

        Tenant savedTenant = Tenant.builder()
                .id(UUID.randomUUID())
                .virtualKey("netra-sk-test-newkey")
                .team("Test Core Team")
                .monthlyBudgetUsd(new BigDecimal("50.000000"))
                .rpmLimit(30)
                .tpmLimit(100000)
                .modelAllowlist(List.of("fast", "smart"))
                .semanticCacheEnabled(true)
                .similarityThreshold(new BigDecimal("0.880"))
                .isActive(true)
                .createdAt(Instant.now())
                .build();

        when(tenantRepository.findByVirtualKey("netra-sk-test-newkey")).thenReturn(Optional.empty());
        when(tenantRepository.save(any(Tenant.class))).thenReturn(savedTenant);

        mockMvc.perform(post("/admin/keys")
                        .header("Authorization", "Bearer netra-admin-demo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.virtual_key").value("netra-sk-test-newkey"))
                .andExpect(jsonPath("$.team").value("Test Core Team"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("PUT /admin/keys/{id} updates tenant key parameters")
    void testUpdateKey() throws Exception {
        UUID id = UUID.randomUUID();
        Tenant existing = Tenant.builder()
                .id(id)
                .virtualKey("netra-sk-search-1a2b3c")
                .team("Search Team")
                .monthlyBudgetUsd(new BigDecimal("100.000000"))
                .rpmLimit(60)
                .modelAllowlist(List.of("fast"))
                .semanticCacheEnabled(true)
                .similarityThreshold(new BigDecimal("0.920"))
                .isActive(true)
                .build();

        UpdateTenantRequest updateRequest = UpdateTenantRequest.builder()
                .rpmLimit(120)
                .monthlyBudgetUsd(new BigDecimal("250.000000"))
                .build();

        when(tenantRepository.findById(id)).thenReturn(Optional.of(existing));
        when(tenantRepository.save(any(Tenant.class))).thenReturn(existing);

        mockMvc.perform(put("/admin/keys/" + id)
                        .header("Authorization", "Bearer netra-admin-demo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rpm_limit").value(120))
                .andExpect(jsonPath("$.monthly_budget_usd").value(250.0));

        verify(tenantAuthService).invalidate("netra-sk-search-1a2b3c");
    }

    @Test
    @DisplayName("DELETE /admin/keys/{id} deactivates tenant key")
    void testRevokeKey() throws Exception {
        UUID id = UUID.randomUUID();
        Tenant existing = Tenant.builder()
                .id(id)
                .virtualKey("netra-sk-search-1a2b3c")
                .team("Search Team")
                .isActive(true)
                .build();

        when(tenantRepository.findById(id)).thenReturn(Optional.of(existing));

        mockMvc.perform(delete("/admin/keys/" + id)
                        .header("Authorization", "Bearer netra-admin-demo"))
                .andExpect(status().isNoContent());

        verify(tenantRepository).save(any(Tenant.class));
        verify(tenantAuthService).invalidate("netra-sk-search-1a2b3c");
    }

    @Test
    @DisplayName("GET /admin/currency/rate returns 200 with USD/INR rate")
    void testGetCurrencyRate() throws Exception {
        when(forexRateService.getUsdToInrRate()).thenReturn(new BigDecimal("87.5000"));

        mockMvc.perform(get("/admin/currency/rate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.base").value("USD"))
                .andExpect(jsonPath("$.target").value("INR"))
                .andExpect(jsonPath("$.rate").value(87.5));
    }

    @Test
    @DisplayName("GET /admin/logs/stream returns SSE emitter")
    void testGetLogsStream() throws Exception {
        when(logStreamBroadcaster.registerEmitter()).thenReturn(new SseEmitter());

        mockMvc.perform(get("/admin/logs/stream")
                        .header("Authorization", "Bearer netra-admin-demo"))
                .andExpect(status().isOk());
    }
}
