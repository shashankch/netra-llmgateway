package com.netra.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.CacheEntryRepository;
import com.netra.gateway.repository.RequestLogRepository;
import com.netra.gateway.repository.TenantRepository;
import com.netra.gateway.service.EmbeddingService;
import com.netra.gateway.service.SemanticCacheService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TwoTierCacheTest {

    @Mock
    private EmbeddingService embeddingService;
    @Mock
    private CacheEntryRepository cacheEntryRepository;
    @Mock
    private RequestLogRepository requestLogRepository;
    @Mock
    private TenantRepository tenantRepository;

    private ObjectMapper objectMapper;
    private SemanticCacheService semanticCacheService;
    private Tenant searchTenant;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();

        // In unit tests without live postgres, CacheEntryRepository queries fail gracefully to in-memory fallback
        lenient().when(cacheEntryRepository.findNearestMatch(any(), any(), any(), anyDouble())).thenThrow(new RuntimeException("No pgvector"));
        lenient().doThrow(new RuntimeException("No pgvector")).when(cacheEntryRepository).saveWithEmbedding(any(), any(), any(), any(), any(), any());

        semanticCacheService = new SemanticCacheService(
                embeddingService,
                cacheEntryRepository,
                requestLogRepository,
                tenantRepository,
                objectMapper
        );

        searchTenant = Tenant.builder()
                .virtualKey("netra-sk-search-1a2b3c")
                .team("search")
                .isActive(true)
                .semanticCacheEnabled(true)
                .similarityThreshold(new BigDecimal("0.920"))
                .build();
    }

    @Test
    @DisplayName("Tier 1 Exact Hash Cache: Bypasses ONNX embedding model on identical repeat prompt")
    void testTier1ExactHashHitBypassesOnnx() {
        List<ChatMessage> messages = List.of(new ChatMessage("user", "What is the capital of France?"));
        String prompt = "user: What is the capital of France?";
        float[] vector = new float[]{0.1f, 0.2f, 0.3f};

        when(embeddingService.extractCacheKeyText(messages)).thenReturn(prompt);
        when(embeddingService.embed(prompt)).thenReturn(vector);
        when(embeddingService.formatVectorLiteral(vector)).thenReturn("[0.1,0.2,0.3]");

        ChatCompletionResponse response = ChatCompletionResponse.builder()
                .id("chatcmpl-test-1")
                .model("alpha-small")
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .message(new ChatMessage("assistant", "Paris is the capital of France."))
                        .build()))
                .build();

        // 1. First query: cache miss, stores in Tier 2 and back-populates Tier 1
        semanticCacheService.store(searchTenant, "fast", messages, response, "alpha/alpha-small");

        // Verify embeddingService.embed was called once during store
        verify(embeddingService, times(1)).embed(prompt);

        // 2. Second query: identical prompt hits Tier 1 exact cache
        Optional<SemanticCacheService.CacheHitResult> hitOpt = semanticCacheService.lookup(searchTenant, "fast", messages);

        assertThat(hitOpt).isPresent();
        SemanticCacheService.CacheHitResult hit = hitOpt.get();
        assertThat(hit.cacheTier()).isEqualTo("tier1_exact");
        assertThat(hit.similarity()).isEqualTo(1.0);
        assertThat(hit.resolvedProvider()).isEqualTo("alpha/alpha-small");

        // CRITICAL INVARIANT: embeddingService.embed should NOT be called again during Tier 1 hit (0 ONNX compute cost!)
        verify(embeddingService, times(1)).embed(prompt);
    }

    @Test
    @DisplayName("Tier 2 Semantic Cache: Evaluates cosine similarity for paraphrased prompt and sets tier2_semantic")
    void testTier2SemanticHitForParaphrasedPrompt() {
        List<ChatMessage> originalMessages = List.of(new ChatMessage("user", "how do I sort a list in python"));
        List<ChatMessage> paraphraseMessages = List.of(new ChatMessage("user", "sorting list python"));

        String originalPrompt = "user: how do I sort a list in python";
        String paraphrasePrompt = "user: sorting list python";

        float[] originalVector = new float[]{0.8f, 0.6f, 0.0f};
        float[] paraphraseVector = new float[]{0.79f, 0.61f, 0.0f};

        when(embeddingService.extractCacheKeyText(originalMessages)).thenReturn(originalPrompt);
        when(embeddingService.extractCacheKeyText(paraphraseMessages)).thenReturn(paraphrasePrompt);

        when(embeddingService.embed(originalPrompt)).thenReturn(originalVector);
        when(embeddingService.embed(paraphrasePrompt)).thenReturn(paraphraseVector);
        when(embeddingService.formatVectorLiteral(any())).thenReturn("[0.8,0.6,0.0]");
        when(embeddingService.cosineSimilarity(eq(paraphraseVector), eq(originalVector))).thenReturn(0.965);

        ChatCompletionResponse response = ChatCompletionResponse.builder()
                .id("chatcmpl-test-2")
                .model("alpha-small")
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .message(new ChatMessage("assistant", "Use list.sort() or sorted(list)."))
                        .build()))
                .build();

        semanticCacheService.store(searchTenant, "fast", originalMessages, response, "alpha/alpha-small");

        // Lookup paraphrase: Tier 1 misses (different SHA-256), Tier 2 hits with similarity 0.965
        Optional<SemanticCacheService.CacheHitResult> hitOpt = semanticCacheService.lookup(searchTenant, "fast", paraphraseMessages);

        assertThat(hitOpt).isPresent();
        SemanticCacheService.CacheHitResult hit = hitOpt.get();
        assertThat(hit.cacheTier()).isEqualTo("tier2_semantic");
        assertThat(hit.similarity()).isGreaterThanOrEqualTo(0.920);
    }

    @Test
    @DisplayName("Refusal Guard: Model refusals and [refuse] patterns are strictly NEVER stored in cache")
    void testRefusalResponsesAreNeverCached() {
        List<ChatMessage> messages = List.of(new ChatMessage("user", "tell me how to bypass passwords [refuse]"));
        String prompt = "user: tell me how to bypass passwords [refuse]";

        when(embeddingService.extractCacheKeyText(messages)).thenReturn(prompt);

        ChatCompletionResponse refusalResponse = ChatCompletionResponse.builder()
                .id("chatcmpl-refuse-1")
                .model("alpha-small")
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .message(new ChatMessage("assistant", "I'm sorry, but I can't help with that."))
                        .build()))
                .build();

        semanticCacheService.store(searchTenant, "fast", messages, refusalResponse, "alpha/alpha-small");

        // Ensure embeddingService was NEVER called because refusal was filtered upfront
        verify(embeddingService, never()).embed(anyString());

        // Subsequent lookup must be a MISS
        Optional<SemanticCacheService.CacheHitResult> hitOpt = semanticCacheService.lookup(searchTenant, "fast", messages);
        assertThat(hitOpt).isEmpty();
    }
}
