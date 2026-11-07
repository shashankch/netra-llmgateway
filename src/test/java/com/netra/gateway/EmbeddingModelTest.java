package com.netra.gateway;

import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.allminilml6v2q.AllMiniLmL6V2QuantizedEmbeddingModel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmbeddingModelTest {

    private final EmbeddingModel embeddingModel = new AllMiniLmL6V2QuantizedEmbeddingModel();

    private double cosineSimilarity(float[] v1, float[] v2) {
        double dotProduct = 0.0;
        double norm1 = 0.0;
        double norm2 = 0.0;
        for (int i = 0; i < v1.length; i++) {
            dotProduct += v1[i] * v2[i];
            norm1 += v1[i] * v1[i];
            norm2 += v2[i] * v2[i];
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    @Test
    @DisplayName("Verify in-JVM ONNX all-MiniLM-L6-v2 generates 384-dim embeddings and evaluates paraphrase pairs")
    void testParaphraseMatchingAndRejection() {
        for (int i = 0; i < 5; i++) {
            String randSalt = "(" + java.util.UUID.randomUUID().toString().substring(0, 8) + ")";
            String p1 = randSalt + " How do I cancel my subscription on the console?";
            String p2 = randSalt + " What are the steps to cancel my console subscription?";
            String p3 = randSalt + " How do I upgrade my subscription on the console?";
            String pSmoke = "(smoke123) How do I reset my password on the console?";
            float[] v1 = embeddingModel.embed(p1).content().vector();
            float[] v2 = embeddingModel.embed(p2).content().vector();
            float[] v3 = embeddingModel.embed(p3).content().vector();
            float[] vSmoke = embeddingModel.embed(pSmoke).content().vector();
            double simParaphrase = cosineSimilarity(v1, v2);
            double simNearMiss = cosineSimilarity(v1, v3);
            double simVsSmoke = cosineSimilarity(v1, vSmoke);
            System.out.printf("Salt %s -> Paraphrase: %.4f, Near-miss: %.4f, Vs Smoke: %.4f%n", randSalt, simParaphrase, simNearMiss, simVsSmoke);
            assertThat(simParaphrase).isGreaterThanOrEqualTo(0.92);
            assertThat(simNearMiss).isLessThan(0.80);
            assertThat(simVsSmoke).isLessThan(0.60);
        }
    }

    @Test
    @DisplayName("Verify deterministic Unicode NFC and whitespace normalization in EmbeddingService")
    void testDeterministicNormalization() {
        com.netra.gateway.service.EmbeddingService service = new com.netra.gateway.service.EmbeddingService();

        // 1. Unicode NFC normalization: decomposed 'e' + combining acute ('\u0065\u0301') vs precomposed 'é' ('\u00E9')
        String decomposed = "cafe\u0301";
        String precomposed = "caf\u00E9";
        assertThat(com.netra.gateway.service.EmbeddingService.normalizeText(decomposed))
                .isEqualTo(com.netra.gateway.service.EmbeddingService.normalizeText(precomposed))
                .isEqualTo("café");

        // 2. Whitespace collapsing and non-breaking spaces
        String messy = "What   is  \u00A0 the\tcapital  of \r\n France?  ";
        String cleaned = com.netra.gateway.service.EmbeddingService.normalizeText(messy);
        assertThat(cleaned).isEqualTo("What is the capital of \n France?");

        // 3. Multi-turn message canonicalization
        var messages = java.util.List.of(
                new com.netra.gateway.model.dto.ChatMessage("system", "You are   a helpful   assistant. "),
                new com.netra.gateway.model.dto.ChatMessage("user", "Hello\u00A0world!  ")
        );
        String canonicalKey = service.extractCacheKeyText(messages);
        assertThat(canonicalKey).isEqualTo("system: You are a helpful assistant.\nuser: Hello world!");
    }
}
