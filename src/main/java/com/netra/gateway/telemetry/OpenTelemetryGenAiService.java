package com.netra.gateway.telemetry;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;

import java.net.http.HttpRequest;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * Service instrumenting standard OpenTelemetry Generative AI (GenAI) semantic conventions:
 * - gen_ai.operation.name: "chat"
 * - gen_ai.provider.name: Upstream inference engine provider
 * - gen_ai.request.model: Requested model alias
 * - gen_ai.response.model: Concrete upstream model deployed
 * - gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.usage.cached_tokens
 * - gen_ai.client.operation.duration (Percentile latency histogram)
 * - gen_ai.client.time_to_first_token (Streaming TTFT percentile histogram)
 * - W3C Trace Context propagation (traceparent / tracestate)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OpenTelemetryGenAiService {

    public static final String TRACEPARENT_HEADER = "traceparent";
    public static final String TRACESTATE_HEADER = "tracestate";

    private final MeterRegistry meterRegistry;

    /**
     * Extracts incoming W3C Trace Context headers or synthesizes a fresh compliant context.
     */
    public W3cTraceContext extractOrCreateTraceContext(HttpServletRequest request) {
        if (request == null) {
            return W3cTraceContext.generateNew(null);
        }
        String traceparent = request.getHeader(TRACEPARENT_HEADER);
        String tracestate = request.getHeader(TRACESTATE_HEADER);
        return W3cTraceContext.parse(traceparent, tracestate);
    }

    /**
     * Injects W3C traceparent and tracestate into outbound HTTP client response headers.
     */
    public void injectResponseHeaders(HttpHeaders headers, W3cTraceContext context) {
        if (headers == null || context == null) {
            return;
        }
        headers.set(TRACEPARENT_HEADER, context.asTraceparent());
        if (context.getTraceState() != null && !context.getTraceState().isBlank()) {
            headers.set(TRACESTATE_HEADER, context.getTraceState());
        }
    }

    /**
     * Injects W3C traceparent and tracestate into upstream HTTP request builder.
     * Preserves active trace context so downstream traces link directly to the caller.
     */
    public void injectUpstreamHeaders(HttpRequest.Builder builder, W3cTraceContext context) {
        if (builder == null || context == null) {
            return;
        }
        builder.header(TRACEPARENT_HEADER, context.asTraceparent());
        if (context.getTraceState() != null && !context.getTraceState().isBlank()) {
            builder.header(TRACESTATE_HEADER, context.getTraceState());
        }
    }

    private String normalizeModelLabel(String model) {
        if (model == null || model.isBlank()) {
            return "unknown";
        }
        String normalized = model.trim().replaceAll("\\s+", "-").toLowerCase();
        normalized = normalized.replaceAll("[^a-z0-9_./:-]", "");
        if (normalized.length() > 48) {
            normalized = normalized.substring(0, 48);
        }
        return normalized.isEmpty() ? "unknown" : normalized;
    }

    /**
     * Records standard OpenTelemetry GenAI semantic conventions metrics into Micrometer/Prometheus.
     */
    public void recordChatCompletion(
            W3cTraceContext context,
            String provider,
            String requestedModel,
            String resolvedModel,
            int inputTokens,
            int outputTokens,
            int cachedTokens,
            long durationMs,
            long ttftMs,
            boolean isStream,
            String cacheStatus,
            int httpStatus) {

        String safeProvider = (provider != null && !provider.isBlank()) ? provider.trim().toLowerCase() : "mock";
        String safeReqModel = normalizeModelLabel(requestedModel);
        String safeRespModel = normalizeModelLabel(resolvedModel != null ? resolvedModel : safeReqModel);
        String safeCache = (cacheStatus != null && !cacheStatus.isBlank()) ? cacheStatus.trim().toLowerCase() : "miss";

        try {
            // 1. Overall Operation Duration (gen_ai.client.operation.duration)
            Timer.builder("gen_ai.client.operation.duration")
                    .description("Duration of GenAI chat completion operations")
                    .tags(
                            "gen_ai.operation.name", "chat",
                            "gen_ai.provider.name", safeProvider,
                            "gen_ai.request.model", safeReqModel,
                            "gen_ai.response.model", safeRespModel,
                            "stream", String.valueOf(isStream),
                            "cache", safeCache,
                            "status", String.valueOf(httpStatus)
                    )
                    .publishPercentiles(0.5, 0.9, 0.95, 0.99)
                    .minimumExpectedValue(Duration.ofMillis(1))
                    .maximumExpectedValue(Duration.ofSeconds(120))
                    .register(meterRegistry)
                    .record(Math.max(1, durationMs), TimeUnit.MILLISECONDS);

            // 2. Time-to-First-Token Duration for streaming completions (gen_ai.client.time_to_first_token)
            if (isStream && ttftMs > 0) {
                Timer.builder("gen_ai.client.time_to_first_token")
                        .description("Time-to-first-token (TTFT) latency for streaming GenAI responses")
                        .tags(
                                "gen_ai.operation.name", "chat",
                                "gen_ai.provider.name", safeProvider,
                                "gen_ai.request.model", safeReqModel,
                                "gen_ai.response.model", safeRespModel
                        )
                        .publishPercentiles(0.5, 0.9, 0.95, 0.99)
                        .minimumExpectedValue(Duration.ofMillis(1))
                        .maximumExpectedValue(Duration.ofSeconds(30))
                        .register(meterRegistry)
                        .record(ttftMs, TimeUnit.MILLISECONDS);
            }

            // 3. Token Usage Metrics (gen_ai.client.token.usage)
            recordTokenDistribution("input", inputTokens, safeProvider, safeReqModel, safeRespModel);
            recordTokenDistribution("output", outputTokens, safeProvider, safeReqModel, safeRespModel);
            if (cachedTokens > 0) {
                recordTokenDistribution("cached", cachedTokens, safeProvider, safeReqModel, safeRespModel);
            }

            // 4. Server Request Rate Counter (gen_ai.server.request.rate)
            Counter.builder("gen_ai.server.request.rate")
                    .description("Total number of GenAI chat requests processed")
                    .tags(
                            "gen_ai.operation.name", "chat",
                            "gen_ai.provider.name", safeProvider,
                            "gen_ai.request.model", safeReqModel,
                            "cache", safeCache,
                            "status", String.valueOf(httpStatus)
                    )
                    .register(meterRegistry)
                    .increment();

        } catch (Exception e) {
            log.debug("Failed to record OpenTelemetry GenAI metric: {}", e.getMessage());
        }
    }

    private void recordTokenDistribution(String tokenType, int count, String provider, String reqModel, String respModel) {
        if (count <= 0) {
            return;
        }
        DistributionSummary.builder("gen_ai.client.token.usage")
                .description("Number of tokens processed by GenAI operations")
                .tags(
                        "gen_ai.operation.name", "chat",
                        "gen_ai.token.type", tokenType,
                        "gen_ai.provider.name", provider,
                        "gen_ai.request.model", reqModel,
                        "gen_ai.response.model", respModel
                )
                .register(meterRegistry)
                .record(count);
    }
}
