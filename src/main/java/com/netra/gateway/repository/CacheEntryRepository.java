package com.netra.gateway.repository;

import com.netra.gateway.model.dto.CacheMatchProjection;
import com.netra.gateway.model.entity.CacheEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CacheEntryRepository extends JpaRepository<CacheEntry, UUID> {

    @Query(value = """
            SELECT c.id AS id,
                   c.virtual_key AS virtualKey,
                   c.model_alias AS modelAlias,
                   c.prompt_text AS promptText,
                   c.resolved_provider AS resolvedProvider,
                   c.response_json AS responseJson,
                   (1 - (c.embedding <=> cast(cast(:queryVector as text) as vector))) AS similarity
            FROM cache_entries c
            WHERE LOWER(c.virtual_key) = LOWER(:virtualKey)
              AND c.model_alias = :modelAlias
              AND (1 - (c.embedding <=> cast(cast(:queryVector as text) as vector))) >= :threshold
            ORDER BY c.embedding <=> cast(cast(:queryVector as text) as vector) ASC
            LIMIT 1
            """, nativeQuery = true)
    Optional<CacheMatchProjection> findNearestMatch(
            @Param("virtualKey") String virtualKey,
            @Param("modelAlias") String modelAlias,
            @Param("queryVector") String queryVector,
            @Param("threshold") double threshold
    );

    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO cache_entries (id, virtual_key, model_alias, prompt_text, resolved_provider, embedding, response_json, hit_count, created_at)
            VALUES (gen_random_uuid(), :virtualKey, :modelAlias, :promptText, :resolvedProvider, cast(cast(:embedding as text) as vector), cast(cast(:responseJson as text) as jsonb), 0, CURRENT_TIMESTAMP)
            """, nativeQuery = true)
    void saveWithEmbedding(
            @Param("virtualKey") String virtualKey,
            @Param("modelAlias") String modelAlias,
            @Param("promptText") String promptText,
            @Param("resolvedProvider") String resolvedProvider,
            @Param("embedding") String embedding,
            @Param("responseJson") String responseJson
    );

    @Modifying
    @Transactional
    @Query("UPDATE CacheEntry c SET c.hitCount = c.hitCount + 1, c.lastHitAt = CURRENT_TIMESTAMP WHERE c.id = :id")
    void recordHit(@Param("id") UUID id);

    @Query("SELECT COUNT(c) FROM CacheEntry c WHERE LOWER(c.virtualKey) = LOWER(:virtualKey)")
    long countByVirtualKey(@Param("virtualKey") String virtualKey);

    @Query("SELECT c FROM CacheEntry c WHERE (:virtualKey IS NULL OR LOWER(c.virtualKey) = LOWER(:virtualKey)) " +
           "AND (:search IS NULL OR LOWER(c.promptText) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(c.modelAlias) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "ORDER BY c.createdAt DESC")
    java.util.List<CacheEntry> findCacheEntries(
            @Param("virtualKey") String virtualKey,
            @Param("search") String search,
            org.springframework.data.domain.Pageable pageable
    );

    @Query("SELECT COUNT(c) FROM CacheEntry c WHERE (:virtualKey IS NULL OR LOWER(c.virtualKey) = LOWER(:virtualKey)) " +
           "AND (:search IS NULL OR LOWER(c.promptText) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(c.modelAlias) LIKE LOWER(CONCAT('%', :search, '%')))")
    long countCacheEntries(
            @Param("virtualKey") String virtualKey,
            @Param("search") String search
    );
}
