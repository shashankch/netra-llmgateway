package com.netra.gateway.service;

import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.model.dto.ChatCompletionRequest;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Enterprise Auto-Escalation Engine for Small-Model Refusal & Degradation.
 * <p>
 * Inspects responses from cheap/small models (alpha-small, beta-small, gemini-flash, gpt-4o-mini)
 * for refusal markers, apologies, or empty degraded outputs, and seamlessly re-routes the prompt
 * to the high-capability tier (smart / alpha-large / claude-sonnet) with telemetry header x-netra-escalated: true.
 */
@Slf4j
@Service
public class RefusalEscalationService {

    private final UpstreamClientService upstreamClientService;
    private final GatewayConfigProperties configProperties;

    @Autowired
    public RefusalEscalationService(
            UpstreamClientService upstreamClientService,
            @Autowired(required = false) GatewayConfigProperties configProperties
    ) {
        this.upstreamClientService = upstreamClientService;
        this.configProperties = configProperties;
    }

    public RefusalEscalationService(UpstreamClientService upstreamClientService) {
        this(upstreamClientService, null);
    }

    public boolean isRefusal(ChatCompletionResponse response) {
        if (response == null || response.getChoices() == null || response.getChoices().isEmpty()) {
            return true; // Empty/malformed response treated as degradation
        }
        ChatMessage msg = response.getChoices().get(0).getMessage();
        if (msg == null || msg.getContent() == null) {
            return true;
        }
        String content = msg.getContent().toString().trim();
        if (content.isEmpty()) {
            return true;
        }

        String lower = content.toLowerCase();
        return lower.contains("[refuse]")
                || lower.contains("i'm sorry, but i can't help with that")
                || lower.contains("i'm sorry, but i cannot help with that")
                || lower.contains("i cannot help with that")
                || lower.contains("i am unable to help with that")
                || lower.contains("i cannot assist with that")
                || lower.contains("i am unable to assist with that")
                || lower.contains("as an ai language model, i cannot")
                || lower.contains("as an ai, i cannot")
                || lower.contains("as a language model, i am unable");
    }

    /**
     * Determines whether a response from a given tier or resolved foundation model is eligible
     * for auto-escalation to the smart tier upon refusal or degradation.
     *
     * @param tier the routing tier chosen (e.g. "fast", "smart")
     * @param model the resolved foundation model name or requested alias
     * @return true if the response originated from an escalatable (fast/cheap) model or tier
     */
    public boolean isEscalatable(String tier, String model) {
        if ("smart".equalsIgnoreCase(tier)) {
            return false;
        }
        if ("fast".equalsIgnoreCase(tier)) {
            return true;
        }
        return isEscalatableModel(model);
    }

    public boolean isEscalatableModel(String model) {
        if (model == null) return false;
        String m = model.toLowerCase().trim();

        // 1. Direct fast tier alias or common small model indicators
        if (m.equals("fast") || m.contains("small") || m.contains("flash") || m.contains("mini")) {
            return true;
        }

        // 2. Check configured fast models from gateway topology
        if (configProperties != null && configProperties.getModelAliases() != null) {
            GatewayConfigProperties.ModelAliasConfig fastConfig = configProperties.getModelAliases().get("fast");
            if (fastConfig != null) {
                if (isMatchingModel(m, fastConfig.getPrimary())) {
                    return true;
                }
                if (fastConfig.getFallbacks() != null) {
                    for (String fb : fastConfig.getFallbacks()) {
                        if (isMatchingModel(m, fb)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    private boolean isMatchingModel(String candidate, String configured) {
        if (candidate == null || configured == null) return false;
        String cand = stripProviderPrefix(candidate.toLowerCase().trim());
        String conf = stripProviderPrefix(configured.toLowerCase().trim());
        return cand.equals(conf);
    }

    private String stripProviderPrefix(String m) {
        if (m.contains(":")) {
            m = m.substring(m.indexOf(":") + 1).trim();
        }
        if (m.contains("/")) {
            m = m.substring(m.lastIndexOf('/') + 1).trim();
        }
        return m;
    }

    /**
     * Attempts to escalate a refused or degraded small-model response to the smart tier (alpha-large).
     * Returns true if escalation was successfully executed.
     */
    public UpstreamClientService.UpstreamResult escalate(ChatCompletionRequest originalRequest) {
        log.info("Small model refusal/degradation detected. Auto-escalating request to 'smart' tier...");
        UpstreamClientService.CandidateChain smartChain = upstreamClientService.resolveCandidateChain("smart", originalRequest.getMessages());
        UpstreamClientService.UpstreamResult escalatedResult = upstreamClientService.forwardWithFailover(originalRequest, smartChain);
        escalatedResult.setRouteReason("refusal_auto_escalation");
        escalatedResult.setFallback(true);
        return escalatedResult;
    }
}
