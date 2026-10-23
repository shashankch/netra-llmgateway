package com.netra.gateway.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@ConfigurationProperties(prefix = "netra")
public class GatewayConfigProperties {

    private String dataPath = "data";
    private CurrencyConfig currency = new CurrencyConfig();
    private List<ProviderConfig> providers = new ArrayList<>();
    private Map<String, ModelAliasConfig> modelAliases = new HashMap<>();
    private RetryConfig retry = new RetryConfig();
    private DegradationConfig degradation = new DegradationConfig();

    @Data
    public static class CurrencyConfig {
        private double fallbackUsdToInr = 87.50;
        private int cacheTtlHours = 6;
    }

    @Data
    public static class ProviderConfig {
        private String name;
        private String baseUrl;
        private String apiKey;
    }

    @Data
    public static class ModelAliasConfig {
        private String primary;
        private List<String> fallbacks = new ArrayList<>();
        private Map<String, String> routeByDifficulty = new HashMap<>();
    }

    @Data
    public static class RetryConfig {
        private int maxAttempts = 3;
        private long initialBackoffMs = 200;
        private double backoffMultiplier = 2.0;
    }

    @Data
    public static class DegradationConfig {
        private double errorRateThreshold = 0.5;
        private int windowSeconds = 60;
        private long p95LatencyMs = 5000;
    }

    public ProviderConfig getProvider(String providerName) {
        return providers.stream()
                .filter(p -> p.getName().equalsIgnoreCase(providerName))
                .findFirst()
                .orElse(null);
    }
}
