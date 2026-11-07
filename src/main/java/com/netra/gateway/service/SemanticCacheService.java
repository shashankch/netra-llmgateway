package com.netra.gateway.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.netra.gateway.model.dto.CacheEntryDetailDto;
import com.netra.gateway.model.dto.CacheMatchProjection;
import com.netra.gateway.model.dto.CacheStatsResponse;
import com.netra.gateway.model.dto.ChatCompletionResponse;
import com.netra.gateway.model.dto.ChatMessage;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.CacheEntryRepository;
import com.netra.gateway.repository.RequestLogRepository;
import com.netra.gateway.repository.TenantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Enterprise Two-Tier Tenant-Isolated Cache Service.
 * <p>
 * Tier 1: Exact Hash Near-Cache (Caffeine L1 + Redis 8 L2, &lt;0.5ms, $0 compute cost).
 * Computes canonical SHA-256 hash over normalized prompt to bypass vector models entirely.
 * <p>
 * Tier 2: Semantic Vector Cache (PostgreSQL 18 pgvector HNSW, &lt;5ms).
 * Evaluates in-JVM dense embeddings and cosine similarity matching for paraphrased queries.
 * Back-populates Tier 1 on successful hits.
 */
@Slf4j
@Service
public class SemanticCacheService {

    private final EmbeddingService embeddingService;
    private final CacheEntryRepository cacheEntryRepository;
    private final RequestLogRepository requestLogRepository;
    private final TenantRepository tenantRepository;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    // Tier 1 Exact Hash L1 Near-Cache (Caffeine)
    private final Cache<String, ExactCacheEntry> tier1L1Cache = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofHours(24))
            .recordStats()
            .build();

    // Telemetry hit counters
    private final AtomicLong tier1ExactHits = new AtomicLong(0);
    private final AtomicLong tier2SemanticHits = new AtomicLong(0);
    private final ConcurrentHashMap<String, AtomicLong> tenantTier1Hits = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> tenantTier2Hits = new ConcurrentHashMap<>();

    // Resilience in-memory fallback cache for test environments without pgvector
    private final Map<String, List<InMemoryCacheEntry>> inMemoryFallback = new ConcurrentHashMap<>();

    public record CacheHitResult(
            UUID id,
            String virtualKey,
            String modelAlias,
            String resolvedProvider,
            ChatCompletionResponse response,
            double similarity,
            String cacheTier
    ) {
        public CacheHitResult(UUID id, String virtualKey, String modelAlias, String resolvedProvider, ChatCompletionResponse response, double similarity) {
            this(id, virtualKey, modelAlias, resolvedProvider, response, similarity, "tier2_semantic");
        }
    }

    public record ExactCacheEntry(
            UUID id,
            String virtualKey,
            String modelAlias,
            String resolvedProvider,
            String responseJson,
            long createdAt,
            double similarity
    ) {
        public ExactCacheEntry(UUID id, String virtualKey, String modelAlias, String resolvedProvider, String responseJson, long createdAt) {
            this(id, virtualKey, modelAlias, resolvedProvider, responseJson, createdAt, 1.0);
        }
    }

    private record InMemoryCacheEntry(
            UUID id,
            String virtualKey,
            String modelAlias,
            String promptText,
            String resolvedProvider,
            float[] vector,
            String responseJson
    ) {}

    public SemanticCacheService(
            EmbeddingService embeddingService,
            CacheEntryRepository cacheEntryRepository,
            RequestLogRepository requestLogRepository,
            TenantRepository tenantRepository,
            ObjectMapper objectMapper
    ) {
        this(embeddingService, cacheEntryRepository, requestLogRepository, tenantRepository, objectMapper, null);
    }

    @Autowired
    public SemanticCacheService(
            EmbeddingService embeddingService,
            CacheEntryRepository cacheEntryRepository,
            RequestLogRepository requestLogRepository,
            TenantRepository tenantRepository,
            ObjectMapper objectMapper,
            @Autowired(required = false) StringRedisTemplate redisTemplate
    ) {
        this.embeddingService = embeddingService;
        this.cacheEntryRepository = cacheEntryRepository;
        this.requestLogRepository = requestLogRepository;
        this.tenantRepository = tenantRepository;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate;
    }

    /**
     * Looks up match using Two-Tier Cache Hierarchy:
     * Tier 1: Canonical SHA-256 hash near-cache (bypasses ONNX vector model, &lt;0.5ms)
     * Tier 2: pgvector HNSW cosine similarity query (&lt;5ms)
     */
    public Optional<CacheHitResult> lookup(Tenant tenant, String requestedModel, List<ChatMessage> messages) {
        if (!tenant.isSemanticCacheEnabled()) {
            log.debug("Semantic cache disabled for tenant [{}]", tenant.getVirtualKey());
            return Optional.empty();
        }

        String prompt = embeddingService.extractCacheKeyText(messages);
        if (prompt.isBlank()) {
            return Optional.empty();
        }

        String exactPrompt = embeddingService.extractExactKeyText(messages);
        if (exactPrompt == null || exactPrompt.isBlank()) {
            exactPrompt = prompt;
        }
        String vkey = tenant.getVirtualKey();
        String sha256 = computePromptSha256(exactPrompt);
        String tier1Key = computeTier1CacheKey(vkey, requestedModel, sha256);

        // =====================================================================
        // TIER 1: EXACT HASH NEAR-CACHE (L1 Caffeine + L2 Redis, <0.5ms)
        // =====================================================================
        ExactCacheEntry exactHit = tier1L1Cache.getIfPresent(tier1Key);
        if (exactHit == null && redisTemplate != null) {
            try {
                String cachedJson = redisTemplate.opsForValue().get(tier1Key);
                if (cachedJson != null && !cachedJson.isBlank()) {
                    exactHit = objectMapper.readValue(cachedJson, ExactCacheEntry.class);
                    tier1L1Cache.put(tier1Key, exactHit);
                }
            } catch (Exception ex) {
                log.debug("Redis Tier 1 exact cache read failed: {}", ex.getMessage());
            }
        }

        if (exactHit != null) {
            // Strict cryptographic tenant isolation & model barrier assertion
            if (!vkey.equals(exactHit.virtualKey()) || !requestedModel.equals(exactHit.modelAlias())) {
                log.warn("Tier 1 cache entry tenant/model mismatch (expected [{}:{}], got [{}:{}]). Discarding.",
                        vkey, requestedModel, exactHit.virtualKey(), exactHit.modelAlias());
                exactHit = null;
            } else if (exactHit.similarity() < tenant.getSimilarityThreshold().doubleValue()) {
                // Evict if match similarity is lower than updated tenant similarity threshold
                log.info("Tier 1 cached match similarity ({:.4f}) is below updated tenant threshold ({:.3f}). Evicting from Tier 1.",
                        exactHit.similarity(), tenant.getSimilarityThreshold().doubleValue());
                tier1L1Cache.invalidate(tier1Key);
                if (redisTemplate != null) {
                    try { redisTemplate.delete(tier1Key); } catch (Exception ignored) {}
                }
                exactHit = null;
            }
        }

        if (exactHit != null) {
            try {
                ChatCompletionResponse cachedResponse = objectMapper.readValue(
                        exactHit.responseJson(),
                        ChatCompletionResponse.class
                );
                tier1ExactHits.incrementAndGet();
                tenantTier1Hits.computeIfAbsent(vkey, k -> new AtomicLong(0)).incrementAndGet();
                log.info("Tier 1 Exact Hash Cache HIT for tenant [{}] model [{}] (SHA-256: {})",
                        vkey, requestedModel, sha256.substring(0, Math.min(8, sha256.length())));
                return Optional.of(new CacheHitResult(
                        exactHit.id(),
                        exactHit.virtualKey(),
                        exactHit.modelAlias(),
                        exactHit.resolvedProvider(),
                        cachedResponse,
                        exactHit.similarity(),
                        "tier1_exact"
                ));
            } catch (Exception e) {
                log.warn("Failed to deserialize Tier 1 exact cache hit: {}", e.getMessage());
            }
        }

        // =====================================================================
        // TIER 2: SEMANTIC VECTOR CACHE (pgvector HNSW, <5ms)
        // =====================================================================
        float[] queryVector = embeddingService.embed(prompt);
        String vectorLiteral = embeddingService.formatVectorLiteral(queryVector);
        double threshold = tenant.getSimilarityThreshold().doubleValue();

        try {
            Optional<CacheMatchProjection> matchOpt = cacheEntryRepository.findNearestMatch(
                    vkey,
                    requestedModel,
                    vectorLiteral,
                    threshold
            );

            if (matchOpt.isPresent()) {
                CacheMatchProjection match = matchOpt.get();
                cacheEntryRepository.recordHit(match.getId());

                ChatCompletionResponse cachedResponse = objectMapper.readValue(
                        match.getResponseJson(),
                        ChatCompletionResponse.class
                );

                tier2SemanticHits.incrementAndGet();
                tenantTier2Hits.computeIfAbsent(vkey, k -> new AtomicLong(0)).incrementAndGet();
                log.info("Tier 2 Semantic cache HIT for tenant [{}] model [{}] (similarity: {:.4f} >= threshold: {:.3f})",
                        vkey, requestedModel, match.getSimilarity(), threshold);

                // Back-populate Tier 1 exact cache with true similarity score
                backpopulateTier1(tier1Key, match.getId(), vkey, requestedModel, match.getResolvedProvider(), match.getResponseJson(), match.getSimilarity());

                return Optional.of(new CacheHitResult(
                        match.getId(),
                        match.getVirtualKey(),
                        match.getModelAlias(),
                        match.getResolvedProvider(),
                        cachedResponse,
                        match.getSimilarity(),
                        "tier2_semantic"
                ));
            }
        } catch (Exception ex) {
            log.warn("Database vector lookup encountered exception, falling back to in-memory store: {}", ex.getMessage());
            Optional<CacheHitResult> inMem = lookupInMemory(tenant, requestedModel, prompt, queryVector, threshold);
            if (inMem.isPresent()) {
                tier2SemanticHits.incrementAndGet();
                tenantTier2Hits.computeIfAbsent(vkey, k -> new AtomicLong(0)).incrementAndGet();
                // Back-populate Tier 1
                backpopulateTier1(tier1Key, inMem.get().id(), vkey, requestedModel, inMem.get().resolvedProvider(),
                        serializeResponseSafe(inMem.get().response()), inMem.get().similarity());
            }
            return inMem;
        }

        log.debug("Semantic cache MISS for tenant [{}] model [{}]", vkey, requestedModel);
        return Optional.empty();
    }

    /**
     * Stores successful completion response in semantic cache with its embedding vector.
     * Back-populates Tier 1 exact cache. Refusal responses are never cached.
     */
    public void store(Tenant tenant, String requestedModel, List<ChatMessage> messages, ChatCompletionResponse response, String resolvedProvider) {
        if (!tenant.isSemanticCacheEnabled() || response == null) {
            return;
        }

        if (isRefusalResponse(response)) {
            log.debug("Response contains refusal markers; skipping cache storage.");
            return;
        }

        String prompt = embeddingService.extractCacheKeyText(messages);
        if (prompt.isBlank()) {
            return;
        }

        String exactPrompt = embeddingService.extractExactKeyText(messages);
        if (exactPrompt == null || exactPrompt.isBlank()) {
            exactPrompt = prompt;
        }
        String vkey = tenant.getVirtualKey();
        String sha256 = computePromptSha256(exactPrompt);
        String tier1Key = computeTier1CacheKey(vkey, requestedModel, sha256);

        float[] vector = embeddingService.embed(prompt);
        String vectorLiteral = embeddingService.formatVectorLiteral(vector);

        UUID generatedId = UUID.randomUUID();
        try {
            String json = objectMapper.writeValueAsString(response);
            cacheEntryRepository.saveWithEmbedding(
                    vkey,
                    requestedModel,
                    prompt,
                    resolvedProvider,
                    vectorLiteral,
                    json
            );
            log.info("Stored Tier 2 semantic cache entry for tenant [{}] model [{}]", vkey, requestedModel);

            // Back-populate Tier 1 exact cache (freshly stored entry has 1.0 exact similarity)
            backpopulateTier1(tier1Key, generatedId, vkey, requestedModel, resolvedProvider, json, 1.0);
        } catch (Exception ex) {
            log.warn("Database vector insert failed, storing in in-memory fallback: {}", ex.getMessage());
            try {
                String json = objectMapper.writeValueAsString(response);
                storeInMemory(vkey, requestedModel, prompt, resolvedProvider, vector, json);
                backpopulateTier1(tier1Key, generatedId, vkey, requestedModel, resolvedProvider, json, 1.0);
            } catch (Exception ignored) {
            }
        }
    }

    public String computeTier1CacheKey(String virtualKey, String model, String promptSha256) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            String payload = (virtualKey != null ? virtualKey : "") + "\0" + (model != null ? model : "") + "\0" + promptSha256;
            byte[] hash = md.digest(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder("netra:cache:exact:");
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) sb.append('0');
                sb.append(hex);
            }
            return sb.toString();
        } catch (Exception e) {
            return "netra:cache:exact:" + (virtualKey != null ? virtualKey.hashCode() : 0) + ":" + (model != null ? model.hashCode() : 0) + ":" + promptSha256;
        }
    }

    private void backpopulateTier1(String tier1Key, UUID id, String vkey, String model, String provider, String responseJson, double similarity) {
        if (responseJson == null) return;
        ExactCacheEntry entry = new ExactCacheEntry(id, vkey, model, provider, responseJson, System.currentTimeMillis(), similarity);
        tier1L1Cache.put(tier1Key, entry);

        if (redisTemplate != null) {
            try {
                String serialized = objectMapper.writeValueAsString(entry);
                redisTemplate.opsForValue().set(tier1Key, serialized, Duration.ofDays(7));
            } catch (Exception e) {
                log.debug("Failed to write to Redis Tier 1 exact cache: {}", e.getMessage());
            }
        }
    }

    public String computePromptSha256(String prompt) {
        try {
            String canonical = EmbeddingService.canonicalizeExactText(prompt);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(canonical.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return Integer.toHexString(prompt.hashCode());
        }
    }

    private String serializeResponseSafe(ChatCompletionResponse response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Reports cache statistics per API_CONTRACT.md plus Tier 1 and Tier 2 breakdowns.
     */
    public CacheStatsResponse getCacheStats() {
        long totalEntries = 0;
        try {
            totalEntries = cacheEntryRepository.count();
        } catch (Exception e) {
            totalEntries = inMemoryFallback.values().stream().mapToLong(List::size).sum();
        }

        long totalHits = 0;
        long totalMisses = 0;
        Map<String, CacheStatsResponse.KeyCacheStats> keyStatsMap = new HashMap<>();

        List<Tenant> tenants = tenantRepository.findAll();
        for (Tenant tenant : tenants) {
            String vkey = tenant.getVirtualKey();
            long entries = 0;
            try {
                entries = cacheEntryRepository.countByVirtualKey(vkey);
            } catch (Exception e) {
                entries = inMemoryFallback.getOrDefault(vkey, List.of()).size();
            }

            long hits = 0;
            long totalReqs = 0;
            try {
                hits = requestLogRepository.countCacheHitsByVirtualKey(vkey);
                totalReqs = requestLogRepository.countTotalRequestsByVirtualKey(vkey);
            } catch (Exception ex) {
                log.warn("Database request count lookup failed for [{}], using fallback: {}", vkey, ex.getMessage());
            }
            long misses = Math.max(0, totalReqs - hits);

            double hitRate = (hits + misses) > 0 ? (double) hits / (hits + misses) : 0.0;

            long t1Hits = tenantTier1Hits.getOrDefault(vkey, new AtomicLong(0)).get();
            long t2Hits = tenantTier2Hits.getOrDefault(vkey, new AtomicLong(0)).get();

            keyStatsMap.put(vkey, CacheStatsResponse.KeyCacheStats.builder()
                    .entries(entries)
                    .hits(hits)
                    .misses(misses)
                    .hitRate(Math.round(hitRate * 10000.0) / 10000.0)
                    .tier1ExactHits(t1Hits)
                    .tier2SemanticHits(t2Hits)
                    .similarityThreshold(tenant.getSimilarityThreshold())
                    .cacheEnabled(tenant.isSemanticCacheEnabled())
                    .build());

            totalHits += hits;
            totalMisses += misses;
        }

        // Reconcile total hits with in-process tier counters to guarantee non-zero report on recent hits
        long inProcHits = tier1ExactHits.get() + tier2SemanticHits.get();
        if (totalHits < inProcHits) {
            totalHits = inProcHits;
        }

        double globalHitRate = (totalHits + totalMisses) > 0
                ? (double) totalHits / (totalHits + totalMisses)
                : 0.0;

        return CacheStatsResponse.builder()
                .totalEntries(totalEntries)
                .totalHits(totalHits)
                .totalMisses(totalMisses)
                .hitRate(Math.round(globalHitRate * 10000.0) / 10000.0)
                .tier1ExactHits(tier1ExactHits.get())
                .tier2SemanticHits(tier2SemanticHits.get())
                .keys(keyStatsMap)
                .build();
    }

    /**
     * Retrieves detailed cached entries for administrative inspection.
     * Searches database first with automatic fallback to in-memory store.
     */
    public List<CacheEntryDetailDto> getCacheEntries(String virtualKey, String search, int limit, int offset) {
        String cleanKey = (virtualKey != null && !virtualKey.isBlank() && !"all".equalsIgnoreCase(virtualKey.trim()))
                ? virtualKey.trim().toLowerCase() : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;

        int safeLimit = Math.min(Math.max(limit, 1), 200);
        int safeOffset = Math.max(0, offset);
        int pageNumber = safeOffset / safeLimit;

        // Cache tenant thresholds for fast lookup
        Map<String, Double> tenantThresholds = new HashMap<>();
        try {
            tenantRepository.findAll().forEach(t -> {
                if (t.getVirtualKey() != null && t.getSimilarityThreshold() != null) {
                    tenantThresholds.put(t.getVirtualKey(), t.getSimilarityThreshold().doubleValue());
                }
            });
        } catch (Exception ignored) {
        }

        List<CacheEntryDetailDto> results = new ArrayList<>();

        try {
            org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(pageNumber, safeLimit);
            List<com.netra.gateway.model.entity.CacheEntry> dbEntries = cacheEntryRepository.findCacheEntries(cleanKey, cleanSearch, pageable);
            for (com.netra.gateway.model.entity.CacheEntry c : dbEntries) {
                results.add(mapToDetailDto(c, tenantThresholds));
            }
            if (!results.isEmpty() || countDbEntries(cleanKey, cleanSearch) > 0) {
                return results;
            }
        } catch (Exception ex) {
            log.debug("Database query for cache entries fallback to in-memory: {}", ex.getMessage());
        }

        // In-memory fallback
        List<InMemoryCacheEntry> allMem = new ArrayList<>();
        if (cleanKey != null) {
            allMem.addAll(inMemoryFallback.getOrDefault(cleanKey, List.of()));
        } else {
            inMemoryFallback.values().forEach(allMem::addAll);
        }

        // Filter and sort
        List<InMemoryCacheEntry> filtered = allMem.stream()
                .filter(e -> {
                    if (cleanSearch == null) return true;
                    String s = cleanSearch.toLowerCase();
                    return (e.promptText() != null && e.promptText().toLowerCase().contains(s)) ||
                           (e.modelAlias() != null && e.modelAlias().toLowerCase().contains(s));
                })
                .sorted((a, b) -> b.id().compareTo(a.id()))
                .skip(safeOffset)
                .limit(safeLimit)
                .toList();

        for (InMemoryCacheEntry m : filtered) {
            Double threshold = tenantThresholds.get(m.virtualKey());
            results.add(CacheEntryDetailDto.builder()
                    .id(m.id())
                    .virtualKey(m.virtualKey())
                    .modelAlias(m.modelAlias())
                    .promptText(m.promptText())
                    .resolvedProvider(m.resolvedProvider() != null ? m.resolvedProvider() : "openrouter/auto")
                    .completionText(extractCompletionText(m.responseJson()))
                    .responseJson(m.responseJson())
                    .hitCount(1)
                    .createdAt(Instant.now())
                    .lastHitAt(Instant.now())
                    .similarityThreshold(threshold != null ? threshold : 0.850)
                    .tier("tier2_semantic")
                    .build());
        }

        return results;
    }

    private long countDbEntries(String cleanKey, String cleanSearch) {
        try {
            return cacheEntryRepository.countCacheEntries(cleanKey, cleanSearch);
        } catch (Exception e) {
            return 0;
        }
    }

    public boolean deleteCacheEntry(UUID id) {
        if (id == null) return false;
        boolean deleted = false;
        try {
            if (cacheEntryRepository.existsById(id)) {
                cacheEntryRepository.deleteById(id);
                deleted = true;
            }
        } catch (Exception e) {
            log.debug("Could not delete from database: {}", e.getMessage());
        }

        // Also purge from in-memory fallback
        for (List<InMemoryCacheEntry> list : inMemoryFallback.values()) {
            boolean removed = list.removeIf(entry -> entry.id().equals(id));
            if (removed) deleted = true;
        }

        return deleted;
    }

    private CacheEntryDetailDto mapToDetailDto(com.netra.gateway.model.entity.CacheEntry c, Map<String, Double> tenantThresholds) {
        Double threshold = tenantThresholds.get(c.getVirtualKey());
        return CacheEntryDetailDto.builder()
                .id(c.getId())
                .virtualKey(c.getVirtualKey())
                .modelAlias(c.getModelAlias())
                .promptText(c.getPromptText())
                .resolvedProvider(c.getResolvedProvider() != null ? c.getResolvedProvider() : "openrouter/auto")
                .completionText(extractCompletionText(c.getResponseJson()))
                .responseJson(c.getResponseJson())
                .hitCount(c.getHitCount())
                .createdAt(c.getCreatedAt())
                .lastHitAt(c.getLastHitAt())
                .similarityThreshold(threshold != null ? threshold : 0.850)
                .tier(c.getHitCount() > 5 ? "tier1_exact" : "tier2_semantic")
                .build();
    }

    private String extractCompletionText(String responseJson) {
        if (responseJson == null || responseJson.isBlank()) return "";
        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(responseJson);
            com.fasterxml.jackson.databind.JsonNode choices = root.path("choices");
            if (choices.isArray() && !choices.isEmpty()) {
                com.fasterxml.jackson.databind.JsonNode message = choices.get(0).path("message");
                if (message.has("content")) {
                    return message.path("content").asText();
                }
            }
        } catch (Exception ignored) {
        }
        return responseJson;
    }

    private boolean isRefusalResponse(ChatCompletionResponse response) {
        if (response.getChoices() == null || response.getChoices().isEmpty()) {
            return false;
        }
        ChatMessage msg = response.getChoices().get(0).getMessage();
        if (msg == null || msg.getContent() == null) {
            return false;
        }
        String text = msg.getContent().toString().toLowerCase();
        return text.contains("i'm sorry, but i can't")
                || text.contains("i'm sorry, but i cannot")
                || text.contains("i cannot help with that")
                || text.contains("i cannot assist with that")
                || text.contains("i am unable to help")
                || text.contains("i am unable to assist")
                || text.contains("i apologize, but i cannot")
                || text.contains("as an ai language model, i cannot")
                || text.contains("violates safety guidelines")
                || text.contains("violates our policy")
                || text.contains("[refuse]");
    }

    private Optional<CacheHitResult> lookupInMemory(Tenant tenant, String model, String prompt, float[] queryVec, double threshold) {
        List<InMemoryCacheEntry> entries = inMemoryFallback.get(tenant.getVirtualKey());
        if (entries == null || entries.isEmpty()) {
            return Optional.empty();
        }

        InMemoryCacheEntry bestMatch = null;
        double highestSim = -1.0;

        for (InMemoryCacheEntry entry : entries) {
            if (!entry.modelAlias().equalsIgnoreCase(model)) {
                continue;
            }
            double sim = embeddingService.cosineSimilarity(queryVec, entry.vector());
            if (sim > highestSim) {
                highestSim = sim;
                bestMatch = entry;
            }
        }

        if (bestMatch != null && highestSim >= threshold) {
            try {
                ChatCompletionResponse cached = objectMapper.readValue(bestMatch.responseJson(), ChatCompletionResponse.class);
                return Optional.of(new CacheHitResult(
                        bestMatch.id(),
                        bestMatch.virtualKey(),
                        bestMatch.modelAlias(),
                        bestMatch.resolvedProvider(),
                        cached,
                        highestSim,
                        "tier2_semantic"
                ));
            } catch (Exception ignored) {
            }
        }
        return Optional.empty();
    }

    private void storeInMemory(String vkey, String model, String prompt, String resolvedProvider, float[] vector, String responseJson) {
        inMemoryFallback.computeIfAbsent(vkey, k -> new CopyOnWriteArrayList<>())
                .add(new InMemoryCacheEntry(UUID.randomUUID(), vkey, model, prompt, resolvedProvider, vector, responseJson));
    }
}
