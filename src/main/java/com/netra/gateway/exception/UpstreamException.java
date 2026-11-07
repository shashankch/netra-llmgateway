package com.netra.gateway.exception;

import org.springframework.http.HttpStatus;

public class UpstreamException extends GatewayException {

    private final int upstreamStatusCode;

    public UpstreamException(String message) {
        this(HttpStatus.BAD_GATEWAY.value(), message);
    }

    public UpstreamException(int statusCode, String message) {
        super(
                message,
                (statusCode >= 400 && HttpStatus.resolve(statusCode) != null) ? HttpStatus.resolve(statusCode) : HttpStatus.BAD_GATEWAY,
                statusCode == 429 ? "rate_limit_error" : (statusCode >= 400 && statusCode < 500 ? "invalid_request_error" : "upstream_error"),
                statusCode == 429 ? "upstream_throttled" : (statusCode >= 400 && statusCode < 500 ? "upstream_bad_request" : "upstream_unavailable")
        );
        this.upstreamStatusCode = statusCode >= 400 ? statusCode : 502;
    }

    public int getUpstreamStatusCode() {
        return upstreamStatusCode;
    }

    public boolean isClientError() {
        return upstreamStatusCode >= 400 && upstreamStatusCode < 500 && upstreamStatusCode != 429;
    }

    public boolean isRequestSpecificError() {
        return upstreamStatusCode == 400 || upstreamStatusCode == 422;
    }

    public boolean isThrottled() {
        return upstreamStatusCode == 429;
    }
}
