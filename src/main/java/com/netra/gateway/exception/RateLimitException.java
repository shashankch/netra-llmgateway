package com.netra.gateway.exception;

import org.springframework.http.HttpStatus;

public class RateLimitException extends GatewayException {
    private final int limit;
    private final int retryAfterSeconds;
    private final String limitType;

    public RateLimitException(int rpmLimit) {
        this(rpmLimit, 60, "requests/minute");
    }

    public RateLimitException(int limit, int retryAfterSeconds) {
        this(limit, retryAfterSeconds, "requests/minute");
    }

    public RateLimitException(int limit, int retryAfterSeconds, String limitType) {
        super("Rate limit exceeded (" + limit + " " + limitType + " limit)",
                HttpStatus.TOO_MANY_REQUESTS,
                "tokens/minute".equals(limitType) ? "tpm_limit_exceeded" : "rate_limit_exceeded",
                "tokens/minute".equals(limitType) ? "tpm_limit_exceeded" : "rate_limit_exceeded");
        this.limit = limit;
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
        this.limitType = limitType;
    }

    public int getRpmLimit() {
        return limit;
    }

    public int getLimit() {
        return limit;
    }

    public int getRetryAfterSeconds() {
        return retryAfterSeconds;
    }

    public String getLimitType() {
        return limitType;
    }
}
