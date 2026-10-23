package com.netra.gateway.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "monthly_spend")
@IdClass(MonthlySpendId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlySpend {

    @Id
    @Column(name = "virtual_key", nullable = false, length = 64)
    private String virtualKey;

    @Id
    @Column(name = "year_month", nullable = false, length = 7)
    private String yearMonth;

    @Column(name = "total_spend_usd", nullable = false, precision = 12, scale = 6)
    @Builder.Default
    private BigDecimal totalSpendUsd = BigDecimal.ZERO;

    @Column(name = "request_count", nullable = false)
    @Builder.Default
    private long requestCount = 0;

    @Column(name = "total_prompt_tokens", nullable = false)
    @Builder.Default
    private long totalPromptTokens = 0;

    @Column(name = "total_completion_tokens", nullable = false)
    @Builder.Default
    private long totalCompletionTokens = 0;

    @Column(name = "cache_hits", nullable = false)
    @Builder.Default
    private long cacheHits = 0;
}
