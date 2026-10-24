package com.netra.gateway.exception;

import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.Locale;

public class BudgetExceededException extends GatewayException {
    public BudgetExceededException(BigDecimal budgetUsd) {
        super(String.format(Locale.US, "Monthly budget of $%.2f exhausted for this key", budgetUsd),
                HttpStatus.PAYMENT_REQUIRED,
                "budget_exceeded",
                "budget_exceeded");
    }
}
