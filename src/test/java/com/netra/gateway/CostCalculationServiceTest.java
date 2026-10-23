package com.netra.gateway;

import com.netra.gateway.model.entity.ModelPricing;
import com.netra.gateway.repository.ModelPricingRepository;
import com.netra.gateway.service.CostCalculationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CostCalculationServiceTest {

    @Mock
    private ModelPricingRepository pricingRepository;

    @InjectMocks
    private CostCalculationService costService;

    @Test
    @DisplayName("Calculate exact cost for alpha-small with 5 prompt tokens and 17 completion tokens")
    void testExactCostAlphaSmall() {
        // alpha-small: input: $0.15 / 1M, output: $0.60 / 1M
        // prompt cost = (5 * 0.15) / 1,000,000 = 0.75 / 1,000,000 = 0.00000075
        // completion cost = (17 * 0.60) / 1,000,000 = 10.2 / 1,000,000 = 0.00001020
        // total = 0.00001095 -> rounded to 6 decimal places = 0.000011 USD
        when(pricingRepository.findByModel("alpha-small")).thenReturn(Optional.of(
                ModelPricing.builder()
                        .model("alpha-small")
                        .provider("alpha")
                        .inputPer1m(new BigDecimal("0.15"))
                        .outputPer1m(new BigDecimal("0.60"))
                        .build()
        ));

        BigDecimal cost = costService.calculateCost("alpha-small", 5, 17);
        assertThat(cost).isEqualByComparingTo(new BigDecimal("0.000011"));
        assertThat(costService.formatCostHeader(cost)).isEqualTo("0.000011");
    }

    @Test
    @DisplayName("Calculate exact cost for alpha-large with 100 prompt and 200 completion tokens")
    void testExactCostAlphaLarge() {
        // alpha-large: input: $3.00 / 1M, output: $15.00 / 1M
        // prompt cost = (100 * 3.00) / 1,000,000 = 300 / 1,000,000 = 0.000300
        // completion cost = (200 * 15.00) / 1,000,000 = 3000 / 1,000,000 = 0.003000
        // total = 0.003300 USD
        when(pricingRepository.findByModel("alpha-large")).thenReturn(Optional.of(
                ModelPricing.builder()
                        .model("alpha-large")
                        .provider("alpha")
                        .inputPer1m(new BigDecimal("3.00"))
                        .outputPer1m(new BigDecimal("15.00"))
                        .build()
        ));

        BigDecimal cost = costService.calculateCost("alpha-large", 100, 200);
        assertThat(cost).isEqualByComparingTo(new BigDecimal("0.003300"));
        assertThat(costService.formatCostHeader(cost)).isEqualTo("0.003300");
    }

    @Test
    @DisplayName("Zero cost formats to '0'")
    void testZeroCostHeaderFormatting() {
        assertThat(costService.formatCostHeader(BigDecimal.ZERO)).isEqualTo("0");
        assertThat(costService.formatCostHeader(null)).isEqualTo("0");
    }

    @Test
    @DisplayName("Unknown model pricing defaults to 0.000000 USD without throwing exception")
    void testUnknownModelPricing() {
        when(pricingRepository.findByModel("unknown-model")).thenReturn(Optional.empty());

        BigDecimal cost = costService.calculateCost("unknown-model", 50, 50);
        assertThat(cost).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(costService.formatCostHeader(cost)).isEqualTo("0");
    }
}
