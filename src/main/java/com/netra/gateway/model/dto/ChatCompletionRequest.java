package com.netra.gateway.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatCompletionRequest {

    private String model;

    private List<ChatMessage> messages;

    @Builder.Default
    private Boolean stream = false;

    private Double temperature;

    @JsonProperty("max_tokens")
    private Integer maxTokens;
}
