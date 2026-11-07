package com.netra.gateway.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.exception.ModelNotFoundException;
import com.netra.gateway.exception.UpstreamException;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.model.entity.ModelPricing;
import com.netra.gateway.repository.ModelPricingRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class UpstreamClientService {

    private final GatewayConfigProperties configProperties;
    private final ModelPricingRepository pricingRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final PromptDifficultyClassifier difficultyClassifier;
    private final ProviderCircuitBreakerService circuitBreakerService;

    public UpstreamClientService(
            GatewayConfigProperties configProperties,
            ModelPricingRepository pricingRepository,
            ObjectMapper objectMapper,
            HttpClient httpClient,
            PromptDifficultyClassifier difficultyClassifier
    ) {
        this(configProperties, pricingRepository, objectMapper, httpClient, difficultyClassifier, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public UpstreamClientService(
            GatewayConfigProperties configProperties,
            ModelPricingRepository pricingRepository,
            ObjectMapper objectMapper,
            HttpClient httpClient,
            PromptDifficultyClassifier difficultyClassifier,
            @org.springframework.beans.factory.annotation.Autowired(required = false) ProviderCircuitBreakerService circuitBreakerService
    ) {
        this.configProperties = configProperties;
        this.pricingRepository = pricingRepository;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
        this.difficultyClassifier = difficultyClassifier;
        this.circuitBreakerService = circuitBreakerService;
    }

    @Data
    @Builder
    public static class UpstreamResult {
        private ChatCompletionResponse response;
        private String resolvedProvider;
        private String resolvedModel;
        private String catalogModel;
        private String tier;
        private boolean fallback;
        private String routeReason;
        private int retries;
        private long latencyMs;
        private int statusCode;
    }

    public record ResolvedTarget(
            String providerName,
            String modelName,
            boolean fallback,
            String routeReason,
            String catalogModelName
    ) {
        public ResolvedTarget(String providerName, String modelName, boolean fallback, String routeReason) {
            this(providerName, modelName, fallback, routeReason, null);
        }

        public ResolvedTarget(String providerName, String modelName, boolean fallback) {
            this(providerName, modelName, fallback, null, null);
        }

        public String accountingModel() {
            return catalogModelName != null && !catalogModelName.isBlank() ? catalogModelName : modelName;
        }
    }

    public record CandidateChain(
            String requestedModel,
            String chosenTier,
            String routeReason,
            List<ResolvedTarget> targets
    ) {}

    /**
     * Resolves the candidate chain (primary target + ordered fallback targets) for a requested model or alias.
     * For 'auto', executes prompt difficulty classification to select 'fast' or 'smart' tier.
     */
    public CandidateChain resolveCandidateChain(String requestedModel, List<ChatMessage> messages) {
        if (configProperties.getModelAliases().containsKey(requestedModel)) {
            GatewayConfigProperties.ModelAliasConfig aliasConfig = configProperties.getModelAliases().get(requestedModel);

            String chosenTier = requestedModel;
            String routeReason = "alias_" + requestedModel;

            // If 'auto', run intelligent prompt difficulty classifier
            if (aliasConfig.getRouteByDifficulty() != null && !aliasConfig.getRouteByDifficulty().isEmpty()) {
                PromptDifficultyClassifier.ClassificationResult classification = difficultyClassifier.classify(messages);
                chosenTier = classification.tier();
                routeReason = classification.routeReason();
                aliasConfig = configProperties.getModelAliases().get(chosenTier);
                if (aliasConfig == null) {
                    // Fallback to default alias if chosenTier not configured directly
                    aliasConfig = configProperties.getModelAliases().get("fast");
                }
            }

            List<ResolvedTarget> targets = new ArrayList<>();
            String primaryModel = aliasConfig.getPrimary();
            if (primaryModel != null && !primaryModel.isBlank()) {
                targets.add(resolveSingleTarget(primaryModel, false, routeReason));
            }

            if (aliasConfig.getFallbacks() != null) {
                for (String rawFallback : aliasConfig.getFallbacks()) {
                    if (rawFallback == null || rawFallback.isBlank()) continue;
                    // Support comma-delimited strings from env vars (e.g. "item1,item2")
                    for (String fallbackItem : rawFallback.split(",")) {
                        String trimmed = fallbackItem.trim();
                        if (!trimmed.isEmpty()) {
                            targets.add(resolveSingleTarget(trimmed, true, routeReason));
                        }
                    }
                }
            }

            return new CandidateChain(requestedModel, chosenTier, routeReason, targets);
        }

        // Direct model lookup or prefixed provider lookup (e.g. "vllm-local:meta-llama/...", "openrouter:deepseek/...")
        try {
            ResolvedTarget primary = resolveSingleTarget(requestedModel, false, "direct_model");
            List<ResolvedTarget> targets = new ArrayList<>();
            targets.add(primary);

            // Check if there is an alternative partner provider model for fallback
            String partnerModel = resolvePartnerModel(primary.modelName());
            if (partnerModel != null && !partnerModel.equals(primary.modelName())) {
                try {
                    targets.add(resolveSingleTarget(partnerModel, true, "direct_model"));
                } catch (Exception ignored) {
                }
            }

            return new CandidateChain(requestedModel, requestedModel, primary.routeReason() != null ? primary.routeReason() : "direct_model", targets);
        } catch (ModelNotFoundException mnfe) {
            throw mnfe;
        } catch (Exception e) {
            throw new ModelNotFoundException(requestedModel);
        }
    }

    /**
     * Resolves a single model or provider:model specifier into a concrete upstream target.
     * Differentiates deterministically between In-VPC providers, OpenRouter, and direct vendor APIs:
     * 1. Explicit colon syntax: "provider:model" (e.g. "vllm-local:meta-llama/llama-3.3-70b-instruct")
     * 2. Explicit slash prefix matching a configured provider name (e.g. "vllm-local/meta-llama/...")
     * 3. Configured provider model affinity (provider.models list)
     * 4. Pricing catalog lookup
     * 5. Aggregator / OpenRouter passthrough for multi-vendor namespaces (e.g. "google/gemini-2.0-flash-001")
     */
    public ResolvedTarget resolveSingleTarget(String modelSpec, boolean isFallback, String routeReason) {
        if (modelSpec == null || modelSpec.isBlank()) {
            throw new ModelNotFoundException("Empty model specification");
        }

        // 1. Check for explicit "provider:model" syntax
        if (modelSpec.contains(":")) {
            int colonIdx = modelSpec.indexOf(":");
            String providerCandidate = modelSpec.substring(0, colonIdx).trim();
            String innerModel = modelSpec.substring(colonIdx + 1).trim();
            GatewayConfigProperties.ProviderConfig providerCfg = configProperties.getProvider(providerCandidate);
            if (isProviderActiveForDirectRouting(providerCfg)) {
                // External paid aggregators require known pricing to enforce tenant budgets and prevent unmetered spend
                if ("openrouter".equalsIgnoreCase(providerCfg.getName()) && pricingRepository.findByModel(innerModel).isEmpty() && pricingRepository.findByModel(modelSpec).isEmpty()) {
                    throw new ModelNotFoundException("Model '" + innerModel + "' on provider '" + providerCfg.getName()
                            + "' is not in the pricing catalog. Known prices are required to enforce tenant budgets.");
                }
                String catalogModel = pricingRepository.findByModel(modelSpec).isPresent() ? modelSpec
                        : (pricingRepository.findByModel(providerCandidate + "/" + innerModel).isPresent() ? (providerCandidate + "/" + innerModel)
                        : (pricingRepository.findByModel(innerModel).isPresent() ? innerModel : modelSpec));
                return new ResolvedTarget(providerCfg.getName(), innerModel, isFallback, routeReason != null ? routeReason : "explicit_provider", catalogModel);
            }
        }

        // 2. Check for explicit "provider/model" syntax if the first segment matches a registered provider
        if (modelSpec.contains("/")) {
            int slashIdx = modelSpec.indexOf("/");
            String prefix = modelSpec.substring(0, slashIdx).trim();
            GatewayConfigProperties.ProviderConfig providerCfg = configProperties.getProvider(prefix);
            if (isProviderActiveForDirectRouting(providerCfg)) {
                String innerModel = modelSpec.substring(slashIdx + 1).trim();
                // External paid aggregators require known pricing to enforce tenant budgets and prevent unmetered spend
                if ("openrouter".equalsIgnoreCase(providerCfg.getName()) && pricingRepository.findByModel(innerModel).isEmpty() && pricingRepository.findByModel(modelSpec).isEmpty()) {
                    throw new ModelNotFoundException("Model '" + innerModel + "' on provider '" + providerCfg.getName()
                            + "' is not in the pricing catalog. Known prices are required to enforce tenant budgets.");
                }
                String catalogModel = pricingRepository.findByModel(modelSpec).isPresent() ? modelSpec
                        : (pricingRepository.findByModel(prefix + "/" + innerModel).isPresent() ? (prefix + "/" + innerModel)
                        : (pricingRepository.findByModel(innerModel).isPresent() ? innerModel : modelSpec));
                return new ResolvedTarget(providerCfg.getName(), innerModel, isFallback, routeReason != null ? routeReason : "explicit_provider", catalogModel);
            }
        }

        // 3. Check if any configured In-VPC provider explicitly advertises this model
        GatewayConfigProperties.ProviderConfig advertisedProvider = configProperties.findProviderForModel(modelSpec);
        if (advertisedProvider != null) {
            return new ResolvedTarget(advertisedProvider.getName(), modelSpec, isFallback, routeReason != null ? routeReason : "provider_model_affinity");
        }

        // 4. Check if model exists in pricing repository
        Optional<ModelPricing> pricing = pricingRepository.findByModel(modelSpec);
        if (pricing.isPresent()) {
            String provider = pricing.get().getProvider();
            if (configProperties.getProvider(provider) == null && configProperties.getProvider("openrouter") != null) {
                provider = "openrouter";
            }
            return new ResolvedTarget(provider, modelSpec, isFallback, routeReason != null ? routeReason : "catalog_model");
        }

        // 5. Direct prefix convention (e.g. alpha-small -> alpha, beta-small -> beta)
        String fallbackProvider = lookupProviderForModel(modelSpec);
        if (configProperties.getProvider(fallbackProvider) != null) {
            return new ResolvedTarget(fallbackProvider, modelSpec, isFallback, routeReason != null ? routeReason : "prefix_model");
        }

        throw new ModelNotFoundException("Model '" + modelSpec + "' is not recognized or unpriced in the catalog. Known pricing is required to prevent unmetered spend.");
    }

    /**
     * Backward-compatible helper resolving the primary target for a model.
     */
    public ResolvedTarget resolveTarget(String requestedModel) {
        return resolveCandidateChain(requestedModel, List.of()).targets().get(0);
    }

    /**
     * Forwards non-streaming request with automated retries and fast-failover across the candidate chain.
     */
    public UpstreamResult forwardWithFailover(ChatCompletionRequest request, CandidateChain chain) {
        int totalRetries = 0;
        Exception lastException = null;
        long chainStartTime = System.currentTimeMillis();
        long maxChainTimeoutMs = configProperties.getRetry().getMaxChainTimeoutMs();

        for (int i = 0; i < chain.targets().size(); i++) {
            ResolvedTarget target = chain.targets().get(i);
            boolean isFallback = i > 0;

            long elapsed = System.currentTimeMillis() - chainStartTime;
            if (elapsed >= maxChainTimeoutMs) {
                log.error("Candidate chain deadline of {}ms exceeded (elapsed: {}ms) before dispatching to target [{}]",
                        maxChainTimeoutMs, elapsed, target.providerName());
                throw new UpstreamException("Candidate chain deadline exceeded (" + elapsed + "ms)");
            }

            // Resilience4j Circuit Breaker pre-check: fast-fail in <0.05ms if circuit is OPEN (non-consuming)
            if (circuitBreakerService != null && !circuitBreakerService.isCallPermitted(target.providerName())) {
                log.warn("Fast-failing target [{}] because circuit breaker is OPEN", target.providerName());
                totalRetries++;
                continue;
            }

            int maxAttempts = configProperties.getRetry().getMaxAttempts();
            long initialBackoff = configProperties.getRetry().getInitialBackoffMs();
            double multiplier = configProperties.getRetry().getBackoffMultiplier();

            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                long currentElapsed = System.currentTimeMillis() - chainStartTime;
                long remainingBudgetMs = Math.max(10, maxChainTimeoutMs - currentElapsed);
                if (currentElapsed >= maxChainTimeoutMs) {
                    log.error("Candidate chain deadline of {}ms exceeded (elapsed: {}ms) at attempt {}/{} for target [{}]",
                            maxChainTimeoutMs, currentElapsed, attempt, maxAttempts, target.providerName());
                    throw new UpstreamException("Candidate chain deadline exceeded (" + currentElapsed + "ms)");
                }

                // Resilience4j Circuit Breaker check: acquire exactly 1 permission per actual attempt
                if (circuitBreakerService != null && !circuitBreakerService.tryAcquirePermission(target.providerName())) {
                    log.warn("Fast-failing attempt {}/{} to target [{}] because circuit breaker is OPEN",
                            attempt, maxAttempts, target.providerName());
                    totalRetries++;
                    break;
                }

                long startNanos = System.nanoTime();
                try {
                    UpstreamResult res = forwardNonStreaming(request, target, remainingBudgetMs);
                    if (circuitBreakerService != null) {
                        circuitBreakerService.recordSuccess(target.providerName(), System.nanoTime() - startNanos);
                    }
                    res.setRetries(totalRetries);
                    res.setFallback(isFallback);
                    res.setRouteReason(target.routeReason());
                    res.setTier(chain.chosenTier());
                    return res;
                } catch (UpstreamException ue) {
                    boolean isRequestSpecific = ue.isRequestSpecificError();
                    boolean isThrottled = ue.isThrottled();
                    if (!isRequestSpecific && circuitBreakerService != null) {
                        circuitBreakerService.recordError(target.providerName(), System.nanoTime() - startNanos, ue);
                    }
                    lastException = ue;
                    log.warn("Attempt {}/{} to provider [{}] for model [{}] failed (status {}): {}",
                            attempt, maxAttempts, target.providerName(), target.modelName(), ue.getUpstreamStatusCode(), ue.getMessage());

                    // Request-specific errors (400 Bad Request, 422 Unprocessable) are client input errors - abort chain
                    if (isRequestSpecific) {
                        if (circuitBreakerService != null) {
                            circuitBreakerService.releasePermission(target.providerName());
                        }
                        throw ue;
                    }

                    // Temporary provider throttling (HTTP 429) triggers immediate failover to next provider in candidate chain
                    if (isThrottled && i < chain.targets().size() - 1) {
                        if (circuitBreakerService != null) {
                            circuitBreakerService.releasePermission(target.providerName());
                        }
                        log.warn("Provider [{}] throttled request (HTTP 429). Triggering immediate failover to next candidate in chain...", target.providerName());
                        totalRetries++;
                        break;
                    }

                    if (attempt < maxAttempts || i < chain.targets().size() - 1) {
                        totalRetries++;
                    }
                    if (attempt < maxAttempts) {
                        long rem = maxChainTimeoutMs - (System.currentTimeMillis() - chainStartTime);
                        if (rem <= 50) {
                            log.error("Candidate chain remaining budget {}ms is insufficient for backoff; aborting chain early", rem);
                            throw new UpstreamException("Candidate chain deadline exceeded (" + (System.currentTimeMillis() - chainStartTime) + "ms)");
                        }
                        sleepBackoff(initialBackoff, multiplier, attempt, rem);
                        continue;
                    }
                } catch (Exception e) {
                    if (circuitBreakerService != null) {
                        circuitBreakerService.recordError(target.providerName(), System.nanoTime() - startNanos, e);
                    }
                    lastException = e;
                    log.warn("Attempt {}/{} to provider [{}] encountered unexpected exception: {}",
                            attempt, maxAttempts, target.providerName(), e.getMessage());

                    if (attempt < maxAttempts || i < chain.targets().size() - 1) {
                        totalRetries++;
                    }
                    if (attempt < maxAttempts) {
                        long rem = maxChainTimeoutMs - (System.currentTimeMillis() - chainStartTime);
                        if (rem <= 50) {
                            log.error("Candidate chain remaining budget {}ms is insufficient for backoff; aborting chain early", rem);
                            throw new UpstreamException("Candidate chain deadline exceeded (" + (System.currentTimeMillis() - chainStartTime) + "ms)");
                        }
                        sleepBackoff(initialBackoff, multiplier, attempt, rem);
                        continue;
                    }
                }
            }

            if (i < chain.targets().size() - 1) {
                ResolvedTarget next = chain.targets().get(i + 1);
                log.info("Primary target [{}/{}] failed after {} attempts. Failing over to fallback provider [{}/{}] in chain.",
                        target.providerName(), target.modelName(), maxAttempts, next.providerName(), next.modelName());
            }
        }

        log.error("All upstream providers exhausted for alias/model [{}]. Last exception: {}",
                chain.requestedModel(), lastException != null ? lastException.getMessage() : "none");
        throw new UpstreamException("All upstream providers exhausted for alias " + chain.requestedModel());
    }

    /**
     * Forwards non-streaming chat completion to a concrete target with default 3-second timeout.
     */
    public UpstreamResult forwardNonStreaming(ChatCompletionRequest request, ResolvedTarget target) {
        return forwardNonStreaming(request, target, 3000L);
    }

    /**
     * Forwards non-streaming chat completion to a concrete target with a dynamically budgeted timeout.
     */
    public UpstreamResult forwardNonStreaming(ChatCompletionRequest request, ResolvedTarget target, long remainingBudgetMs) {
        GatewayConfigProperties.ProviderConfig providerConfig = configProperties.getProvider(target.providerName());
        if (providerConfig == null && configProperties.getProvider("openrouter") != null) {
            providerConfig = configProperties.getProvider("openrouter");
        }
        if (providerConfig == null) {
            throw new UpstreamException("Provider '" + target.providerName() + "' is not configured in gateway registry");
        }

        String base = providerConfig.getBaseUrl().replaceAll("/+$", "");
        String targetUrl = base.endsWith("/v1") ? base + "/chat/completions" : base + "/v1/chat/completions";

        ChatCompletionRequest upstreamPayload = ChatCompletionRequest.builder()
                .model(target.modelName())
                .messages(request.getMessages())
                .stream(false)
                .temperature(request.getTemperature())
                .maxTokens(request.getMaxTokens())
                .build();

        long startTime = System.currentTimeMillis();
        long httpTimeoutMs = Math.max(50L, Math.min(3000L, remainingBudgetMs));
        try {
            String jsonBody = objectMapper.writeValueAsString(upstreamPayload);

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofMillis(httpTimeoutMs))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody));

            if (providerConfig.getApiKey() != null && !providerConfig.getApiKey().isBlank()) {
                reqBuilder.header("Authorization", "Bearer " + providerConfig.getApiKey());
            }

            HttpResponse<String> httpResponse = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            long latencyMs = System.currentTimeMillis() - startTime;

            if (httpResponse.statusCode() >= 400) {
                log.warn("Upstream provider [{}] returned HTTP {}", target.providerName(), httpResponse.statusCode());
                String responseBody = httpResponse.body() != null && httpResponse.body().length() > 500
                        ? httpResponse.body().substring(0, 500) + "... [truncated]"
                        : httpResponse.body();
                throw new UpstreamException(httpResponse.statusCode(), "Upstream provider '" + target.providerName() + "' returned HTTP " + httpResponse.statusCode() + ": " + responseBody);
            }

            ChatCompletionResponse chatResponse = objectMapper.readValue(httpResponse.body(), ChatCompletionResponse.class);

            return UpstreamResult.builder()
                    .response(chatResponse)
                    .resolvedProvider(target.providerName())
                    .resolvedModel(target.modelName())
                    .catalogModel(target.accountingModel())
                    .fallback(target.fallback())
                    .routeReason(target.routeReason())
                    .latencyMs(latencyMs)
                    .statusCode(httpResponse.statusCode())
                    .build();

        } catch (UpstreamException ue) {
            throw ue;
        } catch (Exception e) {
            long latencyMs = System.currentTimeMillis() - startTime;
            log.warn("Failed to communicate with upstream provider [{}] after {}ms: {}", target.providerName(), latencyMs, e.getMessage());
            throw new UpstreamException("Failed to communicate with upstream provider '" + target.providerName() + "': " + e.getMessage());
        }
    }

    private String lookupProviderForModel(String modelName) {
        return pricingRepository.findByModel(modelName)
                .map(ModelPricing::getProvider)
                .orElseGet(() -> modelName.contains("-") ? modelName.split("-")[0] : modelName);
    }

    private boolean isProviderActiveForDirectRouting(GatewayConfigProperties.ProviderConfig providerCfg) {
        if (providerCfg == null) {
            return false;
        }
        if (providerCfg.getApiKey() != null && !providerCfg.getApiKey().isBlank()) {
            return true;
        }
        return isPrivateProvider(providerCfg);
    }

    private boolean isPrivateProvider(GatewayConfigProperties.ProviderConfig providerCfg) {
        if (providerCfg == null) {
            return false;
        }
        String name = providerCfg.getName() != null ? providerCfg.getName().toLowerCase() : "";
        String url = providerCfg.getBaseUrl() != null ? providerCfg.getBaseUrl().toLowerCase() : "";

        // Known public cloud providers require credentials
        if ("openai".equals(name) || "anthropic".equals(name) || "openrouter".equals(name)
                || url.contains("api.openai.com") || url.contains("api.anthropic.com") || url.contains("openrouter.ai")) {
            return false;
        }

        // In-VPC, local, on-prem, or private endpoints do not require credentials
        return url.contains("localhost")
                || url.contains("127.0.0.1")
                || url.contains(".local")
                || url.contains(".internal")
                || url.contains(".vpc")
                || url.contains(".cluster.local")
                || name.contains("local")
                || name.contains("vllm")
                || name.contains("ollama")
                || name.contains("internal")
                || name.contains("vpc");
    }

    private String resolvePartnerModel(String modelName) {
        if ("alpha-small".equals(modelName)) return "beta-small";
        if ("beta-small".equals(modelName)) return "alpha-small";
        if ("alpha-large".equals(modelName)) return "beta-large";
        if ("beta-large".equals(modelName)) return "alpha-large";
        return null;
    }

    private void sleepBackoff(long initialBackoffMs, double multiplier, int attempt, long remainingBudgetMs) {
        long delay = (long) (initialBackoffMs * Math.pow(multiplier, attempt - 1));
        long cappedDelay = Math.min(delay, Math.max(0, remainingBudgetMs - 50));
        if (cappedDelay <= 0) {
            return;
        }
        try {
            Thread.sleep(Math.max(1, cappedDelay));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
