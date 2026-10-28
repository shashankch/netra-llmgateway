package com.netra.gateway.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantAdminResponse {

    private UUID id;

    @JsonProperty("virtual_key")
    private String virtualKey;

    private String team;

    @JsonProperty("monthly_budget_usd")
    private BigDecimal monthlyBudgetUsd;

    @JsonProperty("current_spend_usd")
    private BigDecimal currentSpendUsd;

    @JsonProperty("rpm_limit")
    private int rpmLimit;

    @JsonProperty("tpm_limit")
    private Integer tpmLimit;

    @JsonProperty("model_allowlist")
    private List<String> modelAllowlist;

    @JsonProperty("semantic_cache_enabled")
    private boolean semanticCacheEnabled;

    @JsonProperty("similarity_threshold")
    private BigDecimal similarityThreshold;

    @JsonProperty("is_active")
    private boolean isActive;

    private String status; // ACTIVE, EXHAUSTED, REVOKED

    @JsonProperty("created_at")
    private Instant createdAt;
}
