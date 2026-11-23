package com.netra.gateway;

import com.netra.gateway.telemetry.OpenTelemetryGenAiService;
import com.netra.gateway.telemetry.W3cTraceContext;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;

import java.net.http.HttpRequest;
import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

class OpenTelemetryGenAiTest {

    private MeterRegistry meterRegistry;
    private OpenTelemetryGenAiService oTelService;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        oTelService = new OpenTelemetryGenAiService(meterRegistry);
    }

    @Test
    @DisplayName("Extracts valid W3C traceparent and propagates trace context")
    void testExtractValidTraceparent() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        String validTraceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
        request.addHeader("traceparent", validTraceparent);
        request.addHeader("tracestate", "congo=t61rcWkgMzE");

        W3cTraceContext context = oTelService.extractOrCreateTraceContext(request);

        assertThat(context.getTraceId()).isEqualTo("4bf92f3577b34da6a3ce929d0e0e4736");
        assertThat(context.getSpanId()).isEqualTo("00f067aa0ba902b7");
        assertThat(context.getTraceFlags()).isEqualTo("01");
        assertThat(context.getTraceState()).isEqualTo("congo=t61rcWkgMzE");
        assertThat(context.asTraceparent()).isEqualTo(validTraceparent);
    }

    @Test
    @DisplayName("Synthesizes fresh W3C Trace Context when traceparent header is missing")
    void testSynthesizeFreshTraceparentWhenMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        W3cTraceContext context = oTelService.extractOrCreateTraceContext(request);

        assertThat(context).isNotNull();
        assertThat(context.getVersion()).isEqualTo("00");
        assertThat(context.getTraceId()).hasSize(32);
        assertThat(context.getSpanId()).hasSize(16);
        assertThat(context.getTraceFlags()).isEqualTo("01");
        assertThat(context.asTraceparent()).matches("^00-[0-9a-f]{32}-[0-9a-f]{16}-01$");
    }

    @Test
    @DisplayName("Injects response headers and upstream child span headers correctly")
    void testHeaderInjection() {
        W3cTraceContext context = W3cTraceContext.parse(
                "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
                "vendor=state1"
        );

        HttpHeaders responseHeaders = new HttpHeaders();
        oTelService.injectResponseHeaders(responseHeaders, context);
        assertThat(responseHeaders.getFirst("traceparent")).isEqualTo("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
        assertThat(responseHeaders.getFirst("tracestate")).isEqualTo("vendor=state1");

        HttpRequest.Builder builder = HttpRequest.newBuilder().uri(URI.create("http://localhost:8080"));
        oTelService.injectUpstreamHeaders(builder, context);
        HttpRequest req = builder.build();
        assertThat(req.headers().firstValue("traceparent")).isPresent();
        assertThat(req.headers().firstValue("traceparent").get())
                .startsWith("00-4bf92f3577b34da6a3ce929d0e0e4736-"); // same traceId, new child spanId
    }

    @Test
    @DisplayName("Records standard OpenTelemetry GenAI semantic conventions metrics into Micrometer")
    void testRecordGenAiMetrics() {
        W3cTraceContext context = W3cTraceContext.generateNew(null);

        oTelService.recordChatCompletion(
                context,
                "openrouter",
                "fast",
                "deepseek/deepseek-chat",
                100,
                50,
                40, // 40 cached tokens
                250L,
                45L,
                true,
                "miss",
                200
        );

        // Verify Timer: gen_ai.client.operation.duration
        assertThat(meterRegistry.find("gen_ai.client.operation.duration").timer()).isNotNull();
        assertThat(meterRegistry.find("gen_ai.client.operation.duration").timer().count()).isEqualTo(1);

        // Verify TTFT Timer: gen_ai.client.time_to_first_token
        assertThat(meterRegistry.find("gen_ai.client.time_to_first_token").timer()).isNotNull();
        assertThat(meterRegistry.find("gen_ai.client.time_to_first_token").timer().count()).isEqualTo(1);

        // Verify Token usage distributions: input, output, cached
        assertThat(meterRegistry.find("gen_ai.client.token.usage").tag("gen_ai.token.type", "input").summary()).isNotNull();
        assertThat(meterRegistry.find("gen_ai.client.token.usage").tag("gen_ai.token.type", "input").summary().count()).isEqualTo(1);
        assertThat(meterRegistry.find("gen_ai.client.token.usage").tag("gen_ai.token.type", "output").summary().count()).isEqualTo(1);
        assertThat(meterRegistry.find("gen_ai.client.token.usage").tag("gen_ai.token.type", "cached").summary().count()).isEqualTo(1);

        // Verify Server request counter: gen_ai.server.request.rate
        assertThat(meterRegistry.find("gen_ai.server.request.rate").counter()).isNotNull();
        assertThat(meterRegistry.find("gen_ai.server.request.rate").counter().count()).isEqualTo(1.0);
    }
}
