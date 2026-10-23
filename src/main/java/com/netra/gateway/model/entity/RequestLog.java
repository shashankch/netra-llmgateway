package com.netra.gateway.model.entity;

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

    @Column(name = "request_id", nullable = false, length = 64)
    private String requestId;

    @Column(name = "virtual_key", nullable = false, length = 64)
    private String virtualKey;

    @Column(name = "requested_model", nullable = false, length = 64)
    private String requestedModel;

    @Column(name = "resolved_provider", length = 64)
    private String resolvedProvider;

    @Column(name = "resolved_model", length = 64)
    private String resolvedModel;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "status_code", nullable = false)
    private int statusCode;

    @Column(name = "prompt_tokens", nullable = false)
    @Builder.Default
    private int promptTokens = 0;

    @Column(name = "completion_tokens", nullable = false)
    @Builder.Default
    private int completionTokens = 0;

    @Column(name = "cost_usd", nullable = false, precision = 12, scale = 6)
    @Builder.Default
    private BigDecimal costUsd = BigDecimal.ZERO;

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String cache = "miss";

    @Column(nullable = false)
    @Builder.Default
    private boolean fallback = false;

    @Column(name = "route_reason", length = 256)
    private String routeReason;

    @Column(nullable = false)
    @Builder.Default
    private int retries = 0;

    @Column(name = "latency_ms", nullable = false)
    private long latencyMs;

    @Column(name = "is_stream", nullable = false)
    @Builder.Default
    private boolean isStream = false;

    @Column(name = "error_type", length = 64)
    private String errorType;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}
