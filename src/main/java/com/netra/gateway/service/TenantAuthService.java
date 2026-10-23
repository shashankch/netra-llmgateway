package com.netra.gateway.service;

import com.netra.gateway.exception.AuthenticationException;
import com.netra.gateway.exception.ModelNotAllowedException;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class TenantAuthService {

    private final TenantRepository tenantRepository;

    /**
     * Authenticates virtual key from HTTP Authorization header.
     */
    public Tenant authenticate(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AuthenticationException("Missing or invalid Authorization header");
        }

        String virtualKey = authHeader.substring(7).trim();
        if (virtualKey.isEmpty()) {
            throw new AuthenticationException("Virtual API key cannot be empty");
        }

        Tenant tenant = tenantRepository.findByVirtualKey(virtualKey)
                .orElseThrow(() -> new AuthenticationException("Invalid or missing virtual API key"));

        if (!tenant.isActive()) {
            throw new AuthenticationException("Virtual API key is deactivated");
        }

        return tenant;
    }

    /**
     * Validates if the requested model or alias is present on the tenant's model allowlist.
     */
    public void validateModelAllowed(Tenant tenant, String modelOrAlias) {
        if (tenant.getModelAllowlist() == null || !tenant.getModelAllowlist().contains(modelOrAlias)) {
            log.warn("Key [{}] attempted unauthorized model [{}]", tenant.getVirtualKey(), modelOrAlias);
            throw new ModelNotAllowedException(modelOrAlias);
        }
    }
}
