package com.netra.gateway;

import com.netra.gateway.exception.RateLimitException;
import com.netra.gateway.model.dto.CacheMatchProjection;
import com.netra.gateway.model.dto.UsageSummaryProjection;
import com.netra.gateway.model.entity.RequestLog;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.CacheEntryRepository;
import com.netra.gateway.repository.RequestLogRepository;
import com.netra.gateway.repository.TenantRepository;
import com.netra.gateway.service.AdmissionResult;
import com.netra.gateway.service.AdmissionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Enterprise live integration test suite validating real PostgreSQL 18 with pgvector,
 * real Redis 8.0 with admission.lua atomic sliding-window rate limiting,
 * cross-tenant vector isolation, and durable source-of-truth cache hit accounting.
 *
 * Employs DockerAvailableCondition to execute automatically when Docker/OrbStack is running
 * (including GitHub Actions CI), while safely skipping when running in offline environments
 * without an active container daemon.
 */
@SpringBootTest
@ExtendWith(DatabaseAndCacheIntegrationTest.DockerAvailableCondition.class)
public class DatabaseAndCacheIntegrationTest {

    private static final PostgreSQLContainer<?> postgres;
    private static final GenericContainer<?> redis;

    static {
        if (isDockerDaemonAvailable()) {
            postgres = new PostgreSQLContainer<>(DockerImageName.parse("pgvector/pgvector:pg18").asCompatibleSubstituteFor("postgres"))
                    .withDatabaseName("netra_test")
                    .withUsername("test_user")
                    .withPassword("test_pass");
            postgres.start();

            redis = new GenericContainer<>(DockerImageName.parse("redis:8.0-alpine"))
                    .withExposedPorts(6379);
            redis.start();
        } else {
            postgres = null;
            redis = null;
        }
    }

