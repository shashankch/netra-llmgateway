package com.netra.gateway.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.exception.ModelNotFoundException;
import com.netra.gateway.exception.UpstreamException;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.entity.ModelPricing;
import com.netra.gateway.repository.ModelPricingRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UpstreamClientService {

    private final GatewayConfigProperties configProperties;
    private final ModelPricingRepository pricingRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Data
    @Builder
    public static class UpstreamResult {
        private ChatCompletionResponse response;
        private String resolvedProvider;
        private String resolvedModel;
        private boolean fallback;
        private long latencyMs;
        private int statusCode;
    }

    /**
     * Resolves model alias (e.g., 'fast' -> 'alpha-small', 'smart' -> 'alpha-large')
     * or validates recognized concrete model name.
     */
    public ResolvedTarget resolveTarget(String requestedModel) {
        if (configProperties.getModelAliases().containsKey(requestedModel)) {
            GatewayConfigProperties.ModelAliasConfig aliasConfig = configProperties.getModelAliases().get(requestedModel);
            String primaryModel = aliasConfig.getPrimary();
            if (primaryModel == null && aliasConfig.getRouteByDifficulty() != null) {
                // Auto router default baseline for Phase 1
                primaryModel = "alpha-small";
            }
            String finalPrimaryModel = primaryModel;
            String providerName = pricingRepository.findByModel(primaryModel)
                    .map(ModelPricing::getProvider)
                    .orElseGet(() -> finalPrimaryModel.contains("-") ? finalPrimaryModel.split("-")[0] : finalPrimaryModel);
            return new ResolvedTarget(providerName, primaryModel, false);
        }

        // Direct model lookup in pricing
        Optional<ModelPricing> pricing = pricingRepository.findByModel(requestedModel);
        if (pricing.isPresent()) {
            return new ResolvedTarget(pricing.get().getProvider(), requestedModel, false);
        }

        throw new ModelNotFoundException(requestedModel);
    }

    public record ResolvedTarget(String providerName, String modelName, boolean fallback) {}

    /**
     * Forwards non-streaming chat completion to upstream provider.
     */
    public UpstreamResult forwardNonStreaming(ChatCompletionRequest request, ResolvedTarget target) {
        GatewayConfigProperties.ProviderConfig providerConfig = configProperties.getProvider(target.providerName());
        if (providerConfig == null) {
            throw new UpstreamException("Provider '" + target.providerName() + "' is not configured in gateway registry");
        }

        String base = providerConfig.getBaseUrl().replaceAll("/+$", "");
        String targetUrl = base.endsWith("/v1") ? base + "/chat/completions" : base + "/v1/chat/completions";

        // Create upstream request payload with resolved model name
        ChatCompletionRequest upstreamPayload = ChatCompletionRequest.builder()
                .model(target.modelName())
                .messages(request.getMessages())
                .stream(false)
                .temperature(request.getTemperature())
                .maxTokens(request.getMaxTokens())
                .build();

        long startTime = System.currentTimeMillis();
        try {
            String jsonBody = objectMapper.writeValueAsString(upstreamPayload);

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
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
                throw new UpstreamException("Upstream provider '" + target.providerName() + "' returned HTTP " + httpResponse.statusCode() + ": " + responseBody);
            }

            ChatCompletionResponse chatResponse = objectMapper.readValue(httpResponse.body(), ChatCompletionResponse.class);

            return UpstreamResult.builder()
                    .response(chatResponse)
                    .resolvedProvider(target.providerName())
                    .resolvedModel(target.modelName())
                    .fallback(target.fallback())
                    .latencyMs(latencyMs)
                    .statusCode(httpResponse.statusCode())
                    .build();

        } catch (UpstreamException ue) {
            throw ue;
        } catch (Exception e) {
            long latencyMs = System.currentTimeMillis() - startTime;
            log.error("Failed to forward request to upstream provider [{}] after {}ms: {}", target.providerName(), latencyMs, e.getMessage());
            throw new UpstreamException("Failed to communicate with upstream provider '" + target.providerName() + "': " + e.getMessage());
        }
    }
}
