package com.netra.gateway.service;

import com.netra.gateway.model.dto.ChatMessage;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.allminilml6v2q.AllMiniLmL6V2QuantizedEmbeddingModel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * In-JVM ONNX Vector Embedding Service.
 * <p>
 * Generates 384-dimensional dense vectors using all-MiniLM-L6-v2 in sub-5ms
 * without external API calls, Python microservices, or GPU requirements.
 */
@Slf4j
@Service
public class EmbeddingService {

    private final EmbeddingModel embeddingModel;

    public EmbeddingService() {
        this.embeddingModel = new AllMiniLmL6V2QuantizedEmbeddingModel();
    }

    /**
     * Embeds a string into a 384-dimensional dense vector.
     */
    public float[] embed(String text) {
        if (text == null || text.isBlank()) {
            return new float[384];
        }
        return embeddingModel.embed(text).content().vector();
    }

    /**
     * Normalizes a conversation message list into canonical text representation for caching.
     * Single-turn queries use user text directly; multi-turn queries incorporate history to prevent false hits.
     */
    public String extractCacheKeyText(List<ChatMessage> messages) {
        if (messages == null || messages.isEmpty()) {
            return "";
        }
        if (messages.size() == 1) {
            Object content = messages.get(0).getContent();
            return content != null ? content.toString().trim() : "";
        }
        StringBuilder sb = new StringBuilder();
        for (ChatMessage msg : messages) {
            String role = msg.getRole() != null ? msg.getRole().toLowerCase() : "user";
            Object content = msg.getContent();
            String text = content != null ? content.toString().trim() : "";
            sb.append(role).append(": ").append(text).append("\n");
        }
        return sb.toString().trim();
    }

    /**
     * Formats float array into PostgreSQL pgvector string literal: "[0.123456,0.654321,...]".
     */
    public String formatVectorLiteral(float[] vector) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            sb.append(String.format(java.util.Locale.US, "%.6f", vector[i]));
            if (i < vector.length - 1) {
                sb.append(",");
            }
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * Computes cosine similarity between two float vectors in memory: (u · v) / (||u|| * ||v||).
     */
    public double cosineSimilarity(float[] v1, float[] v2) {
        if (v1 == null || v2 == null || v1.length != v2.length) {
            return 0.0;
        }
        double dotProduct = 0.0;
        double norm1 = 0.0;
        double norm2 = 0.0;
        for (int i = 0; i < v1.length; i++) {
            dotProduct += v1[i] * v2[i];
            norm1 += v1[i] * v1[i];
            norm2 += v2[i] * v2[i];
        }
        if (norm1 <= 0.0 || norm2 <= 0.0) {
            return 0.0;
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
}
