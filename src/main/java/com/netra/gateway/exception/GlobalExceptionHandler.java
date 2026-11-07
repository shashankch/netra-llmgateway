package com.netra.gateway.exception;

import com.netra.gateway.model.dto.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RateLimitException.class)
    public ResponseEntity<ErrorResponse> handleRateLimitException(RateLimitException ex) {
        log.warn("Rate limit breached: {}", ex.getMessage());
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set("Retry-After", String.valueOf(ex.getRetryAfterSeconds()));
        headers.set("RateLimit-Limit", String.valueOf(ex.getRpmLimit()));
        headers.set("RateLimit-Remaining", "0");
        headers.set("RateLimit-Reset", String.valueOf(ex.getRetryAfterSeconds()));
        headers.set("RateLimit-Policy", ex.getRpmLimit() + ";w=60");

        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .headers(headers)
                .body(ErrorResponse.of(ex.getMessage(), ex.getErrorType(), ex.getErrorCode()));
    }

    @ExceptionHandler(GatewayException.class)
    public ResponseEntity<ErrorResponse> handleGatewayException(GatewayException ex) {
        log.warn("Gateway error [{}]: {}", ex.getErrorCode(), ex.getMessage());
        return ResponseEntity.status(ex.getStatus())
                .body(ErrorResponse.of(ex.getMessage(), ex.getErrorType(), ex.getErrorCode()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableMessage(HttpMessageNotReadableException ex) {
        log.warn("Malformed JSON payload: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of("Malformed JSON request payload", "invalid_request_error", "invalid_json"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .findFirst()
                .orElse("Validation failed");
        log.warn("Request validation failed: {}", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(msg, "invalid_request_error", "validation_error"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex, jakarta.servlet.http.HttpServletRequest request) {
        String requestId = com.netra.gateway.context.RequestContext.currentRequestId();
        if (requestId == null && request != null) {
            Object attr = request.getAttribute(com.netra.gateway.context.RequestContext.REQUEST_ID_ATTR);
            if (attr != null) {
                requestId = attr.toString();
            }
        }
        log.error("Unhandled gateway exception [requestId={}]: ", requestId, ex);
        String msg = requestId != null
                ? "An unexpected internal error occurred (Request ID: " + requestId + ")"
                : "An unexpected internal error occurred";
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of(msg, "server_error", "internal_error"));
    }
}
