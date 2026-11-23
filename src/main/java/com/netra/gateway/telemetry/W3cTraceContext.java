package com.netra.gateway.telemetry;

import lombok.Builder;
import lombok.Getter;

import java.security.SecureRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * W3C Trace Context representation compliant with the W3C Recommendation:
 * https://www.w3.org/TR/trace-context/
 *
 * Format of traceparent: {version}-{trace_id}-{parent_id/span_id}-{trace_flags}
 * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */
@Getter
@Builder
public class W3cTraceContext {

    private static final Pattern TRACEPARENT_PATTERN =
            Pattern.compile("^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$");

    private static final SecureRandom RANDOM = new SecureRandom();

    private final String version;
    private final String traceId;
    private final String spanId;
    private final String traceFlags;
    private final String traceState;

    /**
     * Parses incoming traceparent header or synthesizes a fresh W3C Trace Context if missing or malformed.
     */
    public static W3cTraceContext parse(String traceparent, String tracestate) {
        if (traceparent != null && !traceparent.isBlank()) {
            String trimmed = traceparent.trim().toLowerCase();
            Matcher matcher = TRACEPARENT_PATTERN.matcher(trimmed);
            if (matcher.matches()) {
                String ver = matcher.group(1);
                String tid = matcher.group(2);
                String sid = matcher.group(3);
                String flags = matcher.group(4);

                // Reject forbidden version 'ff' and all-zero traceId or spanId per W3C specification
                if (!"ff".equals(ver) && !"00000000000000000000000000000000".equals(tid) && !"0000000000000000".equals(sid)) {
                    return W3cTraceContext.builder()
                            .version(ver)
                            .traceId(tid)
                            .spanId(sid)
                            .traceFlags(flags)
                            .traceState(tracestate != null ? tracestate.trim() : null)
                            .build();
                }
            }
        }
        // When parent is missing or invalid, generate new trace context and discard invalid tracestate
        return generateNew(null);
    }

    /**
     * Generates a new compliant W3C Trace Context.
     */
    public static W3cTraceContext generateNew(String tracestate) {
        return W3cTraceContext.builder()
                .version("00")
                .traceId(generateHex(32))
                .spanId(generateHex(16))
                .traceFlags("01") // Sampled
                .traceState(tracestate != null ? tracestate.trim() : null)
                .build();
    }

    /**
     * Creates a child span context under the same trace ID.
     */
    public W3cTraceContext createChildSpan() {
        return W3cTraceContext.builder()
                .version(this.version)
                .traceId(this.traceId)
                .spanId(generateHex(16))
                .traceFlags(this.traceFlags)
                .traceState(this.traceState)
                .build();
    }

    /**
     * Formats context into standard W3C traceparent header string.
     */
    public String asTraceparent() {
        return String.format("%s-%s-%s-%s", version, traceId, spanId, traceFlags);
    }

    private static String generateHex(int length) {
        byte[] bytes = new byte[length / 2];
        RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(length);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
