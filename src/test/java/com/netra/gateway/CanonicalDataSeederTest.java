package com.netra.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.model.entity.ModelPricing;
import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.repository.ModelPricingRepository;
import com.netra.gateway.repository.TenantRepository;
import com.netra.gateway.service.CanonicalDataSeeder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.DefaultResourceLoader;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CanonicalDataSeederTest {

    @Mock
    private ModelPricingRepository pricingRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Test
    @DisplayName("CanonicalDataSeeder loads pricing and seed keys idempotently")
    void testSeederExecution() {
        GatewayConfigProperties config = new GatewayConfigProperties();
        config.setDataPath("data");
        ObjectMapper mapper = new ObjectMapper();
        DefaultResourceLoader resourceLoader = new DefaultResourceLoader();

        CanonicalDataSeeder seeder = new CanonicalDataSeeder(
                pricingRepository,
                tenantRepository,
                config,
                mapper,
                resourceLoader
        );

        seeder.seedModelPricing();
        ArgumentCaptor<ModelPricing> pricingCaptor = ArgumentCaptor.forClass(ModelPricing.class);
        verify(pricingRepository, atLeast(4)).save(pricingCaptor.capture());
        List<ModelPricing> savedPricing = pricingCaptor.getAllValues();

        assertThat(savedPricing).extracting(ModelPricing::getModel)
                .contains("alpha-small", "alpha-large", "beta-small", "beta-large");

        seeder.seedTenants();
        ArgumentCaptor<Tenant> tenantCaptor = ArgumentCaptor.forClass(Tenant.class);
        verify(tenantRepository, atLeast(4)).save(tenantCaptor.capture());
        List<Tenant> savedTenants = tenantCaptor.getAllValues();

        assertThat(savedTenants).extracting(Tenant::getVirtualKey)
                .contains(
                        "netra-sk-search-1a2b3c",
                        "netra-sk-research-4d5e6f",
                        "netra-sk-free-7g8h9i",
                        "netra-sk-budget-demo-0j1k2l"
                );

        Tenant searchTenant = savedTenants.stream()
                .filter(t -> "netra-sk-search-1a2b3c".equals(t.getVirtualKey()))
                .findFirst()
                .orElseThrow();
        assertThat(searchTenant.getTeam()).isEqualTo("search");
        assertThat(searchTenant.getMonthlyBudgetUsd()).isEqualByComparingTo(new BigDecimal("50"));
        assertThat(searchTenant.getRpmLimit()).isEqualTo(60);
        assertThat(searchTenant.getModelAllowlist()).containsExactly("fast");
    }
}
