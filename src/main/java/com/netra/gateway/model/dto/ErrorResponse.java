package com.netra.gateway.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    private ErrorDetail error;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ErrorDetail {
        private String message;
        private String type;
        private String code;
    }

    public static ErrorResponse of(String message, String type, String code) {
        return ErrorResponse.builder()
                .error(ErrorDetail.builder()
                        .message(message)
                        .type(type)
                        .code(code)
                        .build())
                .build();
    }
}
