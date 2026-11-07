package com.netra.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.controller.ChatCompletionController;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.model.dto.UsageInfo;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.MonthlySpendRepository;
import com.netra.gateway.repository.RequestLogRepository;
import com.netra.gateway.repository.TenantRepository;
import com.netra.gateway.service.AdmissionService;
import com.netra.gateway.service.CostCalculationService;
import com.netra.gateway.service.StreamingRelayService;
import com.netra.gateway.service.TenantAuthService;
import com.netra.gateway.service.UpstreamClientService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
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
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.netra.gateway.config.HttpClientConfig;
import com.netra.gateway.config.JacksonConfig;

@WebMvcTest(ChatCompletionController.class)
@Import({TenantAuthService.class, JacksonConfig.class, HttpClientConfig.class})
@EnableConfigurationProperties(GatewayConfigProperties.class)
class ChatCompletionContractTest {

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
    private com.netra.gateway.service.AuditLogService auditLogService;

    @MockitoBean
    private StreamingRelayService streamingRelayService;

    @MockitoBean
    private com.netra.gateway.service.SemanticCacheService semanticCacheService;

    @MockitoBean
    private com.netra.gateway.service.RefusalEscalationService refusalEscalationService;

    private Tenant searchTenant;

    @BeforeEach
    void setUp() {
        searchTenant = Tenant.builder()
                .virtualKey("netra-sk-search-1a2b3c")
                .team("search")
                .isActive(true)
                .modelAllowlist(List.of("fast"))
                .build();

        when(tenantRepository.findByVirtualKey("netra-sk-search-1a2b3c")).thenReturn(Optional.of(searchTenant));

        UpstreamClientService.ResolvedTarget defaultTarget = new UpstreamClientService.ResolvedTarget("alpha", "alpha-small", false, "alias_fast");
        UpstreamClientService.CandidateChain defaultChain = new UpstreamClientService.CandidateChain("fast", "fast", "alias_fast", List.of(defaultTarget));
        lenient().when(upstreamClientService.resolveCandidateChain(eq("fast"), any())).thenReturn(defaultChain);
        lenient().when(upstreamClientService.resolveTarget("fast")).thenReturn(defaultTarget);
        lenient().when(semanticCacheService.lookup(any(), any(), any())).thenReturn(Optional.empty());
        lenient().when(admissionService.checkAdmission(any(), any())).thenReturn(com.netra.gateway.service.AdmissionResult.defaultAdmitted(60));
    }

