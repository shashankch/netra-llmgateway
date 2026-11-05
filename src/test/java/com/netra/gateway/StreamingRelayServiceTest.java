package com.netra.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.exception.UpstreamException;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.service.AdmissionService;
import com.netra.gateway.service.AuditLogService;
import com.netra.gateway.service.CostCalculationService;
import com.netra.gateway.service.ProviderCircuitBreakerService;
import com.netra.gateway.service.StreamingRelayService;
import com.netra.gateway.service.UpstreamClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StreamingRelayServiceTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private CostCalculationService costService;

    @Mock
    private AdmissionService admissionService;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private HttpResponse<InputStream> httpResponse;

    @Mock
    private com.netra.gateway.service.ProviderCircuitBreakerService circuitBreakerService;

    private ObjectMapper objectMapper;
    private GatewayConfigProperties configProperties;
    private StreamingRelayService streamingRelayService;

    private Tenant testTenant;
    private UpstreamClientService.ResolvedTarget testTarget;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        configProperties = new GatewayConfigProperties();

        GatewayConfigProperties.ProviderConfig alpha = new GatewayConfigProperties.ProviderConfig();
        alpha.setName("alpha");
        alpha.setBaseUrl("http://localhost:9001");
        alpha.setApiKey("test-key");
        configProperties.setProviders(List.of(alpha));

        streamingRelayService = new StreamingRelayService(
                httpClient,
                objectMapper,
                configProperties,
                costService,
                admissionService,
                auditLogService,
                null,
                circuitBreakerService
        );

        testTenant = Tenant.builder()
                .virtualKey("netra-sk-search-1a2b3c")
                .team("Search Team")
                .monthlyBudgetUsd(new BigDecimal("10.00"))
                .rpmLimit(60)
                .build();

        testTarget = new UpstreamClientService.ResolvedTarget("alpha", "alpha-small", false);
        when(circuitBreakerService.tryAcquirePermission(anyString())).thenReturn(true);
    }

    @Test
    @DisplayName("streamChatCompletion sets response headers upfront before any chunks are flushed")
    void testSetsHeadersUpfront() throws Exception {
        String ssePayload = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n" +
                "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":10,\"total_tokens\":15}}\n\n" +
                "data: [DONE]\n\n";

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(new ByteArrayInputStream(ssePayload.getBytes(StandardCharsets.UTF_8)));
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenReturn(httpResponse);
        lenient().when(costService.calculateCost(eq("alpha-small"), anyInt(), anyInt())).thenReturn(new BigDecimal("0.000015"));

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Hello world")))
                .stream(true)
                .build();

        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        ResponseBodyEmitter emitter = streamingRelayService.streamChatCompletion(
                "req-test-1",
                testTenant,
                request,
                testTarget,
                System.currentTimeMillis(),
                servletResponse
        );

        assertThat(emitter).isNotNull();
        assertThat(servletResponse.getContentType()).contains("text/event-stream");
        assertThat(servletResponse.getHeader("Cache-Control")).isEqualTo("no-cache");
        assertThat(servletResponse.getHeader("Connection")).isEqualTo("keep-alive");
        assertThat(servletResponse.getHeader("x-netra-provider")).isEqualTo("alpha/alpha-small");
        assertThat(servletResponse.getHeader("x-netra-cache")).isEqualTo("miss");
        assertThat(servletResponse.getHeader("x-netra-fallback")).isEqualTo("false");
        assertThat(servletResponse.getHeader("x-netra-cost-usd")).isNull(); // Omitted upfront per contract

        // Verify audit log settlement was called on completion
        verify(auditLogService, timeout(2000)).recordAuditAndSpend(
                eq("req-test-1"),
                eq("netra-sk-search-1a2b3c"),
                eq("fast"),
                eq("alpha"),
                eq("alpha-small"),
                eq("ok"),
                eq(200),
                eq(5),
                eq(10),
                eq(new BigDecimal("0.000015")),
                eq("miss"),
                eq(false),
                isNull(),
                eq(0),
                anyLong(),
                eq(true),
                isNull()
        );
    }

    @Test
    @DisplayName("streamChatCompletion falls back to heuristic token estimation when usage block is omitted")
    void testFallbackTokenEstimationWhenUsageOmitted() throws Exception {
        String ssePayload = "data: {\"choices\":[{\"delta\":{\"content\":\"One two three\"}}]}\n\n" +
                "data: {\"choices\":[{\"delta\":{\"content\":\"four five\"}}]}\n\n" +
                "data: [DONE]\n\n";

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(new ByteArrayInputStream(ssePayload.getBytes(StandardCharsets.UTF_8)));
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenReturn(httpResponse);
        lenient().when(costService.calculateCost(eq("alpha-small"), anyInt(), anyInt())).thenReturn(new BigDecimal("0.000008"));

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Hello there test")))
                .stream(true)
                .build();

        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        streamingRelayService.streamChatCompletion(
                "req-test-fallback",
                testTenant,
                request,
                testTarget,
                System.currentTimeMillis(),
                servletResponse
        );

        // Verify heuristic inferred prompt tokens (3 words) and completion tokens (5 words: "One two three four five")
        verify(auditLogService, timeout(2000)).recordAuditAndSpend(
                eq("req-test-fallback"),
                eq("netra-sk-search-1a2b3c"),
                eq("fast"),
                eq("alpha"),
                eq("alpha-small"),
                eq("ok"),
                eq(200),
                eq(3),
                eq(5),
                any(),
                eq("miss"),
                eq(false),
                isNull(),
                eq(0),
                anyLong(),
                eq(true),
                isNull()
        );
    }

    @Test
    @DisplayName("streamChatCompletion detects premature stream severance before data: [DONE]")
    void testPrematureStreamSeverance() throws Exception {
        // Stream terminates abruptly without emitting data: [DONE]
        String ssePayload = "data: {\"choices\":[{\"delta\":{\"content\":\"Incomplete thought...\"}}]}\n\n";

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(new ByteArrayInputStream(ssePayload.getBytes(StandardCharsets.UTF_8)));
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenReturn(httpResponse);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "What is quantum computing?")))
                .stream(true)
                .build();

        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        streamingRelayService.streamChatCompletion(
                "req-test-severed",
                testTenant,
                request,
                testTarget,
                System.currentTimeMillis(),
                servletResponse
        );

        // Verify admission rollback is triggered
        verify(admissionService, timeout(2000)).rollbackAdmission("netra-sk-search-1a2b3c", "req-test-severed");

        // Verify status recorded as upstream_error with errorType stream_severed and ZERO cost
        verify(auditLogService, timeout(2000)).recordAuditAndSpend(
                eq("req-test-severed"),
                eq("netra-sk-search-1a2b3c"),
                eq("fast"),
                eq("alpha"),
                eq("alpha-small"),
                eq("upstream_error"),
                eq(502),
                eq(0),
                eq(0),
                eq(BigDecimal.ZERO),
                eq("miss"),
                eq(false),
                isNull(),
                eq(0),
                anyLong(),
                eq(true),
                eq("stream_severed")
        );
    }

    @Test
    @DisplayName("streamChatCompletion handles stream completion and safely closes upstream stream")
    void testStreamCompletionClosesUpstream() throws Exception {
        String ssePayload = "data: {\"choices\":[{\"delta\":{\"content\":\"Alpha beta gamma\"}}]}\n\n" +
                "data: [DONE]\n\n";

        InputStream streamSpy = spy(new ByteArrayInputStream(ssePayload.getBytes(StandardCharsets.UTF_8)));
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(streamSpy);
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenReturn(httpResponse);
        lenient().when(costService.calculateCost(eq("alpha-small"), anyInt(), anyInt())).thenReturn(new BigDecimal("0.000003"));

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Test prompt")))
                .stream(true)
                .build();

        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        streamingRelayService.streamChatCompletion(
                "req-test-stream-close",
                testTenant,
                request,
                testTarget,
                System.currentTimeMillis(),
                servletResponse
        );

        // Verify upstream input stream was closed when stream finished
        verify(streamSpy, timeout(2000).atLeastOnce()).close();

        // Verify audit log settlement completed
        verify(auditLogService, timeout(2000)).recordAuditAndSpend(
                eq("req-test-stream-close"),
                eq("netra-sk-search-1a2b3c"),
                eq("fast"),
                eq("alpha"),
                eq("alpha-small"),
                eq("ok"),
                eq(200),
                anyInt(),
                anyInt(),
                any(),
                eq("miss"),
                eq(false),
                isNull(),
                eq(0),
                anyLong(),
                eq(true),
                isNull()
        );
    }

    @Test
    @DisplayName("streamChatCompletion rolls back rate limit slot on initial upstream HTTP 500 error")
    void testUpstreamHttp500RollsBackAdmission() throws Exception {
        when(httpResponse.statusCode()).thenReturn(500);
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenReturn(httpResponse);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Test prompt")))
                .stream(true)
                .build();

        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        org.junit.jupiter.api.Assertions.assertThrows(
                UpstreamException.class,
                () -> streamingRelayService.streamChatCompletion(
                        "req-test-500",
                        testTenant,
                        request,
                        testTarget,
                        System.currentTimeMillis(),
                        servletResponse
                )
        );

        // Verify admission rollback is triggered
        verify(admissionService, timeout(2000)).rollbackAdmission("netra-sk-search-1a2b3c", "req-test-500");
    }

    @Test
    @DisplayName("streamChatCompletion releases breaker permit and rolls back admission on upstream HTTP 400 error")
    void testUpstreamHttp400ReleasesPermitAndRollsBackAdmission() throws Exception {
        ProviderCircuitBreakerService cbService = mock(ProviderCircuitBreakerService.class);
        when(cbService.tryAcquirePermission(anyString())).thenReturn(true);

        StreamingRelayService serviceWithCb = new StreamingRelayService(
                httpClient,
                objectMapper,
                configProperties,
                costService,
                admissionService,
                auditLogService,
                null,
                cbService
        );

        when(httpResponse.statusCode()).thenReturn(400);
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenReturn(httpResponse);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Test 400")))
                .stream(true)
                .build();

        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        UpstreamException thrown = org.junit.jupiter.api.Assertions.assertThrows(
                UpstreamException.class,
                () -> serviceWithCb.streamChatCompletion(
                        "req-test-400",
                        testTenant,
                        request,
                        testTarget,
                        System.currentTimeMillis(),
                        servletResponse
                )
        );

        assertThat(thrown.getUpstreamStatusCode()).isEqualTo(400);
        // Verify breaker permit is released, NOT recorded as error
        verify(cbService).releasePermission("alpha");
        verify(cbService, never()).recordError(anyString(), anyLong(), any());
        // Verify admission is rolled back
        verify(admissionService, timeout(2000)).rollbackAdmission("netra-sk-search-1a2b3c", "req-test-400");
    }

    @Test
    @DisplayName("streamChatCompletion rolls back rate limit slot and records zero cost when stream drops immediately with zero tokens")
    void testImmediateSeveranceZeroTokensNoCost() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(new ByteArrayInputStream(new byte[0])); // completely empty body
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenReturn(httpResponse);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Hello")))
                .stream(true)
                .build();

        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        streamingRelayService.streamChatCompletion(
                "req-test-immediate-severed",
                testTenant,
                request,
                testTarget,
                System.currentTimeMillis(),
                servletResponse
        );

        // Verify admission rollback is triggered
        verify(admissionService, timeout(2000)).rollbackAdmission("netra-sk-search-1a2b3c", "req-test-immediate-severed");

        // Verify cost is ZERO and status is upstream_error
        verify(auditLogService, timeout(2000)).recordAuditAndSpend(
                eq("req-test-immediate-severed"),
                eq("netra-sk-search-1a2b3c"),
                eq("fast"),
                eq("alpha"),
                eq("alpha-small"),
                eq("upstream_error"),
                eq(502),
                eq(0),
                eq(0),
                eq(BigDecimal.ZERO),
                eq("miss"),
                eq(false),
                isNull(),
                eq(0),
                anyLong(),
                eq(true),
                eq("stream_severed")
        );
    }

    @Test
    @DisplayName("replayCachedStream emits tokenized SSE chunks, null finish_reason, terminal stop chunk, and records zero cost")
    void testReplayCachedStream() throws Exception {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "What is Netra?")))
                .stream(true)
                .build();

        ChatCompletionResponse cachedResponse = ChatCompletionResponse.builder()
                .id("chatcmpl-cached-abc")
                .object("chat.completion")
                .created(1700000000L)
                .model("gpt-4o-mini")
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .index(0)
                        .message(ChatMessage.builder().role("assistant").content("Netra is a gateway").build())
                        .finishReason("stop")
                        .build()))
                .usage(com.netra.gateway.model.dto.UsageInfo.builder()
                        .promptTokens(10)
                        .completionTokens(8)
                        .totalTokens(18)
                        .build())
                .build();

        com.netra.gateway.service.SemanticCacheService.CacheHitResult cacheHit =
                new com.netra.gateway.service.SemanticCacheService.CacheHitResult(
                        java.util.UUID.randomUUID(),
                        testTenant.getVirtualKey(),
                        "fast",
                        "alpha/alpha-small",
                        cachedResponse,
                        0.98
                );

        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        ResponseBodyEmitter emitter = streamingRelayService.replayCachedStream(
                "req-test-cache-stream",
                testTenant,
                request,
                cacheHit,
                System.currentTimeMillis(),
                servletResponse
        );

        assertThat(emitter).isNotNull();
        assertThat(servletResponse.getContentType()).contains("text/event-stream");
        assertThat(servletResponse.getHeader("x-netra-cache")).isEqualTo("hit");
        assertThat(servletResponse.getHeader("x-netra-cost-usd")).isEqualTo("0.000000");
        assertThat(servletResponse.getHeader("x-netra-provider")).isEqualTo("alpha/alpha-small");

        // Verify zero cost audit log recorded
        verify(auditLogService, timeout(2000)).recordAuditAndSpend(
                eq("req-test-cache-stream"),
                eq("netra-sk-search-1a2b3c"),
                eq("fast"),
                eq("alpha"),
                eq("gpt-4o-mini"),
                eq("cache_hit"),
                eq(200),
                eq(10),
                eq(8),
                eq(BigDecimal.ZERO.setScale(6, java.math.RoundingMode.HALF_UP)),
                eq("hit"),
                eq(false),
                eq("semantic_cache_hit"),
                eq(0),
                anyLong(),
                eq(true),
                isNull(),
                eq(false),
                eq("tier2_semantic")
        );
    }

    @Test
    @DisplayName("streamChatCompletion waits for first non-empty output delta to record TTFT and ignores empty role events")
    void testEmptyAssistantRoleEventDoesNotStopTtftTimer() throws Exception {
        // Stream where first event is empty role header, followed by actual text delta
        String chunk1 = "data: {\"choices\":[{\"delta\":{\"role\":\"assistant\"}}]}\n\n";
        String chunk2 = "data: {\"choices\":[{\"delta\":{\"content\":\"Real content\"}}]}\n\n";
        String chunk3 = "data: [DONE]\n\n";

        // Custom InputStream that injects a small delay between chunk1 and chunk2
        InputStream delayedStream = new InputStream() {
            private final byte[] bytes1 = chunk1.getBytes(StandardCharsets.UTF_8);
            private final byte[] bytes2 = (chunk2 + chunk3).getBytes(StandardCharsets.UTF_8);
            private int pos1 = 0;
            private int pos2 = 0;
            private boolean slept = false;

            @Override
            public int read() {
                if (pos1 < bytes1.length) {
                    return bytes1[pos1++] & 0xFF;
                }
                if (!slept) {
                    try {
                        Thread.sleep(60);
                    } catch (InterruptedException ignored) {}
                    slept = true;
                }
                if (pos2 < bytes2.length) {
                    return bytes2[pos2++] & 0xFF;
                }
                return -1;
            }
        };

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(delayedStream);
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenReturn(httpResponse);
        lenient().when(costService.calculateCost(eq("alpha-small"), anyInt(), anyInt())).thenReturn(new BigDecimal("0.000015"));

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Hello")))
                .stream(true)
                .build();

        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        ResponseBodyEmitter emitter = streamingRelayService.streamChatCompletion(
                "req-test-ttft",
                testTenant,
                request,
                testTarget,
                System.currentTimeMillis(),
                servletResponse
        );

        assertThat(emitter).isNotNull();

        // Verify circuitBreakerService.recordSuccess was invoked with wait duration >= 50ms (in nanoseconds)
        ArgumentCaptor<Long> durationCaptor = ArgumentCaptor.forClass(Long.class);
        verify(circuitBreakerService, timeout(2000)).recordSuccess(eq("alpha"), durationCaptor.capture());
        assertThat(durationCaptor.getValue()).isGreaterThanOrEqualTo(50_000_000L); // >= 50ms in nanos
    }
}
