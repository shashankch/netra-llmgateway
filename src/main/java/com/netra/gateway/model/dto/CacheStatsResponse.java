package com.netra.gateway.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CacheStatsResponse {

    @JsonProperty("total_entries")
    private long totalEntries;

    @JsonProperty("total_hits")
    private long totalHits;

    @JsonProperty("total_misses")
    private long totalMisses;

    @JsonProperty("hit_rate")
    private double hitRate;

    @JsonProperty("keys")
    @Builder.Default
    private Map<String, KeyCacheStats> keys = new HashMap<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeyCacheStats {
        @JsonProperty("entries")
        private long entries;

        @JsonProperty("hits")
        private long hits;

        @JsonProperty("misses")
        private long misses;

        @JsonProperty("hit_rate")
        private double hitRate;
    }
}
