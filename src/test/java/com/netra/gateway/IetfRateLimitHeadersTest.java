package com.netra.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.config.HttpClientConfig;
import com.netra.gateway.config.JacksonConfig;
import com.netra.gateway.controller.ChatCompletionController;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.model.dto.UsageInfo;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.TenantRepository;
import com.netra.gateway.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ChatCompletionController.class)
@Import({TenantAuthService.class, JacksonConfig.class, HttpClientConfig.class})
@EnableConfigurationProperties(GatewayConfigProperties.class)
class IetfRateLimitHeadersTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private TenantRepository tenantRepository;
    @MockitoBean
    private UpstreamClientService upstreamClientService;
    @MockitoBean
    private CostCalculationService costService;
    @MockitoBean
    private AdmissionService admissionService;
    @MockitoBean
    private AuditLogService auditLogService;
    @MockitoBean
    private StreamingRelayService streamingRelayService;
    @MockitoBean
    private SemanticCacheService semanticCacheService;
    @MockitoBean
    private RefusalEscalationService refusalEscalationService;

    private Tenant searchTenant;

    @BeforeEach
    void setUp() {
        searchTenant = Tenant.builder()
                .virtualKey("netra-sk-search-1a2b3c")
                .team("search")
                .isActive(true)
                .rpmLimit(60)
                .modelAllowlist(List.of("fast"))
                .build();

        when(tenantRepository.findByVirtualKey("netra-sk-search-1a2b3c")).thenReturn(Optional.of(searchTenant));
        lenient().when(costService.calculateCost(any(), anyInt(), anyInt())).thenReturn(new BigDecimal("0.000003"));
        lenient().when(costService.formatCostHeader(any())).thenReturn("0.000003");
        lenient().when(semanticCacheService.lookup(any(), any(), any())).thenReturn(Optional.empty());
    }

    @Test
    @DisplayName("200 OK responses include standard IETF RateLimit headers (draft-ietf-httpapi-ratelimit-headers)")
    void test200ResponseIncludesIetfRateLimitHeaders() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Hello Netra")))
                .build();

        UpstreamClientService.ResolvedTarget target = new UpstreamClientService.ResolvedTarget("alpha", "alpha-small", false, "alias_fast");
        UpstreamClientService.CandidateChain chain = new UpstreamClientService.CandidateChain("fast", "fast", "alias_fast", List.of(target));
        when(upstreamClientService.resolveCandidateChain(eq("fast"), any())).thenReturn(chain);

        ChatCompletionResponse mockResp = ChatCompletionResponse.builder()
                .id("chatcmpl-1")
                .model("alpha-small")
                .usage(UsageInfo.builder().promptTokens(5).completionTokens(10).totalTokens(15).build())
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .message(new ChatMessage("assistant", "Hello!"))
                        .build()))
                .build();

        UpstreamClientService.UpstreamResult result = UpstreamClientService.UpstreamResult.builder()
                .response(mockResp)
                .resolvedProvider("alpha")
                .resolvedModel("alpha-small")
                .statusCode(200)
                .latencyMs(12)
                .build();

        when(upstreamClientService.forwardWithFailover(any(), any())).thenReturn(result);
        when(admissionService.checkAdmission(any(), any())).thenReturn(new AdmissionResult(200, 60, 58, 45, "60;w=60"));

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().string("RateLimit-Limit", "60"))
                .andExpect(header().string("RateLimit-Remaining", "58"))
                .andExpect(header().string("RateLimit-Reset", "45"))
                .andExpect(header().string("RateLimit-Policy", "60;w=60"))
                .andExpect(header().string("x-netra-provider", "alpha/alpha-small"))
                .andExpect(header().string("x-netra-cache", "miss"));
    }

    @Test
    @DisplayName("429 Too Many Requests responses include Retry-After and IETF RateLimit headers")
    void test429ResponseIncludesRetryAfterAndIetfHeaders() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Hello burst")))
                .build();

        UpstreamClientService.ResolvedTarget target = new UpstreamClientService.ResolvedTarget("alpha", "alpha-small", false, "alias_fast");
        UpstreamClientService.CandidateChain chain = new UpstreamClientService.CandidateChain("fast", "fast", "alias_fast", List.of(target));
        when(upstreamClientService.resolveCandidateChain(eq("fast"), any())).thenReturn(chain);

        when(admissionService.checkAdmission(any(), any())).thenThrow(new com.netra.gateway.exception.RateLimitException(60, 25));

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "25"))
                .andExpect(header().string("RateLimit-Limit", "60"))
                .andExpect(header().string("RateLimit-Remaining", "0"))
                .andExpect(header().string("RateLimit-Reset", "25"))
                .andExpect(header().string("RateLimit-Policy", "60;w=60"));
    }
}
