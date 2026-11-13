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
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.Optional;
import java.util.Map;

@Slf4j
@Component
public class CanonicalDataSeeder implements CommandLineRunner {

    private final ModelPricingRepository pricingRepository;
    private final TenantRepository tenantRepository;
    private final GatewayConfigProperties configProperties;
    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;
    private final TenantAuthService tenantAuthService;
    private volatile boolean seedingComplete = false;

    public boolean isSeedingComplete() {
        return seedingComplete;
    }

    @Autowired
    public CanonicalDataSeeder(
            ModelPricingRepository pricingRepository,
            TenantRepository tenantRepository,
            GatewayConfigProperties configProperties,
            ObjectMapper objectMapper,
            ResourceLoader resourceLoader,
            Optional<TenantAuthService> tenantAuthService
    ) {
        this.pricingRepository = pricingRepository;
        this.tenantRepository = tenantRepository;
        this.configProperties = configProperties;
        this.objectMapper = objectMapper;
        this.resourceLoader = resourceLoader;
        this.tenantAuthService = tenantAuthService.orElse(null);
    }

    public CanonicalDataSeeder(
            ModelPricingRepository pricingRepository,
            TenantRepository tenantRepository,
            GatewayConfigProperties configProperties,
            ObjectMapper objectMapper,
            ResourceLoader resourceLoader
    ) {
        this(pricingRepository, tenantRepository, configProperties, objectMapper, resourceLoader, Optional.empty());
    }

    @Override
    public void run(String... args) {
        log.info("⚡ Initializing NETRA Canonical Data Seeder...");
        try {
            seedTenants();
            seedModelPricing();
            this.seedingComplete = true;
            log.info("✅ NETRA Canonical Data Seeding Complete.");
        } catch (Exception e) {
            this.seedingComplete = false;
            log.error("❌ NETRA Canonical Data Seeding encountered failure: {}", e.getMessage(), e);
        }
    }

    @Transactional
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
                String provider = model.contains("/") ? model.substring(0, model.indexOf('/')) : (model.contains("-") ? model.substring(0, model.indexOf('-')) : "default");

                ModelPricing pricing = pricingRepository.findByModel(model)
                        .orElse(ModelPricing.builder().model(model).build());

                pricing.setProvider(provider);
                pricing.setInputPer1m(inputPer1m);
                pricing.setOutputPer1m(outputPer1m);
                pricingRepository.save(pricing);
                count++;
            }
            pricingRepository.flush();
            log.info("Seeded and flushed {} model pricing records into database", count);
        } catch (Exception e) {
            log.error("Failed to seed model pricing: {}", e.getMessage(), e);
        }
    }

    @Transactional
    public void seedTenants() {
        if (!configProperties.isSeedDemoTenants()) {
            log.info("Demo tenant seeding is disabled in production profile (netra.seed-demo-tenants=false). Virtual keys must be provisioned via admin API.");
            return;
        }
        try {
            JsonNode rootNode = loadJsonNode("seed_keys.json");
            if (rootNode == null) {
                log.error("CRITICAL: Could not locate seed_keys.json — demo tenants will NOT be seeded!");
                return;
            }

            JsonNode tenantsNode = rootNode.get("tenants");
            if (tenantsNode == null || !tenantsNode.isArray()) {
                log.error("CRITICAL: No 'tenants' array in seed_keys.json");
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

                Optional<Tenant> existingTenant = tenantRepository.findByVirtualKey(virtualKey);
                if (existingTenant.isPresent()) {
                    log.debug("Tenant [{}] already exists in database; skipping seed to preserve runtime operator state", virtualKey);
                    continue;
                }

                Tenant tenant = Tenant.builder()
                        .virtualKey(virtualKey)
                        .team(team)
                        .monthlyBudgetUsd(monthlyBudget)
                        .rpmLimit(rpmLimit)
                        .tpmLimit(tpmLimit)
                        .modelAllowlist(allowlist)
                        .semanticCacheEnabled(cacheEnabled)
                        .similarityThreshold(similarityThreshold)
                        .isActive(true)
                        .build();

                tenantRepository.save(tenant);
                if (tenantAuthService != null) {
                    tenantAuthService.invalidate(virtualKey);
                }
                count++;
            }
            tenantRepository.flush();
            log.info("Seeded and flushed {} demo tenants into database", count);
        } catch (Exception e) {
            log.error("Failed to seed tenants: {}", e.getMessage(), e);
        }
    }

    private JsonNode loadJsonNode(String filename) throws Exception {
        // 1. Try file path from config data directory first
        Path path = Paths.get(configProperties.getDataPath(), filename);
        if (Files.exists(path)) {
            log.info("Loaded {} from config data path: {}", filename, path.toAbsolutePath());
            return objectMapper.readTree(path.toFile());
        }

        // 2. Try absolute container /app/data path
        Path containerPath = Paths.get("/app/data", filename);
        if (Files.exists(containerPath)) {
            log.info("Loaded {} from container path: {}", filename, containerPath.toAbsolutePath());
            return objectMapper.readTree(containerPath.toFile());
        }

        // 3. Try project root path
        Path rootPath = Paths.get("data", filename);
        if (Files.exists(rootPath)) {
            log.info("Loaded {} from project root path: {}", filename, rootPath.toAbsolutePath());
            return objectMapper.readTree(rootPath.toFile());
        }

        // 4. Try classpath resource
        Resource resource = resourceLoader.getResource("classpath:data/" + filename);
        if (resource.exists()) {
            log.info("Loaded {} from classpath: classpath:data/{}", filename, filename);
            try (InputStream is = resource.getInputStream()) {
                return objectMapper.readTree(is);
            }
        }

        Resource slashResource = resourceLoader.getResource("classpath:/data/" + filename);
        if (slashResource.exists()) {
            log.info("Loaded {} from classpath: classpath:/data/{}", filename, filename);
            try (InputStream is = slashResource.getInputStream()) {
                return objectMapper.readTree(is);
            }
        }

        // 5. Try classloader stream
        InputStream classLoaderStream = getClass().getClassLoader().getResourceAsStream("data/" + filename);
        if (classLoaderStream != null) {
            log.info("Loaded {} from ClassLoader stream: data/{}", filename, filename);
            try (classLoaderStream) {
                return objectMapper.readTree(classLoaderStream);
            }
        }

        InputStream classResourceStream = getClass().getResourceAsStream("/data/" + filename);
        if (classResourceStream != null) {
            log.info("Loaded {} from Class resource stream: /data/{}", filename, filename);
            try (classResourceStream) {
                return objectMapper.readTree(classResourceStream);
            }
        }

        log.error("CRITICAL: Failed to locate [{}] in configPath={}, /app/data, data/, or classpath:data/!",
                filename, configProperties.getDataPath());
        return null;
    }
}
