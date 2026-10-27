package com.netra.gateway;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.service.PromptDifficultyClassifier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RoutingEvalTest {

    private final PromptDifficultyClassifier classifier = new PromptDifficultyClassifier();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("Routing benchmark: evaluates all 20 cases in data/routing_eval.jsonl and asserts accuracy >= 80%")
    void testRoutingEvalBenchmark() throws Exception {
        File evalFile = new File("data/routing_eval.jsonl");
        if (!evalFile.exists()) {
            evalFile = Paths.get("..", "data", "routing_eval.jsonl").toFile();
        }
        assertThat(evalFile).exists();

        List<String> lines = Files.readAllLines(evalFile.toPath());
        int total = 0;
        int correct = 0;
        List<String> resultsSummary = new ArrayList<>();

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }

            JsonNode node = objectMapper.readTree(trimmed);
            String id = node.get("id").asText();
            String expectedTier = node.get("expected_tier").asText();
            String prompt = node.get("prompt").asText();

            PromptDifficultyClassifier.ClassificationResult result = classifier.classifyPrompt(prompt);
            total++;
            boolean match = expectedTier.equalsIgnoreCase(result.tier());
            if (match) {
                correct++;
            }

            resultsSummary.add(String.format("  [%s] expected=%s, actual=%s, match=%b (score=%+.1f): %s",
                    id, expectedTier, result.tier(), match, result.score(), result.routeReason()));
        }

        double accuracy = total > 0 ? (double) correct / total : 0.0;
        System.out.println("=================================================");
        System.out.printf("  NETRA ROUTING BENCHMARK REPORT: %d/%d (%.2f%%)%n", correct, total, accuracy * 100);
        System.out.println("=================================================");
        resultsSummary.forEach(System.out::println);
        System.out.println("=================================================");

        // Problem statement requirement: Must exceed 80% accuracy on data/routing_eval.jsonl
        assertThat(accuracy).isGreaterThanOrEqualTo(0.80);
        // Target: 100% on canonical benchmark
        assertThat(correct).isEqualTo(total);
    }
}
