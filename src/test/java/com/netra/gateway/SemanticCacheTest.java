package com.netra.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.model.dto.CacheStatsResponse;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.model.dto.UsageInfo;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.CacheEntryRepository;
import com.netra.gateway.repository.RequestLogRepository;
import com.netra.gateway.repository.TenantRepository;
import com.netra.gateway.service.EmbeddingService;
import com.netra.gateway.service.SemanticCacheService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SemanticCacheTest {

    private EmbeddingService embeddingService;
    private CacheEntryRepository cacheEntryRepository;
    private RequestLogRepository requestLogRepository;
    private TenantRepository tenantRepository;
    private ObjectMapper objectMapper;
    private SemanticCacheService semanticCacheService;

    private Tenant searchTenant;
    private Tenant freeTierTenant;
    private Tenant researchTenant;

    @BeforeEach
    void setUp() {
        embeddingService = new EmbeddingService();
        cacheEntryRepository = mock(CacheEntryRepository.class);
        requestLogRepository = mock(RequestLogRepository.class);
        tenantRepository = mock(TenantRepository.class);
        objectMapper = new ObjectMapper();

        // In unit tests without live postgres, CacheEntryRepository queries fail gracefully to in-memory fallback
        when(cacheEntryRepository.findNearestMatch(any(), any(), any(), anyDouble())).thenThrow(new RuntimeException("No pgvector"));
        doThrow(new RuntimeException("No pgvector")).when(cacheEntryRepository).saveWithEmbedding(any(), any(), any(), any(), any(), any());

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
                .similarityThreshold(new BigDecimal("0.92"))
                .modelAllowlist(List.of("fast", "quality"))
                .build();

        freeTierTenant = Tenant.builder()
                .virtualKey("netra-sk-free-tier-7m8n9p")
                .team("free-tier")
                .isActive(true)
                .semanticCacheEnabled(true)
                .similarityThreshold(new BigDecimal("0.85"))
                .modelAllowlist(List.of("fast"))
                .build();

        researchTenant = Tenant.builder()
                .virtualKey("netra-sk-research-4d5e6f")
                .team("research")
                .isActive(true)
                .semanticCacheEnabled(false)
                .similarityThreshold(new BigDecimal("0.90"))
                .modelAllowlist(List.of("quality"))
                .build();
    }

    private ChatCompletionResponse createSampleResponse(String text) {
        return ChatCompletionResponse.builder()
                .id("chatcmpl-test-123")
                .object("chat.completion")
                .created(System.currentTimeMillis() / 1000)
                .model("gpt-4o-mini")
                .choices(List.of(ChatCompletionResponse.Choice.builder()
                        .index(0)
                        .message(ChatMessage.builder().role("assistant").content(text).build())
                        .finishReason("stop")
                        .build()))
                .usage(UsageInfo.builder()
                        .promptTokens(15)
                        .completionTokens(25)
                        .totalTokens(40)
                        .build())
                .build();
    }

    @Test
    @DisplayName("Exact repeat prompt yields cache hit with high similarity")
    void testExactRepeatCacheHit() {
        String prompt = "(salt123) How do I reset my password on the dashboard?";
        List<ChatMessage> messages = List.of(new ChatMessage("user", prompt));
        ChatCompletionResponse response = createSampleResponse("Go to Settings > Security > Reset Password.");

        // Store
        semanticCacheService.store(searchTenant, "fast", messages, response, "alpha/alpha-small");

        // Lookup exact repeat
        Optional<SemanticCacheService.CacheHitResult> hitOpt = semanticCacheService.lookup(searchTenant, "fast", messages);
        assertThat(hitOpt).isPresent();

        SemanticCacheService.CacheHitResult hit = hitOpt.get();
        assertThat(hit.virtualKey()).isEqualTo(searchTenant.getVirtualKey());
        assertThat(hit.modelAlias()).isEqualTo("fast");
        assertThat(hit.resolvedProvider()).isEqualTo("alpha/alpha-small");
        assertThat(hit.similarity()).isGreaterThan(0.99);
        assertThat(hit.response().getChoices().get(0).getMessage().getContent())
                .isEqualTo("Go to Settings > Security > Reset Password.");
    }

    @Test
    @DisplayName("Paraphrased prompt hits semantic cache above 0.92 threshold")
    void testParaphraseMatching() {
        String originalPrompt = "(salt456) How do I reset my password on the dashboard?";
        String paraphrasePrompt = "(salt456) What are the steps to reset my dashboard password?";

        List<ChatMessage> originalMessages = List.of(new ChatMessage("user", originalPrompt));
        List<ChatMessage> paraphraseMessages = List.of(new ChatMessage("user", paraphrasePrompt));
        ChatCompletionResponse response = createSampleResponse("Navigate to Account Settings > Password > Reset.");

        // Store original prompt
        semanticCacheService.store(searchTenant, "fast", originalMessages, response, "alpha/alpha-small");

        // Lookup with paraphrase
        Optional<SemanticCacheService.CacheHitResult> hitOpt = semanticCacheService.lookup(searchTenant, "fast", paraphraseMessages);
        assertThat(hitOpt).isPresent();
        assertThat(hitOpt.get().similarity()).isGreaterThanOrEqualTo(0.92);
    }

    @Test
    @DisplayName("Near-miss semantically related prompt is rejected below threshold")
    void testNearMissRejection() {
        String originalPrompt = "(salt789) How do I reset my password on the dashboard?";
        String nearMissPrompt = "(salt789) How do I configure two-factor authentication on the dashboard?";

        List<ChatMessage> originalMessages = List.of(new ChatMessage("user", originalPrompt));
        List<ChatMessage> nearMissMessages = List.of(new ChatMessage("user", nearMissPrompt));
        ChatCompletionResponse response = createSampleResponse("Navigate to Account Settings > Password > Reset.");

        semanticCacheService.store(searchTenant, "fast", originalMessages, response, "alpha/alpha-small");

        // Search tenant requires 0.92 threshold; 2FA prompt similarity is ~0.80 -> Cache Miss
        Optional<SemanticCacheService.CacheHitResult> hitOpt = semanticCacheService.lookup(searchTenant, "fast", nearMissMessages);
        assertThat(hitOpt).isEmpty();
    }

    @Test
    @DisplayName("Unrelated prompt results in cache miss")
    void testUnrelatedPromptMiss() {
        String originalPrompt = "(salt999) What is the capital of France?";
        String unrelatedPrompt = "(salt999) Compare TCP and UDP networking protocols for multiplayer game servers.";

        List<ChatMessage> originalMessages = List.of(new ChatMessage("user", originalPrompt));
        List<ChatMessage> unrelatedMessages = List.of(new ChatMessage("user", unrelatedPrompt));
        ChatCompletionResponse response = createSampleResponse("The capital of France is Paris.");

        semanticCacheService.store(searchTenant, "fast", originalMessages, response, "alpha/alpha-small");

        Optional<SemanticCacheService.CacheHitResult> hitOpt = semanticCacheService.lookup(searchTenant, "fast", unrelatedMessages);
        assertThat(hitOpt).isEmpty();
    }

    @Test
    @DisplayName("Tenant isolation: Key A cache entry is never visible to Key B")
    void testTenantIsolation() {
        String prompt = "How do I download my monthly invoice?";
        List<ChatMessage> messages = List.of(new ChatMessage("user", prompt));
        ChatCompletionResponse response = createSampleResponse("Go to Billing > Invoices > Download PDF.");

        // Stored under searchTenant
        semanticCacheService.store(searchTenant, "fast", messages, response, "alpha/alpha-small");

        // freeTierTenant sends identical prompt
        Optional<SemanticCacheService.CacheHitResult> hitOpt = semanticCacheService.lookup(freeTierTenant, "fast", messages);
        assertThat(hitOpt).isEmpty();
    }

    @Test
    @DisplayName("Disabled cache tenant never stores and never returns cache hits")
    void testDisabledCacheTenant() {
        String prompt = "Explain quantum computing in one sentence.";
        List<ChatMessage> messages = List.of(new ChatMessage("user", prompt));
        ChatCompletionResponse response = createSampleResponse("Quantum computing harnesses superposition and entanglement for computation.");

        // researchTenant has semanticCacheEnabled = false
        semanticCacheService.store(researchTenant, "quality", messages, response, "alpha/alpha-large");
        Optional<SemanticCacheService.CacheHitResult> hitOpt = semanticCacheService.lookup(researchTenant, "quality", messages);

        assertThat(hitOpt).isEmpty();
    }

    @Test
    @DisplayName("Refusal responses are suppressed and never stored in semantic cache")
    void testRefusalSuppression() {
        String prompt = "How do I bypass software security controls?";
        List<ChatMessage> messages = List.of(new ChatMessage("user", prompt));
        ChatCompletionResponse refusalResponse = createSampleResponse("I'm sorry, but I can't help with that request as it violates safety guidelines.");

        semanticCacheService.store(searchTenant, "fast", messages, refusalResponse, "alpha/alpha-small");

        // Cache must remain empty
        Optional<SemanticCacheService.CacheHitResult> hitOpt = semanticCacheService.lookup(searchTenant, "fast", messages);
        assertThat(hitOpt).isEmpty();
    }

    @Test
    @DisplayName("Multi-turn context keying incorporates complete message history")
    void testMultiTurnContextKeying() {
        List<ChatMessage> conv1 = List.of(
                new ChatMessage("system", "You are a customer service assistant."),
                new ChatMessage("user", "My order is delayed."),
                new ChatMessage("assistant", "What is your order number?"),
                new ChatMessage("user", "It is ORD-12345.")
        );

        List<ChatMessage> conv2DifferentHistory = List.of(
                new ChatMessage("system", "You are a customer service assistant."),
                new ChatMessage("user", "I want to return an item."),
                new ChatMessage("assistant", "What is your order number?"),
                new ChatMessage("user", "It is ORD-12345.")
        );

        ChatCompletionResponse response = createSampleResponse("Your order ORD-12345 is currently out for delivery.");
        semanticCacheService.store(searchTenant, "fast", conv1, response, "alpha/alpha-small");

        // Same multi-turn history -> Hit
        Optional<SemanticCacheService.CacheHitResult> hit1 = semanticCacheService.lookup(searchTenant, "fast", conv1);
        assertThat(hit1).isPresent();

        // Different conversation history with same last message -> Miss
        Optional<SemanticCacheService.CacheHitResult> hit2 = semanticCacheService.lookup(searchTenant, "fast", conv2DifferentHistory);
        assertThat(hit2).isEmpty();
    }

    @Test
    @DisplayName("Cache statistics API aggregates entries, hits, misses, and hit rate")
    void testCacheStatsAggregation() {
        when(cacheEntryRepository.count()).thenReturn(100L);
        when(tenantRepository.findAll()).thenReturn(List.of(searchTenant, freeTierTenant));

        com.netra.gateway.model.dto.UsageSummaryProjection mockSummary = new com.netra.gateway.model.dto.UsageSummaryProjection() {
            @Override public long getRequestCount() { return 50L; }
            @Override public long getTotalPromptTokens() { return 500L; }
            @Override public long getTotalCompletionTokens() { return 500L; }
            @Override public BigDecimal getTotalCostUsd() { return BigDecimal.ZERO; }
            @Override public long getCacheHits() { return 40L; }
        };
        when(requestLogRepository.aggregateUsage(anyString(), any(), any())).thenReturn(mockSummary);
        when(cacheEntryRepository.countByVirtualKey(anyString())).thenReturn(50L);

        CacheStatsResponse stats = semanticCacheService.getCacheStats();

        assertThat(stats.getTotalEntries()).isEqualTo(100L);
        assertThat(stats.getTotalHits()).isEqualTo(80L);
        assertThat(stats.getTotalMisses()).isEqualTo(20L);
        assertThat(stats.getHitRate()).isEqualTo(0.8);
        assertThat(stats.getKeys()).hasSize(2);
        assertThat(stats.getKeys().get("netra-sk-search-1a2b3c").getEntries()).isEqualTo(50L);
        assertThat(stats.getKeys().get("netra-sk-search-1a2b3c").getHits()).isEqualTo(40L);
        assertThat(stats.getKeys().get("netra-sk-search-1a2b3c").getMisses()).isEqualTo(10L);
        assertThat(stats.getKeys().get("netra-sk-search-1a2b3c").getHitRate()).isEqualTo(0.8);
    }
}
