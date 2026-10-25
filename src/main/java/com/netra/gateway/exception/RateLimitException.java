package com.netra.gateway.exception;

import org.springframework.http.HttpStatus;

public class RateLimitException extends GatewayException {
    public RateLimitException(int rpmLimit) {
        super("Rate limit exceeded (" + rpmLimit + " requests/minute limit)",
                HttpStatus.TOO_MANY_REQUESTS,
                "rate_limit_exceeded",
                "rate_limit_exceeded");
    }
}
