package com.netra.gateway.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.netra.gateway.model.entity.ModelPricing;
import com.netra.gateway.repository.ModelPricingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CostCalculationService {

    private static final BigDecimal ONE_MILLION = new BigDecimal("1000000");
    private final ModelPricingRepository pricingRepository;

    // L1 in-memory near-cache for model pricing schedules (High-Throughput Ingress Optimization)
    private final Cache<String, Optional<ModelPricing>> pricingCache = Caffeine.newBuilder()
            .maximumSize(100)
            .expireAfterWrite(Duration.ofMinutes(10))
            .build();

    /**
     * Calculates cost in USD using exact BigDecimal arithmetic:
     * cost = (promptTokens * inputPer1m / 1,000,000) + (completionTokens * outputPer1m / 1,000,000)
     */
    public BigDecimal calculateCost(String model, int promptTokens, int completionTokens) {
        if (model == null || model.isBlank()) {
            return BigDecimal.ZERO.setScale(6, RoundingMode.HALF_UP);
        }
        Optional<ModelPricing> pricingOpt = pricingCache.get(model, m -> {
            Optional<ModelPricing> direct = pricingRepository.findByModel(m);
            if (direct.isPresent() || m.contains("/")) {
                return direct;
            }
            // Check if catalog has a provider-prefixed model ending with "/model"
            return pricingRepository.findAll().stream()
                    .filter(p -> p.getModel().endsWith("/" + m))
                    .findFirst();
        });
        if (pricingOpt == null || pricingOpt.isEmpty()) {
            log.warn("No pricing found for model [{}], defaulting cost to 0.000000 USD", model);
            return BigDecimal.ZERO.setScale(6, RoundingMode.HALF_UP);
        }

        ModelPricing pricing = pricingOpt.get();
        return calculateCost(pricing.getInputPer1m(), pricing.getOutputPer1m(), promptTokens, completionTokens);
    }

    public void invalidatePricingCache() {
        pricingCache.invalidateAll();
    }

    public BigDecimal calculateCost(BigDecimal inputPer1m, BigDecimal outputPer1m, int promptTokens, int completionTokens) {
        BigDecimal promptCost = BigDecimal.valueOf(promptTokens)
                .multiply(inputPer1m)
                .divide(ONE_MILLION, 10, RoundingMode.HALF_UP);

        BigDecimal completionCost = BigDecimal.valueOf(completionTokens)
                .multiply(outputPer1m)
                .divide(ONE_MILLION, 10, RoundingMode.HALF_UP);

        return promptCost.add(completionCost).setScale(6, RoundingMode.HALF_UP);
    }

    /**
     * Formats cost string for HTTP header x-netra-cost-usd.
     */
    public String formatCostHeader(BigDecimal cost) {
        if (cost == null || cost.compareTo(BigDecimal.ZERO) == 0) {
            return "0";
        }
        return cost.setScale(6, RoundingMode.HALF_UP).toPlainString();
    }
}
