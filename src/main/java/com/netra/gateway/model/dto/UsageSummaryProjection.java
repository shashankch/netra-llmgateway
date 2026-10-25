package com.netra.gateway.model.dto;

import java.math.BigDecimal;

public interface UsageSummaryProjection {
    long getRequestCount();
    long getTotalPromptTokens();
    long getTotalCompletionTokens();
    BigDecimal getTotalCostUsd();
    long getCacheHits();
}
