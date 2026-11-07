package com.netra.gateway.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Detailed view of a cached prompt completion entry for operator inspection.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CacheEntryDetailDto {

    private UUID id;

    @JsonProperty("virtual_key")
    private String virtualKey;

    @JsonProperty("model_alias")
    private String modelAlias;

    @JsonProperty("prompt_text")
    private String promptText;

    @JsonProperty("resolved_provider")
    private String resolvedProvider;

    @JsonProperty("completion_text")
    private String completionText;

    @JsonProperty("response_json")
    private String responseJson;

    @JsonProperty("hit_count")
    private int hitCount;

    @JsonProperty("created_at")
    private Instant createdAt;

    @JsonProperty("last_hit_at")
    private Instant lastHitAt;

    @JsonProperty("similarity_threshold")
    private Double similarityThreshold;

    @JsonProperty("tier")
    private String tier;
}
