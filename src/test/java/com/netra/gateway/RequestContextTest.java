package com.netra.gateway;

import com.netra.gateway.context.RequestContext;
import com.netra.gateway.model.entity.Tenant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.ScopedValue;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class RequestContextTest {

    @Test
    @DisplayName("RequestContext should be empty when outside ScopedValue scope")
    void testUnboundRequestContext() {
        assertThat(RequestContext.current()).isEmpty();
        assertThat(RequestContext.get()).isNull();
        assertThat(RequestContext.isPresent()).isFalse();
        assertThat(RequestContext.currentRequestId()).isNull();
        assertThat(RequestContext.currentVirtualKey()).isEqualTo("unauthenticated");
    }

    @Test
    @DisplayName("RequestContext binds and propagates correctly within dynamic scope")
    void testBoundRequestContext() throws Exception {
        RequestContext context = new RequestContext(
                "req_test_123",
                "netra-sk-search-1a2b3c",
                null,
                "fast",
                "fast",
                null,
                System.currentTimeMillis(),
                false
        );

        String capturedId = context.call(() -> {
            assertThat(RequestContext.isPresent()).isTrue();
            assertThat(RequestContext.currentRequestId()).isEqualTo("req_test_123");
            assertThat(RequestContext.currentVirtualKey()).isEqualTo("netra-sk-search-1a2b3c");
            return RequestContext.currentRequestId();
        });

        assertThat(capturedId).isEqualTo("req_test_123");
        // Outside scope, should revert to unbound
        assertThat(RequestContext.current()).isEmpty();
    }

    @Test
    @DisplayName("Nested ScopedValue binding correctly overrides context and unwinds cleanly")
    void testNestedScopeInheritance() throws Exception {
        RequestContext initial = new RequestContext(
                "req_parent_456",
                "unauthenticated",
                null,
                "auto",
                "auto",
                null,
                System.currentTimeMillis(),
                false
        );

        initial.run(() -> {
            assertThat(RequestContext.currentRequestId()).isEqualTo("req_parent_456");
            assertThat(RequestContext.currentVirtualKey()).isEqualTo("unauthenticated");

            Tenant tenant = Tenant.builder()
                    .virtualKey("netra-sk-research-4d5e6f")
                    .build();

            RequestContext nested = RequestContext.get().withTenant(tenant)
                    .withResolved("alpha-large", "alpha");

            ScopedValue.where(RequestContext.CURRENT, nested).run(() -> {
                assertThat(RequestContext.currentRequestId()).isEqualTo("req_parent_456");
                assertThat(RequestContext.currentVirtualKey()).isEqualTo("netra-sk-research-4d5e6f");
                assertThat(RequestContext.get().selectedModel()).isEqualTo("alpha-large");
                assertThat(RequestContext.get().resolvedProvider()).isEqualTo("alpha");
            });

            // Reverted to outer scope
            assertThat(RequestContext.currentRequestId()).isEqualTo("req_parent_456");
            assertThat(RequestContext.currentVirtualKey()).isEqualTo("unauthenticated");
            assertThat(RequestContext.get().selectedModel()).isEqualTo("auto");
        });

        assertThat(RequestContext.current()).isEmpty();
    }

    @Test
    @DisplayName("RequestContext propagates across virtual thread execution when wrapped")
    void testVirtualThreadScopePropagation() throws Exception {
        RequestContext context = new RequestContext(
                "req_vt_789",
                "netra-sk-search-1a2b3c",
                null,
                "fast",
                "alpha-small",
                "alpha",
                System.currentTimeMillis(),
                true
        );

        AtomicReference<String> result = new AtomicReference<>();

        context.run(() -> {
            // Virtual thread inheriting scope via context.wrap
            Thread vt = Thread.ofVirtual().name("vt-scope-test").start(context.wrap(() -> {
                RequestContext.current().ifPresent(ctx -> result.set(ctx.requestId()));
            }));
            try {
                vt.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        // Test that execution ran cleanly and captured context inside child virtual thread
        assertThat(result.get()).isEqualTo("req_vt_789");
    }
}
