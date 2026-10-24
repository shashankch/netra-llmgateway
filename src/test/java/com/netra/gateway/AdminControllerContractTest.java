package com.netra.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.controller.AdminController;
import com.netra.gateway.model.dto.UsageSummaryProjection;
import com.netra.gateway.model.entity.RequestLog;
import com.netra.gateway.repository.RequestLogRepository;
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

import com.netra.gateway.config.JacksonConfig;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
                return 1500L;
            }

            @Override
            public long getTotalCompletionTokens() {
                return 800L;
            }

            @Override
            public BigDecimal getTotalCostUsd() {
                return new BigDecimal("0.003500");
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
                        .header("Authorization", "Bearer netra-admin-demo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.key").value("netra-sk-search-1a2b3c"))
                .andExpect(jsonPath("$.requests").value(42))
                .andExpect(jsonPath("$.prompt_tokens").value(1500))
                .andExpect(jsonPath("$.completion_tokens").value(800))
                .andExpect(jsonPath("$.cost_usd").value(0.003500))
                .andExpect(jsonPath("$.cache_hits").value(10));
    }

    @Test
    @DisplayName("GET /admin/logs returns 200 with recent request log entries")
    void testGetRequestLogs() throws Exception {
        RequestLog log1 = RequestLog.builder()
                .id(UUID.randomUUID())
                .requestId("req_test123")
                .virtualKey("netra-sk-search-1a2b3c")
                .requestedModel("fast")
                .resolvedProvider("alpha")
                .resolvedModel("alpha-small")
                .status("ok")
                .statusCode(200)
                .promptTokens(5)
                .completionTokens(17)
                .costUsd(new BigDecimal("0.000011"))
                .cache("miss")
                .fallback(false)
                .latencyMs(35)
                .createdAt(Instant.now())
                .build();

        when(requestLogRepository.findByVirtualKeyOrderByCreatedAtDesc(eq("netra-sk-search-1a2b3c"), any(PageRequest.class)))
                .thenReturn(List.of(log1));

        mockMvc.perform(get("/admin/logs")
                        .param("key", "netra-sk-search-1a2b3c")
                        .param("limit", "10")
                        .header("Authorization", "Bearer netra-admin-demo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].request_id").value("req_test123"))
                .andExpect(jsonPath("$[0].virtual_key").value("netra-sk-search-1a2b3c"))
                .andExpect(jsonPath("$[0].status").value("ok"));
    }

    @Test
    @DisplayName("Invalid admin token returns 401 Unauthorized")
    void testInvalidAdminToken() throws Exception {
        mockMvc.perform(get("/admin/usage")
                        .param("key", "netra-sk-search-1a2b3c")
                        .header("Authorization", "Bearer invalid-admin-secret"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.type").value("authentication_error"));
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
}
