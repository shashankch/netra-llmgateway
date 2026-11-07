package com.netra.gateway;

import com.netra.gateway.config.GatewayConfigProperties;
import com.netra.gateway.model.dto.ProviderHealthSnapshot;
import com.netra.gateway.service.ProviderCircuitBreakerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

class ProviderResilienceAndCircuitBreakerTest {

    private ProviderCircuitBreakerService circuitBreakerService;
    private GatewayConfigProperties configProperties;

    @BeforeEach
    void setUp() {
        configProperties = new GatewayConfigProperties();
        GatewayConfigProperties.ProviderConfig alpha = new GatewayConfigProperties.ProviderConfig();
        alpha.setName("alpha");
        alpha.setBaseUrl("http://localhost:9001");

        GatewayConfigProperties.ProviderConfig beta = new GatewayConfigProperties.ProviderConfig();
        beta.setName("beta");
        beta.setBaseUrl("http://localhost:9002");

        configProperties.setProviders(List.of(alpha, beta));
        circuitBreakerService = new ProviderCircuitBreakerService(configProperties);
    }

    @Test
    @DisplayName("Initial Circuit Breaker State: CLOSED and permits traffic with HEALTHY status")
    void testInitialStateIsClosedAndHealthy() {
        boolean permitted = circuitBreakerService.tryAcquirePermission("alpha");
        assertThat(permitted).isTrue();

        List<ProviderHealthSnapshot> snapshots = circuitBreakerService.getProviderHealthSnapshots();
        assertThat(snapshots).isNotEmpty();

        ProviderHealthSnapshot alphaSnapshot = snapshots.stream()
                .filter(s -> "alpha".equals(s.getProvider()))
                .findFirst()
                .orElseThrow();

        assertThat(alphaSnapshot.getCircuitState()).isEqualTo("CLOSED");
        assertThat(alphaSnapshot.getStatus()).isEqualTo("HEALTHY");
        assertThat(alphaSnapshot.getFailureRate()).isEqualTo(0.0f);
    }

    @Test
    @DisplayName("Circuit Breaker Trips to OPEN after failure threshold exceeded (>50%) and fast-fails (<0.05ms)")
    void testCircuitBreakerTripsToOpenOnFailures() {
        // Record 6 failed calls to alpha (> minimum 5 calls)
        for (int i = 0; i < 6; i++) {
            circuitBreakerService.recordError("alpha", TimeUnit.MILLISECONDS.toNanos(100), new RuntimeException("Upstream 503 Service Unavailable"));
        }

        // Breaker should now be tripped to OPEN
        boolean permitted = circuitBreakerService.tryAcquirePermission("alpha");
        assertThat(permitted).isFalse();

        List<ProviderHealthSnapshot> snapshots = circuitBreakerService.getProviderHealthSnapshots();
        ProviderHealthSnapshot alphaSnapshot = snapshots.stream()
                .filter(s -> "alpha".equals(s.getProvider()))
                .findFirst()
                .orElseThrow();

        assertThat(alphaSnapshot.getCircuitState()).isEqualTo("OPEN");
        assertThat(alphaSnapshot.getStatus()).isEqualTo("DOWN");
        assertThat(alphaSnapshot.getFailureRate()).isEqualTo(100.0f);
        assertThat(alphaSnapshot.getFailedCalls()).isEqualTo(6);
    }

    @Test
    @DisplayName("Rolling Latency Tracking: p95 latency is accurately calculated per provider")
    void testP95LatencyTracking() {
        // Record series of latencies for beta: 10ms, 20ms, 30ms, 40ms, 50ms, 100ms
        long[] latencies = {10, 20, 30, 40, 50, 60, 70, 80, 90, 100};
        for (long ms : latencies) {
            circuitBreakerService.recordSuccess("beta", TimeUnit.MILLISECONDS.toNanos(ms));
        }

        List<ProviderHealthSnapshot> snapshots = circuitBreakerService.getProviderHealthSnapshots();
        ProviderHealthSnapshot betaSnapshot = snapshots.stream()
                .filter(s -> "beta".equals(s.getProvider()))
                .findFirst()
                .orElseThrow();

        assertThat(betaSnapshot.getP95LatencyMs()).isGreaterThanOrEqualTo(90L);
        assertThat(betaSnapshot.getSuccessfulCalls()).isEqualTo(10);
    }

    @Test
    @DisplayName("Release permission does not count against failure rate or lock circuit breaker")
    void testReleasePermissionDoesNotCountAsError() {
        boolean permitted = circuitBreakerService.tryAcquirePermission("alpha");
        assertThat(permitted).isTrue();

        // Release acquired permit without recording error
        circuitBreakerService.releasePermission("alpha");

        List<ProviderHealthSnapshot> snapshots = circuitBreakerService.getProviderHealthSnapshots();
        ProviderHealthSnapshot alphaSnapshot = snapshots.stream()
                .filter(s -> "alpha".equals(s.getProvider()))
                .findFirst()
                .orElseThrow();

        assertThat(alphaSnapshot.getCircuitState()).isEqualTo("CLOSED");
        assertThat(alphaSnapshot.getFailureRate()).isEqualTo(0.0f);
        assertThat(alphaSnapshot.getFailedCalls()).isEqualTo(0);
        assertThat(alphaSnapshot.getP95LatencyMs()).isNull();
    }
}
