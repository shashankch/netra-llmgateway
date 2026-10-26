package com.netra.gateway;

import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.service.PromptDifficultyClassifier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PromptDifficultyClassifierTest {

    private final PromptDifficultyClassifier classifier = new PromptDifficultyClassifier();

    @Test
    @DisplayName("Empty or null prompts default safely to fast tier")
    void testEmptyPromptDefaultsToFast() {
        assertThat(classifier.classify(null).tier()).isEqualTo("fast");
        assertThat(classifier.classify(Collections.emptyList()).tier()).isEqualTo("fast");
        assertThat(classifier.classifyPrompt("").tier()).isEqualTo("fast");
        assertThat(classifier.classifyPrompt("   ").tier()).isEqualTo("fast");
    }

    @Test
    @DisplayName("Short proof prompt is escalated to smart tier")
    void testShortProofEscalatedToSmart() {
        PromptDifficultyClassifier.ClassificationResult result =
                classifier.classifyPrompt("Prove that the square root of 2 is irrational.");
        assertThat(result.tier()).isEqualTo("smart");
        assertThat(result.score()).isGreaterThanOrEqualTo(1.5);
        assertThat(result.routeReason()).contains("proof");
    }

    @Test
    @DisplayName("Long text with simple lookup at the end is de-escalated to fast tier")
    void testLongTextWithLookupDeEscalatedToFast() {
        String longRoster = "Here is our on-call roster for the next two weeks: " +
                "Monday - Priya, Tuesday - Chen, Wednesday - Amara, Thursday - Diego, Friday - Fatima, " +
                "Saturday - Lukas, Sunday - Mei, next Monday - Tom, next Tuesday - Sara, next Wednesday - Ravi, " +
                "next Thursday - Ana, next Friday - Kofi, next Saturday - Elif, next Sunday - Jonas. " +
                "Who is on call this Thursday?";

        PromptDifficultyClassifier.ClassificationResult result = classifier.classifyPrompt(longRoster);
        assertThat(result.tier()).isEqualTo("fast");
        assertThat(result.score()).isLessThan(1.5);
        assertThat(result.routeReason()).contains("roster_lookup");
    }

    @Test
    @DisplayName("Complex system design prompt with trade-offs is routed to smart tier")
    void testComplexDesignRoutedToSmart() {
        PromptDifficultyClassifier.ClassificationResult result =
                classifier.classifyPrompt("Design a database schema for a multi-tenant billing system. Explain your trade-offs.");
        assertThat(result.tier()).isEqualTo("smart");
        assertThat(result.score()).isGreaterThanOrEqualTo(1.5);
        assertThat(result.routeReason()).contains("design");
    }

    @Test
    @DisplayName("Extracts last user message from multi-turn conversation")
    void testExtractsLastUserMessage() {
        List<ChatMessage> conversation = List.of(
                new ChatMessage("user", "Hello assistant"),
                new ChatMessage("assistant", "How can I help you today?"),
                new ChatMessage("user", "Draft a zero-downtime migration plan for moving a monolithic web app to microservices.")
        );

        PromptDifficultyClassifier.ClassificationResult result = classifier.classify(conversation);
        assertThat(result.tier()).isEqualTo("smart");
        assertThat(result.routeReason()).contains("design");
    }
}
