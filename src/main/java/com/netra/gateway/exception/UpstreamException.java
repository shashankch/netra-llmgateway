package com.netra.gateway.exception;

import org.springframework.http.HttpStatus;

public class UpstreamException extends GatewayException {
    public UpstreamException(String message) {
        super(message, HttpStatus.BAD_GATEWAY, "upstream_error", "upstream_unavailable");
    }
}
