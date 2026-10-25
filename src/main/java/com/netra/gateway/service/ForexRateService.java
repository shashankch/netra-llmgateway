package com.netra.gateway.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.netra.gateway.config.GatewayConfigProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Slf4j
@Service
public class ForexRateService {

    private final GatewayConfigProperties configProperties;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Cache<String, BigDecimal> rateCache;

    public ForexRateService(GatewayConfigProperties configProperties, HttpClient httpClient, ObjectMapper objectMapper) {
        this.configProperties = configProperties;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        int ttlHours = configProperties.getCurrency().getCacheTtlHours();
        this.rateCache = Caffeine.newBuilder()
                .maximumSize(100)
                .expireAfterWrite(Duration.ofHours(ttlHours > 0 ? ttlHours : 6))
                .build();
    }

    /**
     * Gets the current live USD to INR exchange rate with 6-hour Caffeine caching and fallback.
     */
    public BigDecimal getUsdToInrRate() {
        return rateCache.get("USD_INR", k -> fetchLiveRate());
    }

    private BigDecimal fetchLiveRate() {
        double fallback = configProperties.getCurrency().getFallbackUsdToInr();
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR"))
                    .timeout(Duration.ofSeconds(2))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode inrNode = root.path("rates").path("INR");
                if (!inrNode.isMissingNode() && inrNode.isNumber()) {
                    BigDecimal liveRate = BigDecimal.valueOf(inrNode.asDouble()).setScale(4, RoundingMode.HALF_UP);
                    log.info("Successfully fetched live forex rate: 1 USD = {} INR", liveRate);
                    return liveRate;
                }
            }
        } catch (Exception e) {
            log.warn("Forex API fetch failed (operating in offline fallback mode): {}", e.getMessage());
        }
        return BigDecimal.valueOf(fallback).setScale(4, RoundingMode.HALF_UP);
    }

    /**
     * Converts a USD amount to INR using the active exchange rate.
     */
    public BigDecimal convertUsdToInr(BigDecimal usd) {
        if (usd == null) {
            return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        }
        return usd.multiply(getUsdToInrRate()).setScale(4, RoundingMode.HALF_UP);
    }

    /**
     * Converts an INR amount to USD using the active exchange rate.
     */
    public BigDecimal convertInrToUsd(BigDecimal inr) {
        if (inr == null) {
            return BigDecimal.ZERO.setScale(6, RoundingMode.HALF_UP);
        }
        return inr.divide(getUsdToInrRate(), 6, RoundingMode.HALF_UP);
    }
}
