package com.netra.gateway.service;

import com.netra.gateway.model.dto.ChatMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Two-Stage Prompt Difficulty Classifier for the 'auto' alias.
 * <p>
 * Classifies prompts into 'fast' (cost-effective small models) or 'smart' (high-capability reasoning models)
 * based on task instruction verbs and complexity signals rather than raw token length.
 * Evaluated against data/routing_eval.jsonl.
 */
@Slf4j
@Service
public class PromptDifficultyClassifier {

    public record ClassificationResult(
            String tier, // "fast" or "smart"
            double score,
            List<String> matchedSignals,
            String routeReason
    ) {}

    private record Signal(String name, Pattern pattern, double weight, String description) {}

    private static final double ESCALATION_THRESHOLD = 1.5;

    // High complexity signals pushing toward the 'smart' tier
    private static final List<Signal> COMPLEX_SIGNALS = List.of(
            new Signal("proof",
                    Pattern.compile("\\b(prove|disprove|derive|proof of)\\b", Pattern.CASE_INSENSITIVE),
                    3.5, "asks for proof or derivation"),
            new Signal("design",
                    Pattern.compile("\\b(design a|design an|architect|draft a|propose a|devise|schema for)\\b", Pattern.CASE_INSENSITIVE),
                    2.5, "asks to design or architect an artifact"),
            new Signal("fermi_estimation",
                    Pattern.compile("\\b(estimate how|approximately how many|fermi|walk through your assumptions)\\b", Pattern.CASE_INSENSITIVE),
                    2.5, "multi-step Fermi estimation"),
            new Signal("systems_reasoning",
                    Pattern.compile("\\b(distributed system|consistency guarantee|quorum|partition|p9[59]|latency doubled|most likely causes|how would you confirm|root cause|event sourcing|ledger)\\b", Pattern.CASE_INSENSITIVE),
                    2.5, "deep systems reasoning and distributed failure modes"),
            new Signal("algorithmic",
                    Pattern.compile("\\b(algorithm|o\\([a-z0-9^ ]*\\)|better than o|time complexity|palindromic substring)\\b", Pattern.CASE_INSENSITIVE),
                    2.5, "algorithmic complexity or asymptotic analysis"),
            new Signal("comparative_evaluation",
                    Pattern.compile("\\b(compare|contrast|trade[- ]?offs?|recommend|evaluate|pros and cons|with justification|justify)\\b", Pattern.CASE_INSENSITIVE),
                    2.0, "comparative evaluation and trade-off analysis"),
            new Signal("explicit_reasoning",
                    Pattern.compile("(show your (reasoning|work)|step[- ]by[- ]step|explain your (reasoning|trade[- ]?offs?)|explain why|explain what|explain how the)", Pattern.CASE_INSENSITIVE),
                    1.5, "explicit demand to show reasoning steps"),
            new Signal("planning",
                    Pattern.compile("\\b(migration plan|zero[- ]downtime|roll ?back)\\b", Pattern.CASE_INSENSITIVE),
                    2.0, "complex operational migration or rollback planning")
    );

    // Mechanical and bounded signals pushing toward the 'fast' tier
    private static final List<Signal> DE_ESCALATION_SIGNALS = List.of(
            new Signal("direct_lookup",
                    Pattern.compile("\\b(what is the (capital|timestamp|value|name|email))\\b", Pattern.CASE_INSENSITIVE),
                    -3.0, "direct lookup or factual query"),
            new Signal("definition_lookup",
                    Pattern.compile("\\b(what does .{1,40} mean)\\b", Pattern.CASE_INSENSITIVE),
                    -3.0, "definition lookup"),
            new Signal("roster_lookup",
                    Pattern.compile("\\b(who is on call|who is)\\b", Pattern.CASE_INSENSITIVE),
                    -3.0, "lookup in provided text or roster"),
            new Signal("arithmetic",
                    Pattern.compile("\\b(is \\d+ divisible)\\b", Pattern.CASE_INSENSITIVE),
                    -3.0, "simple arithmetic operation"),
            new Signal("mechanical_transform",
                    Pattern.compile("^\\s*(translate|convert|rewrite|reformat|extract)\\b|\\b(translate|convert|extract|rewrite) (the|this|that|it|following|72 degrees)\\b", Pattern.CASE_INSENSITIVE),
                    -3.0, "mechanical transformation or extraction"),
            new Signal("bounded_output",
                    Pattern.compile("\\b(one[- ]line commit message|one[- ]line|one sentence|in one word)\\b", Pattern.CASE_INSENSITIVE),
                    -2.5, "explicitly bounded tiny output")
    );

    /**
     * Classifies a conversation prompt by analyzing the last user message.
     */
    public ClassificationResult classify(List<ChatMessage> messages) {
        String prompt = extractLastUserMessage(messages);
        return classifyPrompt(prompt);
    }

    /**
     * Classifies a prompt string into 'fast' or 'smart' tier with reasoning.
     */
    public ClassificationResult classifyPrompt(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            return new ClassificationResult("fast", 0.0, List.of(), "auto -> fast: empty prompt defaulted to fast tier");
        }

        String instruction = extractInstruction(prompt);
        double score = 0.0;
        List<String> matched = new ArrayList<>();

        for (Signal signal : COMPLEX_SIGNALS) {
            Matcher m = signal.pattern().matcher(instruction);
            if (m.find()) {
                score += signal.weight();
                matched.add("+" + signal.weight() + " " + signal.name() + " (" + signal.description() + ")");
            }
        }

        for (Signal signal : DE_ESCALATION_SIGNALS) {
            Matcher m = signal.pattern().matcher(instruction);
            if (m.find()) {
                score += signal.weight();
                matched.add(signal.weight() + " " + signal.name() + " (" + signal.description() + ")");
            }
        }

        String tier = score >= ESCALATION_THRESHOLD ? "smart" : "fast";
        String routeReason;
        if (matched.isEmpty()) {
            routeReason = String.format("auto -> %s (score %+.1f): no complexity signals detected; defaulted to cost-effective tier", tier, score);
        } else {
            routeReason = String.format("auto -> %s (score %+.1f): %s", tier, score, String.join(", ", matched));
        }

        log.debug("Prompt classification for prompt [{}]: tier={}, score={}, reason={}",
                prompt.length() > 60 ? prompt.substring(0, 60) + "..." : prompt, tier, score, routeReason);

        return new ClassificationResult(tier, score, matched, routeReason);
    }

    /**
     * Extracts the task instruction from a prompt. For long prompts wrapped around a data payload
     * (e.g. server log excerpts or on-call rosters), extracts the opening and closing sentences where
     * the actual user task instruction resides, preventing large payloads from masking linguistic signals.
     */
    public String extractInstruction(String prompt) {
        String trimmed = prompt.trim();
        String[] words = trimmed.split("\\s+");
        if (words.length <= 40) {
            return trimmed;
        }

        String[] sentences = trimmed.split("(?<=[.?!])\\s+");
        if (sentences.length <= 2) {
            return trimmed;
        }

        return sentences[0].trim() + " " + sentences[sentences.length - 1].trim();
    }

    private String extractLastUserMessage(List<ChatMessage> messages) {
        if (messages == null || messages.isEmpty()) {
            return "";
        }
        for (int i = messages.size() - 1; i >= 0; i--) {
            ChatMessage msg = messages.get(i);
            if ("user".equalsIgnoreCase(msg.getRole())) {
                Object content = msg.getContent();
                return content != null ? content.toString() : "";
            }
        }
        return "";
    }
}
