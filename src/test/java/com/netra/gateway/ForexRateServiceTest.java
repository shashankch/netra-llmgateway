package com.netra.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.service.ForexRateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.http.HttpClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ForexRateServiceTest {

    private GatewayConfigProperties properties;
    private HttpClient httpClient;
    private ObjectMapper objectMapper;
    private ForexRateService forexRateService;

    @BeforeEach
    void setUp() {
        properties = new GatewayConfigProperties();
        properties.getCurrency().setFallbackUsdToInr(85.00);
        properties.getCurrency().setCacheTtlHours(6);
        httpClient = mock(HttpClient.class);
        objectMapper = new ObjectMapper();
        forexRateService = new ForexRateService(properties, httpClient, objectMapper);
    }

    @Test
    @DisplayName("Returns configured fallback rate when HTTP call is not mocked")
    void testFallbackRate() {
        BigDecimal rate = forexRateService.getUsdToInrRate();
        assertThat(rate).isEqualTo(BigDecimal.valueOf(85.00).setScale(4, RoundingMode.HALF_UP));
    }

    @Test
    @DisplayName("Accurately converts USD to INR")
    void testConvertUsdToInr() {
        BigDecimal usd = new BigDecimal("10.00");
        BigDecimal inr = forexRateService.convertUsdToInr(usd);
        // 10 * 85.00 = 850.00
        assertThat(inr).isEqualTo(new BigDecimal("850.0000"));
    }

    @Test
    @DisplayName("Accurately converts INR to USD")
    void testConvertInrToUsd() {
        BigDecimal inr = new BigDecimal("850.00");
        BigDecimal usd = forexRateService.convertInrToUsd(inr);
        // 850 / 85.00 = 10.00
        assertThat(usd).isEqualByComparingTo(new BigDecimal("10.000000"));
    }

    @Test
    @DisplayName("Gracefully handles null inputs")
    void testNullInputs() {
        assertThat(forexRateService.convertUsdToInr(null)).isEqualTo(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
        assertThat(forexRateService.convertInrToUsd(null)).isEqualTo(BigDecimal.ZERO.setScale(6, RoundingMode.HALF_UP));
    }
}