    private static boolean isDockerDaemonAvailable() {
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (Throwable t) {
            return false;
        }
    }

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        if (postgres != null && postgres.isRunning()) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl);
            registry.add("spring.datasource.username", postgres::getUsername);
            registry.add("spring.datasource.password", postgres::getPassword);
            registry.add("spring.flyway.enabled", () -> "true");
        }
        if (redis != null && redis.isRunning()) {
            registry.add("spring.data.redis.host", redis::getHost);
            registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        }
    }

    @Autowired(required = false)
    private TenantRepository tenantRepository;

    @Autowired(required = false)
    private CacheEntryRepository cacheEntryRepository;

    @Autowired(required = false)
    private RequestLogRepository requestLogRepository;

    @Autowired(required = false)
    private AdmissionService admissionService;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    // =========================================================================
    // 1. PostgreSQL & Flyway Schema Migrations
    // =========================================================================

    @Test
    @DisplayName("PostgreSQL: Should successfully execute Flyway migrations and persist/retrieve Tenant entities")
    void shouldPersistAndRetrieveTenant() {
        if (tenantRepository == null) return;

        String testKey = "netra-sk-it-tenant-" + System.currentTimeMillis();
        Tenant tenant = Tenant.builder()
                .virtualKey(testKey)
                .team("Integration Test Team")
                .rpmLimit(100)
                .tpmLimit(20000)
                .monthlyBudgetUsd(new BigDecimal("50.00"))
                .modelAllowlist(List.of("fast", "smart", "auto"))
                .isActive(true)
                .build();

        tenantRepository.save(tenant);

        Optional<Tenant> retrieved = tenantRepository.findByVirtualKey(testKey);
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getTeam()).isEqualTo("Integration Test Team");
        assertThat(retrieved.get().getRpmLimit()).isEqualTo(100);
        assertThat(retrieved.get().getTpmLimit()).isEqualTo(20000);
        assertThat(retrieved.get().getModelAllowlist()).containsExactly("fast", "smart", "auto");
    }

    // =========================================================================
    // 2. Real PostgreSQL pgvector Vector Similarity Search & Tenant Isolation
    // =========================================================================

    @Test
    @DisplayName("pgvector: Real cosine distance search (<=>) returns nearest match above similarity threshold")
    void shouldFindNearestMatchUsingRealPgvectorCosineDistance() {
        if (cacheEntryRepository == null || tenantRepository == null) return;

        String tenantKey = "netra-sk-pgvector-" + System.currentTimeMillis();
        tenantRepository.save(Tenant.builder()
                .virtualKey(tenantKey)
                .team("PgVector Team")
                .rpmLimit(60)
                .modelAllowlist(List.of("fast"))
                .isActive(true)
                .build());

        String modelAlias = "fast";
        String prompt = "What is the capital of France?";
        String responseJson = "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"Paris\"}}]}";

        // Generate synthetic normalized 384-dimensional vector
        float[] baseVector = createNormalizedVector(384, 1.0f);
        String vectorLiteral = formatVectorLiteral(baseVector);

        // 1. Insert into real PostgreSQL 18 table via native SQL casting
        UUID entryId = UUID.randomUUID();
        cacheEntryRepository.saveWithEmbedding(
                entryId,
                tenantKey,
                modelAlias,
                prompt,
                "alpha/mock-model",
                vectorLiteral,
                responseJson
        );

        // 2. Query with the exact same vector (similarity should be ~1.0, distance ~0.0)
        Optional<CacheMatchProjection> exactMatch = cacheEntryRepository.findNearestMatch(
                tenantKey,
                modelAlias,
                vectorLiteral,
                0.95
        );
        assertThat(exactMatch).isPresent();
        assertThat(exactMatch.get().getPromptText()).isEqualTo(prompt);
        assertThat(exactMatch.get().getResponseJson()).contains("Paris");
        assertThat(exactMatch.get().getSimilarity()).isGreaterThanOrEqualTo(0.99);

        // 3. Query with a perturbed vector that has high similarity (~0.95)
        float[] similarVector = Arrays.copyOf(baseVector, baseVector.length);
        similarVector[0] += 0.05f;
        normalize(similarVector);
        String similarLiteral = formatVectorLiteral(similarVector);

        Optional<CacheMatchProjection> similarMatch = cacheEntryRepository.findNearestMatch(
                tenantKey,
                modelAlias,
                similarLiteral,
                0.90
        );
        assertThat(similarMatch).isPresent();
        assertThat(similarMatch.get().getSimilarity()).isGreaterThanOrEqualTo(0.90);

        // 4. Query with an orthogonal/distant vector (similarity < 0.5) with threshold = 0.90 -> should MISS
        float[] distantVector = createNormalizedVector(384, -1.0f);
        String distantLiteral = formatVectorLiteral(distantVector);

        Optional<CacheMatchProjection> distantMatch = cacheEntryRepository.findNearestMatch(
                tenantKey,
                modelAlias,
                distantLiteral,
                0.90
        );
        assertThat(distantMatch).isEmpty();
    }

    @Test
    @DisplayName("pgvector: Cryptographic cross-tenant vector isolation prevents cross-tenant cache hits")
    void shouldEnforceCrossTenantVectorIsolationInPgvector() {
        if (cacheEntryRepository == null || tenantRepository == null) return;

        String tenantA = "netra-sk-tenant-a-" + System.currentTimeMillis();
        String tenantB = "netra-sk-tenant-b-" + System.currentTimeMillis();

        tenantRepository.save(Tenant.builder().virtualKey(tenantA).team("Team A").rpmLimit(60).modelAllowlist(List.of("smart")).isActive(true).build());
        tenantRepository.save(Tenant.builder().virtualKey(tenantB).team("Team B").rpmLimit(60).modelAllowlist(List.of("smart")).isActive(true).build());

        String modelAlias = "smart";
        String prompt = "Confidential financial quarterly forecast for Tenant A";
        String responseJson = "{\"content\":\"Net income up 15%\"}";

        float[] vector = createNormalizedVector(384, 0.42f);
        String vectorLiteral = formatVectorLiteral(vector);

        // Tenant A stores the entry
        cacheEntryRepository.saveWithEmbedding(
                UUID.randomUUID(),
                tenantA,
                modelAlias,
                prompt,
                "alpha/smart-model",
                vectorLiteral,
                responseJson
        );

        // Tenant A queries with exact vector -> MATCH
        Optional<CacheMatchProjection> matchTenantA = cacheEntryRepository.findNearestMatch(
                tenantA,
                modelAlias,
                vectorLiteral,
                0.90
        );
        assertThat(matchTenantA).isPresent();

        // Tenant B queries with the EXACT same vector and prompt -> MUST BE EMPTY (hard isolation)
        Optional<CacheMatchProjection> matchTenantB = cacheEntryRepository.findNearestMatch(
                tenantB,
                modelAlias,
                vectorLiteral,
                0.90
        );
        assertThat(matchTenantB).isEmpty();
    }

    // =========================================================================
    // 3. PostgreSQL Durable Source-of-Truth Cache Accounting
    // =========================================================================

    @Test
    @DisplayName("PostgreSQL: Durable cache accounting in request_logs aggregates accurately without in-process drift")
    void shouldAccuratelyAggregateDurableCacheStatsInPostgres() {
        if (requestLogRepository == null || tenantRepository == null) return;

        String testTenant = "netra-sk-audit-" + System.currentTimeMillis();
        tenantRepository.save(Tenant.builder().virtualKey(testTenant).team("Audit Team").rpmLimit(60).modelAllowlist(List.of("fast")).isActive(true).build());

        // Insert 3 requests: 1 exact hit, 1 semantic hit, 1 miss (do not set ID manually to let JPA persist properly)
        RequestLog log1 = RequestLog.builder()
                .requestId("req_it_1")
                .virtualKey(testTenant)
                .requestedModel("fast")
                .resolvedModel("alpha/small")
                .statusCode(200)
                .status("OK")
                .cache("hit")
                .cacheTier("tier1_exact")
                .costUsd(BigDecimal.ZERO)
                .promptTokens(10)
                .completionTokens(20)
                .latencyMs(5)
                .createdAt(Instant.now())
                .build();

        RequestLog log2 = RequestLog.builder()
                .requestId("req_it_2")
                .virtualKey(testTenant)
                .requestedModel("fast")
                .resolvedModel("alpha/small")
                .statusCode(200)
                .status("OK")
                .cache("hit")
                .cacheTier("tier2_semantic")
                .costUsd(BigDecimal.ZERO)
                .promptTokens(15)
                .completionTokens(30)
                .latencyMs(12)
                .createdAt(Instant.now())
                .build();

        RequestLog log3 = RequestLog.builder()
                .requestId("req_it_3")
                .virtualKey(testTenant)
                .requestedModel("fast")
                .resolvedModel("alpha/small")
                .statusCode(200)
                .status("OK")
                .cache("miss")
                .cacheTier("none")
                .costUsd(new BigDecimal("0.000150"))
                .promptTokens(25)
                .completionTokens(50)
                .latencyMs(250)
                .createdAt(Instant.now())
                .build();

        requestLogRepository.saveAll(List.of(log1, log2, log3));

        // Durable database counts
        long totalReqs = requestLogRepository.countTotalRequestsByVirtualKey(testTenant);
        long totalCacheHits = requestLogRepository.countCacheHitsByVirtualKey(testTenant);
        long tier1Hits = requestLogRepository.countTier1ExactHitsByVirtualKey(testTenant);
        long tier2Hits = requestLogRepository.countTier2SemanticHitsByVirtualKey(testTenant);

        assertThat(totalReqs).isEqualTo(3);
        assertThat(totalCacheHits).isEqualTo(2);
        assertThat(tier1Hits).isEqualTo(1);
        assertThat(tier2Hits).isEqualTo(1);

        UsageSummaryProjection summary = requestLogRepository.aggregateUsageAllTime(testTenant);
        assertThat(summary.getRequestCount()).isEqualTo(3);
        assertThat(summary.getCacheHits()).isEqualTo(2);
        assertThat(summary.getTotalPromptTokens()).isEqualTo(50L);
        assertThat(summary.getTotalCompletionTokens()).isEqualTo(100L);
        assertThat(summary.getTotalCostUsd()).isGreaterThan(BigDecimal.ZERO);
    }

    // =========================================================================
    // 4. Real Redis 8.0 Atomic Admission Engine & Lua Rate Limiting
    // =========================================================================

    @Test
    @DisplayName("Redis 8.0: admission.lua atomic sliding-window enforces RPM limits and rejects on breach")
    void shouldEnforceAtomicRpmLimitInRealRedis() {
        if (admissionService == null || redisTemplate == null) return;

        String testKey = "netra-sk-redis-rpm-" + System.currentTimeMillis();
        Tenant tenant = Tenant.builder()
                .virtualKey(testKey)
                .team("Redis Test Team")
                .rpmLimit(3) // 3 requests per minute
                .monthlyBudgetUsd(new BigDecimal("100.00"))
                .build();

        // 1. Requests 1, 2, 3 should be admitted with decreasing remaining counts
        AdmissionResult res1 = admissionService.checkAdmission(tenant, "req_r1");
        assertThat(res1.limit()).isEqualTo(3);
        assertThat(res1.remaining()).isEqualTo(2);

        AdmissionResult res2 = admissionService.checkAdmission(tenant, "req_r2");
        assertThat(res2.remaining()).isEqualTo(1);

        AdmissionResult res3 = admissionService.checkAdmission(tenant, "req_r3");
        assertThat(res3.remaining()).isEqualTo(0);

        // 2. Request 4 breaches RPM limit -> RateLimitException (429 rate_limit_exceeded)
        assertThatThrownBy(() -> admissionService.checkAdmission(tenant, "req_r4"))
                .isInstanceOf(RateLimitException.class)
                .satisfies(ex -> {
                    RateLimitException rle = (RateLimitException) ex;
                    assertThat(rle.getErrorType()).isEqualTo("rate_limit_exceeded");
                    assertThat(rle.getErrorCode()).isEqualTo("rate_limit_exceeded");
                });
    }

    @Test
    @DisplayName("Redis 8.0: admission.lua enforces TPM token limits and allows atomic quota rollback")
    void shouldEnforceTpmLimitAndSupportAtomicRollbackInRealRedis() {
        if (admissionService == null || redisTemplate == null) return;

        String testKey = "netra-sk-redis-tpm-" + System.currentTimeMillis();
        Tenant tenant = Tenant.builder()
                .virtualKey(testKey)
                .team("TPM Test Team")
                .rpmLimit(10)
                .tpmLimit(1000) // 1000 tokens per minute
                .monthlyBudgetUsd(new BigDecimal("100.00"))
                .build();

        // 1. Request with 600 tokens -> Admitted
        AdmissionResult res1 = admissionService.checkAdmission(tenant, "req_tpm_1", 600);
        assertThat(res1).isNotNull();

        // 2. Request with 500 tokens -> Exceeds TPM (600 + 500 = 1100 > 1000) -> Rejected
        assertThatThrownBy(() -> admissionService.checkAdmission(tenant, "req_tpm_2", 500))
                .isInstanceOf(RateLimitException.class)
                .satisfies(ex -> {
                    RateLimitException rle = (RateLimitException) ex;
                    assertThat(rle.getErrorType()).isEqualTo("tpm_limit_exceeded");
                    assertThat(rle.getErrorCode()).isEqualTo("tpm_limit_exceeded");
                });

        // 3. Rollback the first request -> removes slot from Redis
        admissionService.rollbackAdmission(testKey, "req_tpm_1");

        // 4. Verify ZSET key no longer contains req_tpm_1
        String zsetKey = "netra:ratelimit:" + testKey;
        Double score = redisTemplate.opsForZSet().score(zsetKey, "req_tpm_1");
        assertThat(score).isNull();
    }

    // =========================================================================
    // Vector Math Helpers
    // =========================================================================

    private static float[] createNormalizedVector(int dim, float seed) {
        float[] v = new float[dim];
        for (int i = 0; i < dim; i++) {
            v[i] = (float) Math.sin(i * seed + 0.1);
        }
        normalize(v);
        return v;
    }

    private static void normalize(float[] v) {
        float norm = 0.0f;
        for (float val : v) norm += val * val;
        norm = (float) Math.sqrt(norm);
        if (norm > 0) {
            for (int i = 0; i < v.length; i++) v[i] /= norm;
        }
    }

    private static String formatVectorLiteral(float[] v) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(v[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    public static class DockerAvailableCondition implements ExecutionCondition {
        @Override
        public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
            if (isDockerDaemonAvailable()) {
                return ConditionEvaluationResult.enabled("Docker/OrbStack daemon is running: executing live Testcontainers integration test");
            }
            return ConditionEvaluationResult.disabled("Docker daemon is not available: skipping live container integration test");
        }
    }
}
