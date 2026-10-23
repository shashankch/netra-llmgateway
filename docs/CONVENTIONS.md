# Engineering Conventions & Standards

This document defines the architectural invariants, API standards, and coding conventions enforced across NETRA.

---

## 1. Subsystems & Architectural Boundaries

NETRA maintains strict decoupling across core pipeline stages:

- **Ingress & Security (`auth` / `admission`)**: Virtual key resolution, prefix matching, allowlist validation, and atomic Redis rate limiting.
- **Data Plane (`dispatch` / `relay`)**: Non-blocking request dispatch, unbuffered Server-Sent Events (SSE) streaming relay over Java 25 Virtual Threads.
- **Intelligence (`router` / `cache`)**: Sub-millisecond rule-based complexity routing, in-JVM ONNX embeddings, and pgvector HNSW similarity search.
- **Ledger & Telemetry (`cost` / `telemetry`)**: Micro-USD cost calculation, canonical response header injection, and asynchronous structured audit logging.

---

## 2. API & Error Contract Standards

- **OpenAI Compatibility**: Ingress endpoints (`/v1/chat/completions`, `/v1/models`) adhere strictly to the OpenAI REST specification.
- **Canonical Error Envelope**: All non-2xx responses MUST return structured JSON:
  ```json
  {
    "error": {
      "message": "Human-readable error description",
      "type": "authentication_error | invalid_request_error | rate_limit_error | upstream_error",
      "code": "invalid_api_key | model_not_found | model_not_allowed | upstream_unavailable",
      "param": null
    }
  }
  ```
- **Telemetry Headers**: Successful chat completions inject canonical telemetry:
  - `x-netra-provider`: Upstream provider identifier (e.g. `alpha/alpha-small`).
  - `x-netra-cache`: Cache status (`hit` or `miss`).
  - `x-netra-fallback`: Failover indicator (`true` or `false`).
  - `x-netra-cost-usd`: Micro-USD cost scaled to 6 decimals (e.g. `0.000011`).

---

## 3. Financial Precision & Accounting Invariants

- **Base Currency**: Strictly USD stored in database ledgers (`monthly_spend`, `request_logs`, `model_pricing`).
- **Precision**: Java `BigDecimal` with 6 decimal places (`$0.000000`) and `RoundingMode.HALF_UP`. Primitive floating-point types (`double`, `float`) are forbidden in cost math.
- **Latency**: Monotonic integer milliseconds (`ms`).
- **Token Metrics**: Exact non-negative integer counts (`prompt_tokens`, `completion_tokens`, `total_tokens`).

---

## 4. Concurrency & Runtime Invariants (Java 25)

- **Virtual Threads**: Application logic runs on Virtual Threads. Never pin carrier threads using `synchronized` blocks over blocking I/O; use `ReentrantLock` or non-blocking primitives.
- **Immutability**: DTOs, request payloads, and telemetry events must be immutable Java Records.
- **Null Safety**: Methods returning collections must return empty collections (`List.of()`, `Set.of()`) rather than `null`. Use `Optional<T>` for potentially absent domain entities.

---

## 5. Git & Pull Request Standards

- **Branch Naming**: `feat/<scope>`, `fix/<scope>`, `refactor/<scope>`, `perf/<scope>`, `chore/<scope>`.
- **Conventional Commits**: Format commits as `<type>(<scope>): <subject>` (e.g., `feat(ingress): implement virtual key filter`).
- **Zero-Leak Invariant**: Automated pre-commit and CI gates enforce that no internal metadata or non-public terminology leaks into commit messages, PR titles, code comments, or documentation.
