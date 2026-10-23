package com.netra.gateway.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.model.entity.ModelPricing;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.ModelPricingRepository;
import com.netra.gateway.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class CanonicalDataSeeder implements CommandLineRunner {

    private final ModelPricingRepository pricingRepository;
    private final TenantRepository tenantRepository;
    private final GatewayConfigProperties configProperties;
    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("⚡ Initializing NETRA Canonical Data Seeder...");
        seedModelPricing();
        seedTenants();
        log.info("✅ NETRA Canonical Data Seeding Complete.");
    }

    public void seedModelPricing() {
        try {
            JsonNode rootNode = loadJsonNode("model_pricing.json");
            if (rootNode == null) {
                log.warn("Could not locate model_pricing.json");
                return;
            }

            int count = 0;
            Iterator<Map.Entry<String, JsonNode>> fields = rootNode.properties().iterator();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                String model = entry.getKey();
                if (model.startsWith("_")) {
                    continue;
                }
                JsonNode priceNode = entry.getValue();
                BigDecimal inputPer1m = new BigDecimal(priceNode.get("input_per_1m").asText());
                BigDecimal outputPer1m = new BigDecimal(priceNode.get("output_per_1m").asText());
                String provider = model.contains("-") ? model.substring(0, model.indexOf('-')) : "default";

                ModelPricing pricing = pricingRepository.findByModel(model)
                        .orElse(ModelPricing.builder().model(model).build());

                pricing.setProvider(provider);
                pricing.setInputPer1m(inputPer1m);
                pricing.setOutputPer1m(outputPer1m);
                pricingRepository.save(pricing);
                count++;
            }
            log.info("Seeded {} model pricing records into database", count);
        } catch (Exception e) {
            log.error("Failed to seed model pricing: {}", e.getMessage(), e);
        }
    }

    public void seedTenants() {
        try {
            JsonNode rootNode = loadJsonNode("seed_keys.json");
            if (rootNode == null) {
                log.warn("Could not locate seed_keys.json");
                return;
            }

            JsonNode tenantsNode = rootNode.get("tenants");
            if (tenantsNode == null || !tenantsNode.isArray()) {
                log.warn("No 'tenants' array in seed_keys.json");
                return;
            }

            int count = 0;
            for (JsonNode tNode : tenantsNode) {
                String virtualKey = tNode.get("virtual_key").asText();
                String team = tNode.get("team").asText();
                BigDecimal monthlyBudget = new BigDecimal(tNode.get("monthly_budget_usd").asText());

                int rpmLimit = 60;
                Integer tpmLimit = 100000;
                if (tNode.has("rate_limit")) {
                    JsonNode rateNode = tNode.get("rate_limit");
                    if (rateNode.has("requests_per_minute")) {
                        rpmLimit = rateNode.get("requests_per_minute").asInt();
                    }
                    if (rateNode.has("tokens_per_minute")) {
                        tpmLimit = rateNode.get("tokens_per_minute").asInt();
                    }
                }

                List<String> allowlist = new ArrayList<>();
                if (tNode.has("model_allowlist")) {
                    for (JsonNode mNode : tNode.get("model_allowlist")) {
                        allowlist.add(mNode.asText());
                    }
                }

                boolean cacheEnabled = true;
                BigDecimal similarityThreshold = new BigDecimal("0.850");
                if (tNode.has("semantic_cache")) {
                    JsonNode cacheNode = tNode.get("semantic_cache");
                    if (cacheNode.has("enabled")) {
                        cacheEnabled = cacheNode.get("enabled").asBoolean();
                    }
                    if (cacheNode.has("similarity_threshold")) {
                        similarityThreshold = new BigDecimal(cacheNode.get("similarity_threshold").asText());
                    }
                }

                Tenant tenant = tenantRepository.findByVirtualKey(virtualKey)
                        .orElse(Tenant.builder().virtualKey(virtualKey).build());

                tenant.setTeam(team);
                tenant.setMonthlyBudgetUsd(monthlyBudget);
                tenant.setRpmLimit(rpmLimit);
                tenant.setTpmLimit(tpmLimit);
                tenant.setModelAllowlist(allowlist);
                tenant.setSemanticCacheEnabled(cacheEnabled);
                tenant.setSimilarityThreshold(similarityThreshold);
                tenant.setActive(true);

                tenantRepository.save(tenant);
                count++;
            }
            log.info("Seeded {} tenants into database", count);
        } catch (Exception e) {
            log.error("Failed to seed tenants: {}", e.getMessage(), e);
        }
    }

    private JsonNode loadJsonNode(String filename) throws Exception {
        // Try file path from config data directory first
        Path path = Paths.get(configProperties.getDataPath(), filename);
        if (Files.exists(path)) {
            return objectMapper.readTree(path.toFile());
        }

        // Try project root path
        Path rootPath = Paths.get("data", filename);
        if (Files.exists(rootPath)) {
            return objectMapper.readTree(rootPath.toFile());
        }

        // Try classpath resource
        Resource resource = resourceLoader.getResource("classpath:data/" + filename);
        if (resource.exists()) {
            try (InputStream is = resource.getInputStream()) {
                return objectMapper.readTree(is);
            }
        }

        return null;
    }
}
