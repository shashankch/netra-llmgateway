package com.netra.gateway.exception;

import org.springframework.http.HttpStatus;

public class AuthenticationException extends GatewayException {
    public AuthenticationException(String message) {
        super(message, HttpStatus.UNAUTHORIZED, "authentication_error", "invalid_api_key");
    }
}
