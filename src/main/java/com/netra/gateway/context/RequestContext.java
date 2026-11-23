package com.netra.gateway.context;

import com.netra.gateway.model.entity.Tenant;
import com.netra.gateway.telemetry.W3cTraceContext;

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
        boolean isStream,
        W3cTraceContext traceContext,
        int estimatedTokens,
        long admissionMinute,
        java.util.concurrent.atomic.AtomicBoolean admissionRolledBack
) {
    public RequestContext(
            String requestId,
            String virtualKey,
            Tenant tenant,
            String requestedModel,
            String selectedModel,
            String resolvedProvider,
            long startTimeMs,
            boolean isStream,
            W3cTraceContext traceContext,
            int estimatedTokens
    ) {
        this(requestId, virtualKey, tenant, requestedModel, selectedModel, resolvedProvider, startTimeMs, isStream, traceContext, estimatedTokens, 0L, new java.util.concurrent.atomic.AtomicBoolean(false));
    }

    public RequestContext(
            String requestId,
            String virtualKey,
            Tenant tenant,
            String requestedModel,
            String selectedModel,
            String resolvedProvider,
            long startTimeMs,
            boolean isStream,
            W3cTraceContext traceContext
    ) {
        this(requestId, virtualKey, tenant, requestedModel, selectedModel, resolvedProvider, startTimeMs, isStream, traceContext, 0, 0L, new java.util.concurrent.atomic.AtomicBoolean(false));
    }

    public RequestContext(
            String requestId,
            String virtualKey,
            Tenant tenant,
            String requestedModel,
            String selectedModel,
            String resolvedProvider,
            long startTimeMs,
            boolean isStream
    ) {
        this(requestId, virtualKey, tenant, requestedModel, selectedModel, resolvedProvider, startTimeMs, isStream, null, 0, 0L, new java.util.concurrent.atomic.AtomicBoolean(false));
    }
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
     * Returns the current W3C Trace Context if bound in scope.
     */
    public static W3cTraceContext currentTraceContext() {
        return current().map(RequestContext::traceContext).orElse(null);
    }

    /**
     * Returns the estimated prompt tokens reserved during admission, or 0 if unbound.
     */
    public static int currentEstimatedTokens() {
        return current().map(RequestContext::estimatedTokens).orElse(0);
    }

    /**
     * Returns the admission minute bucket timestamp (epoch ms / 60000), or 0 if unbound.
     */
    public static long currentAdmissionMinute() {
        return current().map(RequestContext::admissionMinute).orElse(0L);
    }

    /**
     * Returns true if admission has already been rolled back for this request lifecycle.
     */
    public static boolean isAdmissionRolledBack() {
        return current().map(c -> c.admissionRolledBack() != null && c.admissionRolledBack().get()).orElse(false);
    }

    /**
     * Atomically marks the admission reservation as rolled back.
     */
    public static void markAdmissionRolledBack() {
        current().ifPresent(c -> {
            if (c.admissionRolledBack() != null) {
                c.admissionRolledBack().set(true);
            }
        });
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
                isStream,
                traceContext,
                estimatedTokens,
                admissionMinute,
                admissionRolledBack != null ? admissionRolledBack : new java.util.concurrent.atomic.AtomicBoolean(false)
        );
    }

    /**
     * Creates a new RequestContext with reserved estimated prompt tokens and current admission minute bucket.
     */
    public RequestContext withEstimatedTokens(int estimatedTokens) {
        return withAdmission(estimatedTokens, System.currentTimeMillis() / 60000L);
    }

    /**
     * Creates a new RequestContext with reserved estimated prompt tokens and designated admission minute bucket.
     */
    public RequestContext withAdmission(int estimatedTokens, long admissionMinute) {
        return new RequestContext(
                requestId,
                virtualKey,
                tenant,
                requestedModel,
                selectedModel,
                resolvedProvider,
                startTimeMs,
                isStream,
                traceContext,
                estimatedTokens,
                admissionMinute,
                admissionRolledBack != null ? admissionRolledBack : new java.util.concurrent.atomic.AtomicBoolean(false)
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
                isStream,
                traceContext,
                estimatedTokens,
                admissionMinute,
                admissionRolledBack != null ? admissionRolledBack : new java.util.concurrent.atomic.AtomicBoolean(false)
        );
    }

    /**
     * Creates a new RequestContext bound to a W3C Trace Context.
     */
    public RequestContext withTraceContext(W3cTraceContext traceContext) {
        return new RequestContext(
                requestId,
                virtualKey,
                tenant,
                requestedModel,
                selectedModel,
                resolvedProvider,
                startTimeMs,
                isStream,
                traceContext,
                estimatedTokens,
                admissionMinute,
                admissionRolledBack != null ? admissionRolledBack : new java.util.concurrent.atomic.AtomicBoolean(false)
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