    @Test
    @DisplayName("Invalid API key returns HTTP 401 with authentication_error")
    void testInvalidKeyReturns401() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "hello")))
                .build();

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer definitely-not-a-real-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.type").value("authentication_error"))
                .andExpect(jsonPath("$.error.code").value("invalid_api_key"));
    }

    @Test
    @DisplayName("Unknown model returns HTTP 404 with not_found_error")
    void testUnknownModelReturns404() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("no-such-model-xyz")
                .messages(List.of(new ChatMessage("user", "hello")))
                .build();

        when(upstreamClientService.resolveCandidateChain(eq("no-such-model-xyz"), any()))
                .thenThrow(new com.netra.gateway.exception.ModelNotFoundException("no-such-model-xyz"));
        when(upstreamClientService.resolveTarget("no-such-model-xyz"))
                .thenThrow(new com.netra.gateway.exception.ModelNotFoundException("no-such-model-xyz"));

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.type").value("not_found_error"))
                .andExpect(jsonPath("$.error.code").value("model_not_found"));
    }

    @Test
    @DisplayName("Model not on allowlist returns HTTP 403 with model_not_allowed")
    void testModelNotAllowedReturns403() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("smart")
                .messages(List.of(new ChatMessage("user", "hello")))
                .build();

        UpstreamClientService.ResolvedTarget smartTarget = new UpstreamClientService.ResolvedTarget("alpha", "alpha-large", false, "alias_smart");
        UpstreamClientService.CandidateChain smartChain = new UpstreamClientService.CandidateChain("smart", "smart", "alias_smart", List.of(smartTarget));
        when(upstreamClientService.resolveCandidateChain(eq("smart"), any())).thenReturn(smartChain);
        when(upstreamClientService.resolveTarget("smart")).thenReturn(smartTarget);

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.type").value("model_not_allowed"));
    }

    @Test
    @DisplayName("Empty messages array returns HTTP 400 with invalid_request_error")
    void testEmptyMessagesReturns400() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(Collections.emptyList())
                .build();

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.type").value("invalid_request_error"));
    }

    @Test
    @DisplayName("Valid non-streaming completion returns HTTP 200 with complete telemetry header contract")
    void testValidNonStreamingCompletion() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "What is a message queue?")))
                .build();

        ChatCompletionResponse mockResponse = ChatCompletionResponse.builder()
                .id("chatcmpl-test-123")
                .object("chat.completion")
                .created(System.currentTimeMillis() / 1000)
                .model("alpha-small")
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .index(0)
                        .message(new ChatMessage("assistant", "A message queue is..."))
                        .finishReason("stop")
                        .build()))
                .usage(new UsageInfo(5, 17, 22))
                .build();

        UpstreamClientService.ResolvedTarget target = new UpstreamClientService.ResolvedTarget("alpha", "alpha-small", false);
        UpstreamClientService.UpstreamResult result = UpstreamClientService.UpstreamResult.builder()
                .response(mockResponse)
                .resolvedProvider("alpha")
                .resolvedModel("alpha-small")
                .fallback(false)
                .latencyMs(25)
                .statusCode(200)
                .build();

        when(upstreamClientService.resolveTarget("fast")).thenReturn(target);
        when(upstreamClientService.forwardNonStreaming(any(), eq(target))).thenReturn(result);
        when(upstreamClientService.forwardWithFailover(any(), any())).thenReturn(result);
        when(costService.calculateCost("alpha-small", 5, 17)).thenReturn(new BigDecimal("0.000011"));
        when(costService.formatCostHeader(new BigDecimal("0.000011"))).thenReturn("0.000011");

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().string("x-netra-provider", "alpha/alpha-small"))
                .andExpect(header().string("x-netra-cache", "miss"))
                .andExpect(header().string("x-netra-fallback", "false"))
                .andExpect(header().string("x-netra-cost-usd", "0.000011"))
                .andExpect(jsonPath("$.choices").isArray())
                .andExpect(jsonPath("$.usage.prompt_tokens").value(5))
                .andExpect(jsonPath("$.usage.completion_tokens").value(17));
    }

    @Test
    @DisplayName("Deactivated tenant key returns HTTP 401 with authentication_error")
    void testDeactivatedKeyReturns401() throws Exception {
        Tenant deactivatedTenant = Tenant.builder()
                .virtualKey("netra-sk-inactive-key")
                .team("legacy")
                .isActive(false)
                .modelAllowlist(List.of("fast"))
                .build();
        when(tenantRepository.findByVirtualKey("netra-sk-inactive-key")).thenReturn(Optional.of(deactivatedTenant));

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "ping")))
                .build();

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-inactive-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.type").value("authentication_error"))
                .andExpect(jsonPath("$.error.message").value("Virtual API key is deactivated"));
    }

    @Test
    @DisplayName("Unhandled internal exception returns sanitized 500 without leaking stack traces or internal details")
    void testUnhandledServerExceptionReturnsSanitized500() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "ping")))
                .build();

        when(upstreamClientService.resolveCandidateChain(eq("fast"), any()))
                .thenThrow(new RuntimeException("FATAL: Sensitive database connection string jdbc:postgresql://internal:5432 leaked!"));
        when(upstreamClientService.resolveTarget("fast"))
                .thenThrow(new RuntimeException("FATAL: Sensitive database connection string jdbc:postgresql://internal:5432 leaked!"));

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.type").value("server_error"))
                .andExpect(jsonPath("$.error.code").value("internal_error"))
                .andExpect(jsonPath("$.error.message").value(startsWith("An unexpected internal error occurred")));
    }

    @Test
    @DisplayName("Streaming completion sets text/event-stream content type and telemetry headers")
    void testStreamingCompletionSetsHeaders() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .stream(true)
                .messages(List.of(new ChatMessage("user", "stream test")))
                .build();

        UpstreamClientService.ResolvedTarget target = new UpstreamClientService.ResolvedTarget("alpha", "alpha-small", false);
        when(upstreamClientService.resolveTarget("fast")).thenReturn(target);

        ResponseBodyEmitter mockEmitter = new ResponseBodyEmitter();
        when(streamingRelayService.streamChatCompletion(any(), any(), any(), any(UpstreamClientService.CandidateChain.class), anyLong(), any(), any()))
                .thenAnswer(invocation -> {
                    HttpServletResponse resp = invocation.getArgument(5);
                    resp.setContentType("text/event-stream;charset=UTF-8");
                    resp.setHeader("x-netra-provider", "alpha/alpha-small");
                    resp.setHeader("x-netra-cache", "miss");
                    resp.setHeader("x-netra-fallback", "false");
                    return mockEmitter;
                });
        when(streamingRelayService.streamChatCompletion(any(), any(), any(), any(UpstreamClientService.CandidateChain.class), anyLong(), any()))
                .thenAnswer(invocation -> {
                    HttpServletResponse resp = invocation.getArgument(5);
                    resp.setContentType("text/event-stream;charset=UTF-8");
                    resp.setHeader("x-netra-provider", "alpha/alpha-small");
                    resp.setHeader("x-netra-cache", "miss");
                    resp.setHeader("x-netra-fallback", "false");
                    return mockEmitter;
                });
        when(streamingRelayService.streamChatCompletion(any(), any(), any(), eq(target), anyLong(), any()))
                .thenAnswer(invocation -> {
                    HttpServletResponse resp = invocation.getArgument(5);
                    resp.setContentType("text/event-stream;charset=UTF-8");
                    resp.setHeader("x-netra-provider", "alpha/alpha-small");
                    resp.setHeader("x-netra-cache", "miss");
                    resp.setHeader("x-netra-fallback", "false");
                    return mockEmitter;
                });

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("text/event-stream")))
                .andExpect(header().string("x-netra-provider", "alpha/alpha-small"))
                .andExpect(header().string("x-netra-cache", "miss"))
                .andExpect(header().string("x-netra-fallback", "false"));
    }

    @Test
    @DisplayName("Rate limit exceeded returns HTTP 429 with rate_limit_exceeded")
    void testRateLimitExceededReturns429() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "burst message")))
                .build();

        UpstreamClientService.ResolvedTarget target = new UpstreamClientService.ResolvedTarget("alpha", "alpha-small", false);
        when(upstreamClientService.resolveTarget("fast")).thenReturn(target);

        org.mockito.Mockito.doThrow(new com.netra.gateway.exception.RateLimitException(10))
                .when(admissionService).checkAdmission(any(), any());

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.type").value("rate_limit_exceeded"))
                .andExpect(jsonPath("$.error.code").value("rate_limit_exceeded"))
                .andExpect(jsonPath("$.error.message").value("Rate limit exceeded (10 requests/minute limit)"));
    }

    @Test
    @DisplayName("Budget exceeded returns HTTP 402 with budget_exceeded")
    void testBudgetExceededReturns402() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "expensive message")))
                .build();

        UpstreamClientService.ResolvedTarget target = new UpstreamClientService.ResolvedTarget("alpha", "alpha-small", false);
        when(upstreamClientService.resolveTarget("fast")).thenReturn(target);

        org.mockito.Mockito.doThrow(new com.netra.gateway.exception.BudgetExceededException(new BigDecimal("5.00")))
                .when(admissionService).checkAdmission(any(), any());

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error.type").value("budget_exceeded"))
                .andExpect(jsonPath("$.error.code").value("budget_exceeded"))
                .andExpect(jsonPath("$.error.message").value("Monthly budget of $5.00 exhausted for this key"));
    }

    @Test
    @DisplayName("Rate limit breach returns HTTP 429 with standard IETF RateLimit and Retry-After headers")
    void testRateLimitBreachReturnsIetfHeaders() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "rate limit test")))
                .build();

        org.mockito.Mockito.doThrow(new com.netra.gateway.exception.RateLimitException(60, 60))
                .when(admissionService).checkAdmission(any(), any());

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"))
                .andExpect(header().string("RateLimit-Limit", "60"))
                .andExpect(header().string("RateLimit-Remaining", "0"))
                .andExpect(header().string("RateLimit-Reset", "60"))
                .andExpect(header().string("RateLimit-Policy", "60;w=60"))
                .andExpect(jsonPath("$.error.type").value("rate_limit_exceeded"))
                .andExpect(jsonPath("$.error.code").value("rate_limit_exceeded"));
    }

    @Test
    @DisplayName("Upstream failure triggers automatic admission slot rollback")
    void testUpstreamFailureRollsBackAdmission() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "retry prompt")))
                .build();

        UpstreamClientService.ResolvedTarget target = new UpstreamClientService.ResolvedTarget("alpha", "alpha-small", false);
        when(upstreamClientService.resolveTarget("fast")).thenReturn(target);
        when(upstreamClientService.forwardNonStreaming(any(), eq(target)))
                .thenThrow(new com.netra.gateway.exception.UpstreamException("Alpha provider is down"));
        when(upstreamClientService.forwardWithFailover(any(), any()))
                .thenThrow(new com.netra.gateway.exception.UpstreamException("Alpha provider is down"));

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error.type").value("upstream_error"));

        org.mockito.Mockito.verify(admissionService).rollbackAdmission(eq("netra-sk-search-1a2b3c"), anyString());
    }

    @Test
    @DisplayName("Semantic cache hit returns 200 with x-netra-cache: hit and $0 cost header")
    void testCacheHitReturnsTelemetryHeaders() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "cached prompt")))
                .build();

        ChatCompletionResponse cachedResponse = ChatCompletionResponse.builder()
                .id("chatcmpl-cached-1")
                .object("chat.completion")
                .created(1730000000L)
                .model("gpt-4o-mini")
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .index(0)
                        .message(ChatMessage.builder().role("assistant").content("cached answer").build())
                        .finishReason("stop")
                        .build()))
                .usage(UsageInfo.builder().promptTokens(10).completionTokens(10).totalTokens(20).build())
                .build();

        com.netra.gateway.service.SemanticCacheService.CacheHitResult hit =
                new com.netra.gateway.service.SemanticCacheService.CacheHitResult(
                        java.util.UUID.randomUUID(),
                        "netra-sk-search-1a2b3c",
                        "fast",
                        "alpha/alpha-small",
                        cachedResponse,
                        0.98
                );

        when(semanticCacheService.lookup(any(), eq("fast"), any())).thenReturn(Optional.of(hit));

        mockMvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer netra-sk-search-1a2b3c")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().string("x-netra-cache", "hit"))
                .andExpect(header().string("x-netra-cost-usd", "0.000000"))
                .andExpect(header().string("x-netra-fallback", "false"))
                .andExpect(header().string("x-netra-route-reason", "semantic_cache_hit"))
                .andExpect(header().string("x-netra-provider", "alpha/alpha-small"))
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.startsWith("chatcmpl-")))
                .andExpect(jsonPath("$.created").isNumber())
                .andExpect(jsonPath("$.choices[0].message.content").value("cached answer"));
    }
}
