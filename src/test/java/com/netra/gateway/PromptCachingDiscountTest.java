package com.netra.gateway;

import com.netra.gateway.model.entity.ModelPricing;
import com.netra.gateway.repository.ModelPricingRepository;
import com.netra.gateway.service.CostCalculationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PromptCachingDiscountTest {

    @Mock
    private ModelPricingRepository pricingRepository;

    private CostCalculationService costService;

    @BeforeEach
    void setUp() {
        costService = new CostCalculationService(pricingRepository);

        ModelPricing gpt4oMiniPricing = ModelPricing.builder()
                .model("openai/gpt-4o-mini")
                .provider("openai")
                .inputPer1m(new BigDecimal("0.1500"))   // $0.15 per 1M input tokens
                .outputPer1m(new BigDecimal("0.6000"))  // $0.60 per 1M output tokens
                .build();

        when(pricingRepository.findByModel("openai/gpt-4o-mini")).thenReturn(Optional.of(gpt4oMiniPricing));
    }

    @Test
    @DisplayName("Applies 50% discount to cached input tokens in cost calculation")
    void testPromptCachingDiscountApplied() {
        int promptTokens = 2000;
        int completionTokens = 500;
        int cachedTokens = 1500; // 1,500 of 2,000 prompt tokens were cached

        // Standard without cache discount:
        // (2000 * 0.15 / 1,000,000) + (500 * 0.60 / 1,000,000) = 0.000300 + 0.000300 = $0.000600
        BigDecimal standardCost = costService.calculateCost("openai/gpt-4o-mini", promptTokens, completionTokens, 0);
        assertThat(standardCost).isEqualByComparingTo(new BigDecimal("0.000600"));

        // With 1500 cached tokens (50% discount on 1500 tokens):
        // Non-cached prompt: 500 * 0.15 / 1,000,000 = $0.000075
        // Cached prompt: 1500 * 0.075 / 1,000,000 = $0.0001125
        // Total prompt: $0.0001875
        // Completion: 500 * 0.60 / 1,000,000 = $0.000300
        // Total: 0.0001875 + 0.000300 = 0.0004875 -> $0.000488
        BigDecimal discountedCost = costService.calculateCost("openai/gpt-4o-mini", promptTokens, completionTokens, cachedTokens);
        assertThat(discountedCost).isEqualByComparingTo(new BigDecimal("0.000488"));

        // Discount saved: $0.000600 - $0.000488 = $0.000112
        assertThat(discountedCost).isLessThan(standardCost);
    }
}
