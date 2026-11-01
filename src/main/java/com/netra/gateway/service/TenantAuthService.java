package com.netra.gateway.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.netra.gateway.exception.AuthenticationException;
import com.netra.gateway.exception.ModelNotAllowedException;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TenantAuthService {

    private final TenantRepository tenantRepository;

    // L1 in-memory near-cache for tenant authorization (AUD-02)
    private final Cache<String, Optional<Tenant>> tenantCache = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofSeconds(60))
            .build();

    /**
     * Authenticates virtual key from HTTP Authorization header using L1 near-cache.
     */
    public Tenant authenticate(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AuthenticationException("Missing or invalid Authorization header");
        }

        String virtualKey = authHeader.substring(7).trim();
        if (virtualKey.isEmpty()) {
            throw new AuthenticationException("Virtual API key cannot be empty");
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
        if (tenant.getModelAllowlist() == null || (!tenant.getModelAllowlist().contains("*") && !tenant.getModelAllowlist().contains(modelOrAlias))) {
            log.warn("Key [{}] attempted unauthorized model [{}]", tenant.getVirtualKey(), modelOrAlias);
            throw new ModelNotAllowedException(modelOrAlias);
        }
    }

    /**
     * Invalidate cached tenant record.
     */
    public void invalidate(String virtualKey) {
        tenantCache.invalidate(virtualKey);
    }

    /**
     * Invalidate entire tenant near-cache.
     */
    public void invalidateAll() {
        tenantCache.invalidateAll();
    }
}
