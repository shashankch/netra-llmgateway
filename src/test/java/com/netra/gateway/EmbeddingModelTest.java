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
        String salt = "(f47ac10b)";
        String a1 = salt + " How do I reset my password on the dashboard?";
        String a2 = salt + " What are the steps to reset my dashboard password?";
        String a3 = salt + " How do I reset my two-factor authentication on the dashboard?";

        String b1 = salt + " What is the refund policy for annual plans?";
        String b2 = salt + " If I bought an annual plan, can I get my money back?";

        String unrelated = salt + " Compare TCP and UDP for game servers.";

        float[] vecA1 = embeddingModel.embed(a1).content().vector();
        float[] vecA2 = embeddingModel.embed(a2).content().vector();
        float[] vecA3 = embeddingModel.embed(a3).content().vector();
        float[] vecB1 = embeddingModel.embed(b1).content().vector();
        float[] vecB2 = embeddingModel.embed(b2).content().vector();
        float[] vecUnrelated = embeddingModel.embed(unrelated).content().vector();

        assertThat(vecA1).hasSize(384);

        double simA1A2 = cosineSimilarity(vecA1, vecA2);
        double simA1A3 = cosineSimilarity(vecA1, vecA3);
        double simB1B2 = cosineSimilarity(vecB1, vecB2);
        double simA1Unrelated = cosineSimilarity(vecA1, vecUnrelated);

        System.out.printf("With Salt %s:%n", salt);
        System.out.printf("Similarity Pair A (a1 vs a2 - Paraphrase): %.4f%n", simA1A2);
        System.out.printf("Similarity Near-Miss (a1 vs a3 - Different Intent): %.4f%n", simA1A3);
        System.out.printf("Similarity Pair B (b1 vs b2 - Paraphrase): %.4f%n", simB1B2);
        System.out.printf("Similarity Unrelated (a1 vs unrelated): %.4f%n", simA1Unrelated);

        // Paraphrases must have high similarity (> 0.85 for Pair A)
        assertThat(simA1A2).isGreaterThan(0.85);

        // Near-miss a3 must have lower similarity than paraphrase a2
        assertThat(simA1A2).isGreaterThan(simA1A3);

        // Unrelated must have low similarity (< 0.50)
        assertThat(simA1Unrelated).isLessThan(0.50);
    }
}
