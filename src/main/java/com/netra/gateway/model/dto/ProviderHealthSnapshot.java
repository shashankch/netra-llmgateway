package com.netra.gateway.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProviderHealthSnapshot {

    @JsonProperty("provider")
    private String provider;

    @JsonProperty("status")
    private String status; // HEALTHY, DEGRADED, DOWN

    @JsonProperty("circuit_state")
    private String circuitState; // CLOSED, OPEN, HALF_OPEN

    @JsonProperty("failure_rate")
    private float failureRate;

    @JsonProperty("slow_call_rate")
    private float slowCallRate;

    @JsonProperty("buffered_calls")
    private int bufferedCalls;

    @JsonProperty("successful_calls")
    private int successfulCalls;

    @JsonProperty("failed_calls")
    private int failedCalls;

    @JsonProperty("slow_calls")
    private int slowCalls;

    @JsonProperty("p95_latency_ms")
    private Long p95LatencyMs;
}
