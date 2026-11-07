package com.netra.gateway.exception;

import org.springframework.http.HttpStatus;

public class RateLimitException extends GatewayException {
    private final int rpmLimit;
    private final int retryAfterSeconds;

    public RateLimitException(int rpmLimit) {
        this(rpmLimit, 60);
    }

    public RateLimitException(int rpmLimit, int retryAfterSeconds) {
        super("Rate limit exceeded (" + rpmLimit + " requests/minute limit)",
                HttpStatus.TOO_MANY_REQUESTS,
                "rate_limit_exceeded",
                "rate_limit_exceeded");
        this.rpmLimit = rpmLimit;
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    public int getRpmLimit() {
        return rpmLimit;
    }

    public int getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
