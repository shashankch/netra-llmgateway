package com.netra.gateway;

import com.netra.gateway.exception.AuthenticationException;
import com.netra.gateway.exception.ModelNotAllowedException;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.TenantRepository;
import com.netra.gateway.service.TenantAuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantAuthServiceTest {

    @Mock
    private TenantRepository tenantRepository;

    @InjectMocks
    private TenantAuthService authService;

    @Test
    @DisplayName("Throws AuthenticationException when Authorization header is missing or invalid")
    void testMissingAuthHeader() {
        assertThatThrownBy(() -> authService.authenticate(null))
                .isInstanceOf(AuthenticationException.class)
                .hasMessageContaining("Missing or invalid Authorization header");

        assertThatThrownBy(() -> authService.authenticate("Basic 12345"))
                .isInstanceOf(AuthenticationException.class);

        assertThatThrownBy(() -> authService.authenticate("Bearer "))
                .isInstanceOf(AuthenticationException.class);
    }

    @Test
    @DisplayName("Authenticates valid netra-sk-* key")
    void testValidNetraKey() {
        Tenant tenant = Tenant.builder()
                .virtualKey("netra-sk-search-1a2b3c")
                .team("search")
                .isActive(true)
                .modelAllowlist(List.of("fast"))
                .build();

        when(tenantRepository.findByVirtualKey("netra-sk-search-1a2b3c")).thenReturn(Optional.of(tenant));

        Tenant result = authService.authenticate("Bearer netra-sk-search-1a2b3c");
        assertThat(result).isNotNull();
        assertThat(result.getTeam()).isEqualTo("search");
    }

    @Test
    @DisplayName("Throws ModelNotAllowedException when model is not on key allowlist")
    void testDisallowedModel() {
        Tenant tenant = Tenant.builder()
                .virtualKey("netra-sk-search-1a2b3c")
                .team("search")
                .modelAllowlist(List.of("fast"))
                .build();

        assertThatThrownBy(() -> authService.validateModelAllowed(tenant, "smart"))
                .isInstanceOf(ModelNotAllowedException.class)
                .hasMessageContaining("Model 'smart' is not permitted for this virtual key");
    }
}
