package com.netra.gateway.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class GatewayException extends RuntimeException {

    private final HttpStatus status;
    private final String errorType;
    private final String errorCode;

    public GatewayException(String message, HttpStatus status, String errorType, String errorCode) {
        super(message);
        this.status = status;
        this.errorType = errorType;
        this.errorCode = errorCode;
    }
}
