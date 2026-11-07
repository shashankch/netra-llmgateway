package com.netra.gateway.service;

/**
 * Standardized admission check result carrying IETF RateLimit parameters.
 * Compliant with draft-ietf-httpapi-ratelimit-headers.
 */
public record AdmissionResult(
        int statusCode,
        int limit,
        int remaining,
        int resetSeconds,
        String policy
) {
    public static AdmissionResult admitted(int limit, int remaining, int resetSeconds) {
        return new AdmissionResult(200, limit, remaining, resetSeconds, limit + ";w=60");
    }

    public static AdmissionResult defaultAdmitted(int limit) {
        if (limit <= 0) {
            return new AdmissionResult(429, limit, 0, 60, "0;w=60");
        }
        return new AdmissionResult(200, limit, Math.max(0, limit - 1), 60, limit + ";w=60");
    }
}
