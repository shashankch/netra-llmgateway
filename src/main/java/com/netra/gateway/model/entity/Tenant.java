package com.netra.gateway.model.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "tenants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "virtual_key", unique = true, nullable = false, length = 64)
    private String virtualKey;

    @Column(nullable = false, length = 128)
    private String team;

    @Column(name = "monthly_budget_usd", nullable = false, precision = 12, scale = 6)
    @Builder.Default
    private BigDecimal monthlyBudgetUsd = new BigDecimal("100.000000");

    @Column(name = "rpm_limit", nullable = false)
    @Builder.Default
    private int rpmLimit = 60;

    @Column(name = "tpm_limit")
    @Builder.Default
    private Integer tpmLimit = 100000;

    @Column(name = "model_allowlist", nullable = false, columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Builder.Default
    private List<String> modelAllowlist = new ArrayList<>();

    @Column(name = "semantic_cache_enabled", nullable = false)
    @Builder.Default
    private boolean semanticCacheEnabled = true;

    @Column(name = "similarity_threshold", nullable = false, precision = 4, scale = 3)
    @Builder.Default
    private BigDecimal similarityThreshold = new BigDecimal("0.850");

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}
