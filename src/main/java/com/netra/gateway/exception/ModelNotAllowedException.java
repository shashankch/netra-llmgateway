package com.netra.gateway.exception;

import org.springframework.http.HttpStatus;

public class ModelNotAllowedException extends GatewayException {
    public ModelNotAllowedException(String model) {
        super("Model '" + model + "' is not permitted for this virtual key",
                HttpStatus.FORBIDDEN, "model_not_allowed", "model_not_allowed");
    }
}
