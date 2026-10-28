package com.netra.gateway.model.dto;

import java.util.UUID;

public interface CacheMatchProjection {
    UUID getId();
    String getVirtualKey();
    String getModelAlias();
    String getPromptText();
    String getResolvedProvider();
    String getResponseJson();
    Double getSimilarity();
}
