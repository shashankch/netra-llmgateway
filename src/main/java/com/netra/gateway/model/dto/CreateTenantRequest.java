package com.netra.gateway.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTenantRequest {

    @JsonProperty("virtual_key")
    private String virtualKey;

    private String team;

    @JsonProperty("monthly_budget_usd")
    private BigDecimal monthlyBudgetUsd;

    @JsonProperty("rpm_limit")
    private Integer rpmLimit;

    @JsonProperty("tpm_limit")
    private Integer tpmLimit;

    @JsonProperty("model_allowlist")
    private List<String> modelAllowlist;

    @JsonProperty("semantic_cache_enabled")
    private Boolean semanticCacheEnabled;

    @JsonProperty("similarity_threshold")
    private BigDecimal similarityThreshold;
}

