package com.netra.gateway.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UsageSummaryResponse {

    private String key;
    private String from;
    private String to;
    private long requests;

    @JsonProperty("prompt_tokens")
    private long promptTokens;

    @JsonProperty("completion_tokens")
    private long completionTokens;

    @JsonProperty("cost_usd")
    private BigDecimal costUsd;

    @JsonProperty("cache_hits")
    private long cacheHits;
}
