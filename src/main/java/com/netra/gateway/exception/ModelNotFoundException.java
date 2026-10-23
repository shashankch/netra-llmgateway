package com.netra.gateway.exception;

import org.springframework.http.HttpStatus;

public class ModelNotFoundException extends GatewayException {
    public ModelNotFoundException(String model) {
        super("Unknown model or alias '" + model + "'",
                HttpStatus.NOT_FOUND, "not_found_error", "model_not_found");
    }
}
