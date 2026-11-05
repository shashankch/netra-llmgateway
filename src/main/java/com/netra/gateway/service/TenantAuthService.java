package com.netra.gateway.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.netra.gateway.exception.AuthenticationException;
import com.netra.gateway.exception.ModelNotAllowedException;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.TenantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Slf4j
@Service
public class TenantAuthService {

    private final TenantRepository tenantRepository;
    private final StringRedisTemplate redisTemplate;

    // L1 in-memory near-cache for tenant authorization (High-Throughput Sub-Millisecond Auth)
    private final Cache<String, Optional<Tenant>> tenantCache = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofSeconds(60))
            .build();

    @Autowired
    public TenantAuthService(
            TenantRepository tenantRepository,
            @Autowired(required = false) StringRedisTemplate redisTemplate
    ) {
        this.tenantRepository = tenantRepository;
        this.redisTemplate = redisTemplate;
    }

    public TenantAuthService(TenantRepository tenantRepository) {
        this(tenantRepository, null);
    }

    /**
     * Authenticates virtual key from HTTP Authorization header using L1 near-cache
     * and distributed multi-node revocation state.
     */
    public Tenant authenticate(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AuthenticationException("Missing or invalid Authorization header");
        }

        String virtualKey = authHeader.substring(7).trim();
        if (virtualKey.isEmpty()) {
            throw new AuthenticationException("Virtual API key cannot be empty");
        }

        // Distributed revocation check: verify if key was revoked on any cluster node
        if (redisTemplate != null) {
            try {
                Boolean isRevoked = redisTemplate.opsForSet().isMember("netra:revoked_keys", virtualKey);
                if (Boolean.TRUE.equals(isRevoked)) {
                    tenantCache.invalidate(virtualKey);
                    throw new AuthenticationException("Virtual API key is deactivated");
                }
            } catch (AuthenticationException ae) {
                throw ae;
            } catch (Exception ex) {
                log.debug("Redis revocation check fallback: {}", ex.getMessage());
            }
        }

        Optional<Tenant> opt = tenantCache.get(virtualKey, tenantRepository::findByVirtualKey);
        if (opt == null || opt.isEmpty()) {
            throw new AuthenticationException("Invalid or missing virtual API key");
        }

        Tenant tenant = opt.get();
        if (!tenant.isActive()) {
            throw new AuthenticationException("Virtual API key is deactivated");
        }

        return tenant;
    }

    /**
     * Validates if the requested model or alias is present on the tenant's model allowlist.
     */
    public void validateModelAllowed(Tenant tenant, String modelOrAlias) {
        if (!isModelAllowed(tenant, modelOrAlias)) {
            log.warn("Key [{}] attempted unauthorized model [{}]", tenant.getVirtualKey(), modelOrAlias);
            throw new ModelNotAllowedException(modelOrAlias);
        }
    }

    /**
     * Non-throwing check if a model or alias is permitted for the given tenant.
     */
    public boolean isModelAllowed(Tenant tenant, String modelOrAlias) {
        if (tenant == null || tenant.getModelAllowlist() == null) {
            return false;
        }
        return tenant.getModelAllowlist().contains("*") || tenant.getModelAllowlist().contains(modelOrAlias);
    }

    /**
     * Revokes key across all gateway nodes via Redis Set and Pub/Sub invalidation.
     */
    public void revoke(String virtualKey) {
        invalidate(virtualKey);
        if (redisTemplate != null && virtualKey != null) {
            try {
                redisTemplate.opsForSet().add("netra:revoked_keys", virtualKey);
            } catch (Exception e) {
                log.warn("Failed to register revoked key in Redis: {}", e.getMessage());
            }
        }
    }

    /**
     * Restores active key across all gateway nodes.
     */
    public void unrevoke(String virtualKey) {
        invalidate(virtualKey);
        if (redisTemplate != null && virtualKey != null) {
            try {
                redisTemplate.opsForSet().remove("netra:revoked_keys", virtualKey);
            } catch (Exception e) {
                log.warn("Failed to unregister revoked key in Redis: {}", e.getMessage());
            }
        }
    }

    /**
     * Invalidate cached tenant record locally and across all cluster nodes.
     */
    public void invalidate(String virtualKey) {
        tenantCache.invalidate(virtualKey);
        if (redisTemplate != null && virtualKey != null) {
            try {
                redisTemplate.convertAndSend("netra:tenant:invalidation", virtualKey);
            } catch (Exception e) {
                log.debug("Redis tenant invalidation publish skipped: {}", e.getMessage());
            }
        }
    }

    /**
     * Node-local invalidation (invoked by Redis message subscriber).
     */
    public void invalidateLocal(String virtualKey) {
        tenantCache.invalidate(virtualKey);
    }

    /**
     * Invalidate entire tenant near-cache.
     */
    public void invalidateAll() {
        tenantCache.invalidateAll();
    }
}
