package com.netra.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.exception.UpstreamException;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.model.entity.ModelPricing;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.ModelPricingRepository;
import com.netra.gateway.service.AdmissionService;
import com.netra.gateway.service.AuditLogService;
import com.netra.gateway.service.CostCalculationService;
import com.netra.gateway.service.PromptDifficultyClassifier;
import com.netra.gateway.service.StreamingRelayService;
import com.netra.gateway.service.UpstreamClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@SuppressWarnings("unchecked")
class MultiProviderRoutingTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private ModelPricingRepository pricingRepository;

    @Mock
    private HttpResponse<String> stringResponse;

    @Mock
    private HttpResponse<InputStream> streamResponse;

    @Mock
    private CostCalculationService costService;

    @Mock
    private AdmissionService admissionService;

    @Mock
    private AuditLogService auditLogService;

    private ObjectMapper objectMapper;
    private GatewayConfigProperties configProperties;
    private PromptDifficultyClassifier difficultyClassifier;
    private UpstreamClientService upstreamClientService;
    private StreamingRelayService streamingRelayService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        configProperties = new GatewayConfigProperties();

        // Configure alpha and beta providers
        GatewayConfigProperties.ProviderConfig alpha = new GatewayConfigProperties.ProviderConfig();
        alpha.setName("alpha");
        alpha.setBaseUrl("http://localhost:9001");
        alpha.setApiKey("mock-alpha-key");

        GatewayConfigProperties.ProviderConfig beta = new GatewayConfigProperties.ProviderConfig();
        beta.setName("beta");
        beta.setBaseUrl("http://localhost:9002");
        beta.setApiKey("mock-beta-key");

        configProperties.setProviders(List.of(alpha, beta));

        // Configure fast and smart aliases with primary + fallbacks
        GatewayConfigProperties.ModelAliasConfig fastConfig = new GatewayConfigProperties.ModelAliasConfig();
        fastConfig.setPrimary("alpha-small");
        fastConfig.setFallbacks(List.of("beta-small"));

        GatewayConfigProperties.ModelAliasConfig smartConfig = new GatewayConfigProperties.ModelAliasConfig();
        smartConfig.setPrimary("alpha-large");
        smartConfig.setFallbacks(List.of("beta-large"));

        GatewayConfigProperties.ModelAliasConfig autoConfig = new GatewayConfigProperties.ModelAliasConfig();
        autoConfig.setRouteByDifficulty(Map.of(
                "simple", "fast",
                "complex", "smart"
        ));

        configProperties.setModelAliases(Map.of(
                "fast", fastConfig,
                "smart", smartConfig,
                "auto", autoConfig
        ));

        // Configure retries: 3 attempts, 10ms initial backoff for fast tests
        GatewayConfigProperties.RetryConfig retryConfig = new GatewayConfigProperties.RetryConfig();
        retryConfig.setMaxAttempts(3);
        retryConfig.setInitialBackoffMs(10);
        retryConfig.setBackoffMultiplier(1.5);
        configProperties.setRetry(retryConfig);

        difficultyClassifier = new PromptDifficultyClassifier();

        // Mock pricing repository
        ModelPricing alphaSmall = ModelPricing.builder().model("alpha-small").provider("alpha").build();
        ModelPricing alphaLarge = ModelPricing.builder().model("alpha-large").provider("alpha").build();
        ModelPricing betaSmall = ModelPricing.builder().model("beta-small").provider("beta").build();
        ModelPricing betaLarge = ModelPricing.builder().model("beta-large").provider("beta").build();

        when(pricingRepository.findByModel("alpha-small")).thenReturn(Optional.of(alphaSmall));
        when(pricingRepository.findByModel("alpha-large")).thenReturn(Optional.of(alphaLarge));
        when(pricingRepository.findByModel("beta-small")).thenReturn(Optional.of(betaSmall));
        when(pricingRepository.findByModel("beta-large")).thenReturn(Optional.of(betaLarge));

        upstreamClientService = new UpstreamClientService(
                configProperties,
                pricingRepository,
                objectMapper,
                httpClient,
                difficultyClassifier
        );

        streamingRelayService = new StreamingRelayService(
                httpClient,
                objectMapper,
                configProperties,
                costService,
                admissionService,
                auditLogService
        );
    }

    @Test
    @DisplayName("Candidate chain resolution for 'fast' sets primary alpha-small and fallback beta-small")
    void testResolveFastChain() {
        UpstreamClientService.CandidateChain chain = upstreamClientService.resolveCandidateChain("fast", List.of(new ChatMessage("user", "ping")));

        assertThat(chain.requestedModel()).isEqualTo("fast");
        assertThat(chain.chosenTier()).isEqualTo("fast");
        assertThat(chain.routeReason()).isEqualTo("alias_fast");
        assertThat(chain.targets()).hasSize(2);

        UpstreamClientService.ResolvedTarget primary = chain.targets().get(0);
        assertThat(primary.providerName()).isEqualTo("alpha");
        assertThat(primary.modelName()).isEqualTo("alpha-small");
        assertThat(primary.fallback()).isFalse();

        UpstreamClientService.ResolvedTarget fallback = chain.targets().get(1);
        assertThat(fallback.providerName()).isEqualTo("beta");
        assertThat(fallback.modelName()).isEqualTo("beta-small");
        assertThat(fallback.fallback()).isTrue();
    }

    @Test
    @DisplayName("Candidate chain resolution for 'auto' routes simple prompt to 'fast' tier")
    void testResolveAutoSimplePrompt() {
        List<ChatMessage> messages = List.of(new ChatMessage("user", "What is the capital of France?"));
        UpstreamClientService.CandidateChain chain = upstreamClientService.resolveCandidateChain("auto", messages);

        assertThat(chain.requestedModel()).isEqualTo("auto");
        assertThat(chain.chosenTier()).isEqualTo("fast");
        assertThat(chain.routeReason()).contains("auto -> fast");
        assertThat(chain.targets().get(0).modelName()).isEqualTo("alpha-small");
    }

    @Test
    @DisplayName("Candidate chain resolution for 'auto' routes complex prompt to 'smart' tier")
    void testResolveAutoComplexPrompt() {
        List<ChatMessage> messages = List.of(new ChatMessage("user",
                "Prove that the square root of 2 is irrational step by step with mathematical formal induction."));
        UpstreamClientService.CandidateChain chain = upstreamClientService.resolveCandidateChain("auto", messages);

        assertThat(chain.requestedModel()).isEqualTo("auto");
        assertThat(chain.chosenTier()).isEqualTo("smart");
        assertThat(chain.routeReason()).contains("auto -> smart");
        assertThat(chain.targets().get(0).modelName()).isEqualTo("alpha-large");
    }

    @Test
    @DisplayName("Forward with failover succeeds on first attempt on primary")
    void testForwardSuccessOnFirstAttempt() throws Exception {
        String mockUpstreamBody = "{\"id\":\"cmpl-1\",\"object\":\"chat.completion\",\"created\":1700000000,\"model\":\"alpha-small\",\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"Paris\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":2,\"total_tokens\":7}}";
        when(stringResponse.statusCode()).thenReturn(200);
        when(stringResponse.body()).thenReturn(mockUpstreamBody);
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(stringResponse);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "What is the capital of France?")))
                .build();

        UpstreamClientService.CandidateChain chain = upstreamClientService.resolveCandidateChain("fast", request.getMessages());
        UpstreamClientService.UpstreamResult result = upstreamClientService.forwardWithFailover(request, chain);

        assertThat(result.getStatusCode()).isEqualTo(200);
        assertThat(result.getResolvedProvider()).isEqualTo("alpha");
        assertThat(result.getResolvedModel()).isEqualTo("alpha-small");
        assertThat(result.isFallback()).isFalse();
        assertThat(result.getRetries()).isEqualTo(0);
        verify(httpClient, times(1)).send(any(HttpRequest.class), any());
    }

    @Test
    @DisplayName("Forward with failover retries transient 500 on primary and succeeds on attempt 2")
    void testForwardRetryOnTransient500() throws Exception {
        HttpResponse<String> failure500 = mock(HttpResponse.class);
        when(failure500.statusCode()).thenReturn(500);
        when(failure500.body()).thenReturn("Internal Server Error");

        String mockUpstreamBody = "{\"id\":\"cmpl-retry\",\"object\":\"chat.completion\",\"created\":1700000000,\"model\":\"alpha-small\",\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"Recovered\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":2,\"total_tokens\":7}}";
        HttpResponse<String> success200 = mock(HttpResponse.class);
        when(success200.statusCode()).thenReturn(200);
        when(success200.body()).thenReturn(mockUpstreamBody);

        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()))
                .thenReturn(failure500)
                .thenReturn(success200);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Hello")))
                .build();

        UpstreamClientService.CandidateChain chain = upstreamClientService.resolveCandidateChain("fast", request.getMessages());
        UpstreamClientService.UpstreamResult result = upstreamClientService.forwardWithFailover(request, chain);

        assertThat(result.getStatusCode()).isEqualTo(200);
        assertThat(result.getResolvedProvider()).isEqualTo("alpha");
        assertThat(result.getResolvedModel()).isEqualTo("alpha-small");
        assertThat(result.isFallback()).isFalse();
        assertThat(result.getRetries()).isEqualTo(1);
        verify(httpClient, times(2)).send(any(HttpRequest.class), any());
    }

    @Test
    @DisplayName("Forward with failover switches to secondary partner model when primary exhausts retries")
    void testForwardFailoverToSecondary() throws Exception {
        HttpResponse<String> failure500 = mock(HttpResponse.class);
        when(failure500.statusCode()).thenReturn(500);
        when(failure500.body()).thenReturn("Internal Server Error");

        String mockBetaBody = "{\"id\":\"cmpl-beta\",\"object\":\"chat.completion\",\"created\":1700000000,\"model\":\"beta-small\",\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"Hello from Beta\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":4,\"total_tokens\":9}}";
        HttpResponse<String> successBeta = mock(HttpResponse.class);
        when(successBeta.statusCode()).thenReturn(200);
        when(successBeta.body()).thenReturn(mockBetaBody);

        // Alpha fails 3 times, then Beta succeeds on first attempt
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()))
                .thenReturn(failure500)
                .thenReturn(failure500)
                .thenReturn(failure500)
                .thenReturn(successBeta);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Hello")))
                .build();

        UpstreamClientService.CandidateChain chain = upstreamClientService.resolveCandidateChain("fast", request.getMessages());
        UpstreamClientService.UpstreamResult result = upstreamClientService.forwardWithFailover(request, chain);

        assertThat(result.getStatusCode()).isEqualTo(200);
        assertThat(result.getResolvedProvider()).isEqualTo("beta");
        assertThat(result.getResolvedModel()).isEqualTo("beta-small");
        assertThat(result.isFallback()).isTrue();
        assertThat(result.getRetries()).isEqualTo(3);
        verify(httpClient, times(4)).send(any(HttpRequest.class), any());
    }

    @Test
    @DisplayName("Forward with failover throws UpstreamException when all candidates in chain fail")
    void testForwardAllCandidatesExhaustedThrows502() throws Exception {
        HttpResponse<String> failure500 = mock(HttpResponse.class);
        when(failure500.statusCode()).thenReturn(500);
        when(failure500.body()).thenReturn("Internal Server Error");

        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()))
                .thenReturn(failure500);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "Hello")))
                .build();

        UpstreamClientService.CandidateChain chain = upstreamClientService.resolveCandidateChain("fast", request.getMessages());

        UpstreamException exception = assertThrows(UpstreamException.class, () ->
                upstreamClientService.forwardWithFailover(request, chain));

        assertThat(exception.getMessage()).contains("All upstream providers exhausted for alias fast");
        assertThat(exception.getErrorCode()).isEqualTo("upstream_unavailable");
        // 3 retries on Alpha + 3 retries on Beta = 6 total requests
        verify(httpClient, times(6)).send(any(HttpRequest.class), any());
    }

    @Test
    @DisplayName("Streaming relay fails over to secondary provider before emitting headers if primary fails")
    void testStreamingRelayFailoverBeforeEmitting() throws Exception {
        HttpResponse<InputStream> failureStream = mock(HttpResponse.class);
        when(failureStream.statusCode()).thenReturn(500);

        String ssePayload = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello from Beta\"}}]}\n\n" +
                "data: [DONE]\n\n";
        HttpResponse<InputStream> successStream = mock(HttpResponse.class);
        when(successStream.statusCode()).thenReturn(200);
        when(successStream.body()).thenReturn(new ByteArrayInputStream(ssePayload.getBytes(StandardCharsets.UTF_8)));

        // Alpha fails, Beta succeeds
        when(httpClient.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any()))
                .thenReturn(failureStream)
                .thenReturn(failureStream)
                .thenReturn(failureStream)
                .thenReturn(successStream);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .stream(true)
                .messages(List.of(new ChatMessage("user", "Hello")))
                .build();

        Tenant tenant = Tenant.builder()
                .virtualKey("netra-sk-search-1a2b3c")
                .team("Search Team")
                .monthlyBudgetUsd(new BigDecimal("10.00"))
                .rpmLimit(60)
                .build();

        UpstreamClientService.CandidateChain chain = upstreamClientService.resolveCandidateChain("fast", request.getMessages());
        MockHttpServletResponse servletResponse = new MockHttpServletResponse();

        ResponseBodyEmitter emitter = streamingRelayService.streamChatCompletion(
                "req-failover-stream-1",
                tenant,
                request,
                chain,
                System.currentTimeMillis(),
                servletResponse
        );

        assertThat(emitter).isNotNull();
        assertThat(servletResponse.getHeader("x-netra-provider")).isEqualTo("beta/beta-small");
        assertThat(servletResponse.getHeader("x-netra-fallback")).isEqualTo("true");
        assertThat(servletResponse.getHeader("x-netra-retries")).isEqualTo("3");
    }
}
