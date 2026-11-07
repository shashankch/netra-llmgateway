package com.netra.gateway.context;

import com.netra.gateway.model.entity.Tenant;

import java.lang.ScopedValue;
import java.lang.ScopedValue.CallableOp;
import java.util.Optional;
import java.util.concurrent.Callable;

/**
 * Enterprise Request Context using Java 25 Scoped Values (JEP 506).
 * <p>
 * Replaces legacy {@link ThreadLocal} with immutable, zero-allocation, thread-safe
 * scoped bindings that safely propagate across virtual thread hierarchies and structured
 * concurrency forks without risk of memory leaks or thread pool pollution.
 */
public record RequestContext(
        String requestId,
        String virtualKey,
        Tenant tenant,
        String requestedModel,
        String selectedModel,
        String resolvedProvider,
        long startTimeMs,
        boolean isStream
) {
    /**
     * Canonical ScopedValue instance bound per ingress request lifecycle.
     */
    public static final ScopedValue<RequestContext> CURRENT = ScopedValue.newInstance();

    /**
     * Servlet request attribute name preserving request ID across ScopedValue unbind boundaries
     * (e.g. for Spring exception handlers).
     */
    public static final String REQUEST_ID_ATTR = "netra.requestId";

    /**
     * Retrieves the active RequestContext if bound in the current dynamic scope.
     */
    public static Optional<RequestContext> current() {
        return CURRENT.isBound() ? Optional.ofNullable(CURRENT.get()) : Optional.empty();
    }

    /**
     * Direct null-safe retrieval of the active RequestContext.
     */
    public static RequestContext get() {
        return CURRENT.isBound() ? CURRENT.get() : null;
    }

    /**
     * Returns true if a RequestContext is currently bound.
     */
    public static boolean isPresent() {
        return CURRENT.isBound() && CURRENT.get() != null;
    }

    /**
     * Returns the current request ID or null if unauthenticated / unbound.
     */
    public static String currentRequestId() {
        return current().map(RequestContext::requestId).orElse(null);
    }

    /**
     * Returns the current virtual key or "unauthenticated" if unbound.
     */
    public static String currentVirtualKey() {
        return current().map(RequestContext::virtualKey).orElse("unauthenticated");
    }

    /**
     * Creates a new RequestContext inheriting all properties with the authenticated tenant.
     */
    public RequestContext withTenant(Tenant tenant) {
        return new RequestContext(
                requestId,
                tenant != null ? tenant.getVirtualKey() : virtualKey,
                tenant,
                requestedModel,
                selectedModel,
                resolvedProvider,
                startTimeMs,
                isStream
        );
    }

    /**
     * Creates a new RequestContext with resolved provider and model routing decisions.
     */
    public RequestContext withResolved(String selectedModel, String resolvedProvider) {
        return new RequestContext(
                requestId,
                virtualKey,
                tenant,
                requestedModel,
                selectedModel,
                resolvedProvider,
                startTimeMs,
                isStream
        );
    }

    /**
     * Executes the given operation within the scope of this RequestContext.
     */
    public <T, X extends Throwable> T call(CallableOp<T, X> op) throws X {
        return ScopedValue.where(CURRENT, this).call(op);
    }

    /**
     * Overload supporting java.util.concurrent.Callable.
     */
    public <T> T callCallable(Callable<T> callable) throws Exception {
        return ScopedValue.where(CURRENT, this).call(callable::call);
    }

    /**
     * Executes the given runnable within the scope of this RequestContext.
     */
    public void run(Runnable runnable) {
        ScopedValue.where(CURRENT, this).run(runnable);
    }

    /**
     * Returns a Runnable that executes within the scope of this RequestContext.
     * Essential for propagating Scoped Values into child virtual threads.
     */
    public Runnable wrap(Runnable task) {
        return () -> ScopedValue.where(CURRENT, this).run(task);
    }

    /**
     * Returns a CallableOp that executes within the scope of this RequestContext.
     */
    public <T, X extends Throwable> CallableOp<T, X> wrap(CallableOp<T, X> op) {
        return () -> ScopedValue.where(CURRENT, this).call(op);
    }
}
