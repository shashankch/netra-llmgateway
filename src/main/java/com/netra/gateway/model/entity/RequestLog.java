package com.netra.gateway.model.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "request_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RequestLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonProperty("request_id")
    @Column(name = "request_id", nullable = false, length = 64)
    private String requestId;

    @JsonProperty("virtual_key")
    @Column(name = "virtual_key", nullable = false, length = 64)
    private String virtualKey;

    @JsonProperty("requested_model")
    @Column(name = "requested_model", nullable = false, length = 64)
    private String requestedModel;

    @JsonProperty("resolved_provider")
    @Column(name = "resolved_provider", length = 64)
    private String resolvedProvider;

    @JsonProperty("resolved_model")
    @Column(name = "resolved_model", length = 64)
    private String resolvedModel;

    @Column(nullable = false, length = 32)
    private String status;

    @JsonProperty("status_code")
    @Column(name = "status_code", nullable = false)
    private int statusCode;

    @JsonProperty("prompt_tokens")
    @Column(name = "prompt_tokens", nullable = false)
    @Builder.Default
    private int promptTokens = 0;

    @JsonProperty("completion_tokens")
    @Column(name = "completion_tokens", nullable = false)
    @Builder.Default
    private int completionTokens = 0;

    @JsonProperty("cost_usd")
    @Column(name = "cost_usd", nullable = false, precision = 12, scale = 6)
    @Builder.Default
    private BigDecimal costUsd = BigDecimal.ZERO;

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String cache = "miss";

    @Column(nullable = false)
    @Builder.Default
    private boolean fallback = false;

    @JsonProperty("route_reason")
    @Column(name = "route_reason", length = 256)
    private String routeReason;

    @Column(nullable = false)
    @Builder.Default
    private int retries = 0;

    @JsonProperty("latency_ms")
    @Column(name = "latency_ms", nullable = false)
    private long latencyMs;

    @JsonProperty("is_stream")
    @Column(name = "is_stream", nullable = false)
    @Builder.Default
    private boolean isStream = false;

    @JsonProperty("error_type")
    @Column(name = "error_type", length = 64)
    private String errorType;

    @Column(nullable = false)
    @Builder.Default
    private boolean escalated = false;

    @JsonProperty("cache_tier")
    @Column(name = "cache_tier", length = 32)
    private String cacheTier;

    @JsonProperty("created_at")
    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}
