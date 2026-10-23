package com.netra.gateway.exception;

import org.springframework.http.HttpStatus;

public class InvalidRequestException extends GatewayException {
    public InvalidRequestException(String message) {
        super(message, HttpStatus.BAD_REQUEST, "invalid_request_error", "invalid_request");
    }
}
