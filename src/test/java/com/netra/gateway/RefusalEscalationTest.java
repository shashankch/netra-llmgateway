package com.netra.gateway;

import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.service.RefusalEscalationService;
import com.netra.gateway.service.UpstreamClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefusalEscalationTest {

    @Mock
    private UpstreamClientService upstreamClientService;

    private RefusalEscalationService escalationService;

    @BeforeEach
    void setUp() {
        escalationService = new RefusalEscalationService(upstreamClientService);
    }

    @Test
    @DisplayName("isRefusal detects refusal markers and apologetic responses")
    void testIsRefusalDetectsMarkers() {
        ChatCompletionResponse apologyResponse = ChatCompletionResponse.builder()
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .message(new ChatMessage("assistant", "I'm sorry, but I can't help with that."))
                        .build()))
                .build();
        assertThat(escalationService.isRefusal(apologyResponse)).isTrue();

        ChatCompletionResponse refuseTagResponse = ChatCompletionResponse.builder()
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .message(new ChatMessage("assistant", "[refuse] Safety policy violation."))
                        .build()))
                .build();
        assertThat(escalationService.isRefusal(refuseTagResponse)).isTrue();

        ChatCompletionResponse emptyResponse = ChatCompletionResponse.builder()
                .choices(List.of())
                .build();
        assertThat(escalationService.isRefusal(emptyResponse)).isTrue();

        ChatCompletionResponse normalResponse = ChatCompletionResponse.builder()
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .message(new ChatMessage("assistant", "Here is your requested code snippet."))
                        .build()))
                .build();
        assertThat(escalationService.isRefusal(normalResponse)).isFalse();
    }

    @Test
    @DisplayName("isEscalatableModel identifies cheap/small models eligible for auto-escalation")
    void testIsEscalatableModel() {
        assertThat(escalationService.isEscalatableModel("alpha-small")).isTrue();
        assertThat(escalationService.isEscalatableModel("beta-small")).isTrue();
        assertThat(escalationService.isEscalatableModel("fast")).isTrue();
        assertThat(escalationService.isEscalatableModel("google/gemini-2.0-flash-001")).isTrue();
        assertThat(escalationService.isEscalatableModel("openai/gpt-4o-mini")).isTrue();
        assertThat(escalationService.isEscalatableModel("alpha-large")).isFalse();
        assertThat(escalationService.isEscalatableModel("smart")).isFalse();
        assertThat(escalationService.isEscalatableModel("anthropic/claude-3.5-sonnet")).isFalse();
    }

    @Test
    @DisplayName("isEscalatable evaluates tier first and falls back to model name matching")
    void testIsEscalatableWithTierAndModel() {
        // Fast tier is always escalatable regardless of resolved model name
        assertThat(escalationService.isEscalatable("fast", "custom-obscure-fast-worker")).isTrue();
        assertThat(escalationService.isEscalatable("fast", "google/gemini-2.0-flash-001")).isTrue();

        // Smart tier is never escalatable
        assertThat(escalationService.isEscalatable("smart", "google/gemini-2.0-flash-001")).isFalse();
        assertThat(escalationService.isEscalatable("smart", "alpha-small")).isFalse();

        // Null or unknown tier checks model name
        assertThat(escalationService.isEscalatable(null, "google/gemini-2.0-flash-001")).isTrue();
        assertThat(escalationService.isEscalatable(null, "openai/gpt-4o-mini")).isTrue();
        assertThat(escalationService.isEscalatable(null, "anthropic/claude-3.5-sonnet")).isFalse();
    }

    @Test
    @DisplayName("escalate routes prompt to smart tier and marks routeReason as refusal_auto_escalation")
    void testEscalateRoutesToSmartTier() {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("fast")
                .messages(List.of(new ChatMessage("user", "complex reasoning task [refuse]")))
                .build();

        UpstreamClientService.ResolvedTarget smartTarget = new UpstreamClientService.ResolvedTarget("alpha", "alpha-large", false, "alias_smart");
        UpstreamClientService.CandidateChain smartChain = new UpstreamClientService.CandidateChain("smart", "smart", "alias_smart", List.of(smartTarget));

        ChatCompletionResponse smartResponse = ChatCompletionResponse.builder()
                .id("chatcmpl-smart-1")
                .model("alpha-large")
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .message(new ChatMessage("assistant", "Here is the rigorous solution to your query."))
                        .build()))
                .build();

        UpstreamClientService.UpstreamResult smartResult = UpstreamClientService.UpstreamResult.builder()
                .response(smartResponse)
                .resolvedProvider("alpha")
                .resolvedModel("alpha-large")
                .statusCode(200)
                .latencyMs(35)
                .build();

        when(upstreamClientService.resolveCandidateChain(eq("smart"), any())).thenReturn(smartChain);
        when(upstreamClientService.forwardWithFailover(eq(request), eq(smartChain))).thenReturn(smartResult);

        UpstreamClientService.UpstreamResult escalated = escalationService.escalate(request);

        assertThat(escalated).isNotNull();
        assertThat(escalated.getResolvedModel()).isEqualTo("alpha-large");
        assertThat(escalated.getRouteReason()).isEqualTo("refusal_auto_escalation");
        assertThat(escalated.isFallback()).isTrue();
    }
}
