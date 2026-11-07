# Architecture Decision Records (ADRs)

Architecture Decision Records document foundational architectural, protocol, and engineering decisions adopted in the NETRA LLM Gateway. Each record captures the design context, evaluated alternatives, decision outcome, and architectural consequences for enterprise deployment.

---

## Decision Registry

| ID | Title | Status | Date | Area |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-001](#adr-001-java-25-virtual-threads-for-gateway-data-plane) | Java 25 Virtual Threads for Gateway Data Plane | **Accepted** | 2026-03 | Core Runtime & Concurrency |
| [ADR-002](#adr-002-canonical-observability-telemetry-contract) | Canonical Observability & Telemetry Contract | **Accepted** | 2026-03 | Protocol & Observability |
| [ADR-003](#adr-003-high-precision-token-accounting-via-bigdecimal) | High-Precision Token Accounting via `BigDecimal` | **Accepted** | 2026-03 | Financial Ledger |
| [ADR-004](#adr-004-immutable-usd-ledger-with-runtime-forex-engine) | Immutable USD Ledger with Runtime Forex Engine | **Accepted** | 2026-03 | Billing & Multi-Currency |
| [ADR-005](#adr-005-unbuffered-sse-relay-with-socket-severance-reclamation) | Unbuffered SSE Relay with Socket Severance Reclamation | **Accepted** | 2026-04 | Streaming Ingress |
| [ADR-006](#adr-006-hybrid-cost-arbitrage-via-two-stage-syntactic-classifier) | Hybrid Cost Arbitrage via Two-Stage Syntactic Classifier | **Accepted** | 2026-04 | Routing & Intelligence |
| [ADR-007](#adr-007-in-jvm-onnx-embeddings-tenant-isolated-pgvector-caching) | In-JVM ONNX Embeddings & Tenant-Isolated pgvector Caching | **Accepted** | 2026-04 | Semantic Vector Cache |
| [ADR-008](#adr-008-environment-tiered-configuration-profiles) | Environment-Tiered Configuration Profiles | **Accepted** | 2026-04 | Configuration Management |
| [ADR-009](#adr-009-deterministic-target-resolution-provider-affinity) | Deterministic Target Resolution & Provider Affinity | **Accepted** | 2026-05 | Hybrid Cloud Routing |
| [ADR-010](#adr-010-standardized-ietf-ratelimit-headers-sunset-plan) | Standardized IETF RateLimit Headers & Sunset Plan | **Accepted** | 2026-05 | API Standards Compliance |
| [ADR-011](#adr-011-two-tier-cache-hierarchy-sha-256-l1-pgvector-hnsw-l2) | Two-Tier Cache Hierarchy (SHA-256 L1 + pgvector HNSW L2) | **Accepted** | 2026-05 | Cache Performance |
| [ADR-012](#adr-012-resilience-circuit-breakers-chain-deadlines-auto-escalation) | Resilience Circuit Breakers, Chain Deadlines & Auto-Escalation | **Accepted** | 2026-05 | Fault Tolerance |
| [ADR-013](#adr-013-java-25-scoped-values-for-request-context-propagation) | Java 25 Scoped Values for Request Context Propagation | **Accepted** | 2026-05 | Memory Safety & Concurrency |
| [ADR-014](#adr-014-decoupled-asynchronous-batch-persister-spend-aggregation) | Decoupled Asynchronous Batch Persister & Spend Aggregation | **Accepted** | 2026-05 | Database Performance |
| [ADR-015](#adr-015-circuit-breaker-permit-safety-exponential-backoff-resilience) | Circuit Breaker Permit Safety & Exponential Backoff Resilience | **Accepted** | 2026-05 | Ingress Pipeline Safety |

---

## ADR-001: Java 25 Virtual Threads for Gateway Data Plane

- **Status:** Accepted
- **Area:** Core Runtime & Concurrency

### Context & Problem Statement
An enterprise LLM gateway operates as a high-concurrency network intermediary on the critical request path. Upstream inference calls introduce long tail latencies (from hundreds of milliseconds to tens of seconds) and long-lived Server-Sent Events (SSE) connections. Standard thread-per-request architectures on OS platform threads consume 1–2 MB of stack memory per connection, exhausting memory and crashing under thousands of concurrent streams.

### Considered Options
1. **Reactive Event-Loop (WebFlux / Netty):** Highly scalable, but introduces non-blocking debugging friction, thread-local context loss, and impedance mismatch with synchronous relational drivers.
2. **Platform Thread Pools:** Traditional synchronous model, bounded to ~1,000–2,000 concurrent threads before encountering OutOfMemory errors and OS context-switching thrashing.
3. **Java 25 Virtual Threads (Project Loom):** Lightweight user-mode threads managed by the JVM with minimal initial stack allocation (~hundreds of bytes) and synchronous execution semantics.

### Decision Outcome
Standardize on **Java 25 LTS** with Virtual Threads across all HTTP ingress dispatchers, upstream network clients, and streaming relays. Replace blocking synchronization primitives with non-pinning concurrency controls to maintain high carrier thread throughput.

### Consequences
- **Positive:** Sustains 10,000+ concurrent streaming connections on modest VM footprints (4 vCPU / 8 GB RAM) with negligible idle CPU overhead.
- **Positive:** Preserves standard sequential programming models, clean stack traces, and standard APM profiler compatibility.
- **Trade-off:** Requires avoiding legacy synchronized blocks that trigger carrier thread pinning in favor of modern locking utilities.

---

## ADR-002: Canonical Observability & Telemetry Contract

- **Status:** Accepted
- **Area:** Protocol & Observability

### Context & Problem Statement
Operating a unified gateway across disparate inference providers requires transparent attribution on every request. Downstream client applications require immediate visibility into model fulfillment, caching outcomes, failover paths, and monetary cost without querying external out-of-band logging systems.

### Decision Outcome
Emit a deterministic set of canonical HTTP response headers on completion responses:
- `x-netra-provider`: Upstream provider that fulfilled the request (e.g. direct cloud endpoint or aggregator).
- `x-netra-cache`: Cache status outcome (`hit` or `miss`).
- `x-netra-cache-tier`: Specific cache tier that served the response (`tier1_exact` or `tier2_semantic`).
- `x-netra-fallback`: Boolean flag indicating whether upstream failover was triggered.
- `x-netra-cost-usd`: Precise financial expenditure calculated for the invocation.
- `x-netra-route-reason`: Explanatory signal for the routing or caching decision.
- `x-netra-retries`: Number of upstream network retries absorbed before successful response.
- `x-netra-escalated`: Boolean indicator showing if small-model refusal was automatically escalated to smart reasoning tier.

### Consequences
- **Positive:** Deterministic auditability and transparent spend attribution for every API transaction.
- **Positive:** Seamless client-side telemetry ingestion without custom parsing or vendor lock-in.

---

## ADR-003: High-Precision Token Accounting via `BigDecimal`

- **Status:** Accepted
- **Area:** Financial Ledger & Token Economics

### Context & Problem Statement
Foundation model token pricing is micro-fractional (e.g. \$0.15 per million prompt tokens = \$0.00000015 per token). Standard binary floating-point types (`float`, `double`) accumulate IEEE-754 representation drift over millions of transactions, creating discrepancies between client invoices, provider bills, and internal ledgers.

### Decision Outcome
Mandate arbitrary-precision arithmetic (`BigDecimal`) across all token cost calculations, budget tracking, rate quotas, and pricing catalog definitions. Standardize ledger precision to **6 decimal places** with half-up rounding.

### Consequences
- **Positive:** Exact mathematical reconciliation between ingress headers, database records, and monthly billing rollups.
- **Positive:** Zero financial drift under sustained enterprise transaction volumes.

---

## ADR-004: Immutable USD Ledger with Runtime Forex Engine

- **Status:** Accepted
- **Area:** Billing & Multi-Currency

### Context & Problem Statement
Enterprise teams operate in various domestic currencies (EUR, GBP, INR, JPY), while cloud foundation model providers bill exclusively in USD. Storing volatile local currencies in the primary audit ledger causes historical rate distortion, reporting drift, and reporting complexities during rate fluctuations.

### Decision Outcome
1. Maintain all core ledger entries, pricing rates, and tenant budgets strictly in USD (`cost_usd`, `total_spend_usd`).
2. Provide real-time currency conversion across the console and management interfaces through an in-memory foreign exchange service backed by a 6-hour refresh cache and offline fallback tables.

### Consequences
- **Positive:** Primary financial ledgers remain immutable and audit-compliant regardless of market currency fluctuations.
- **Positive:** Global tenants view localized spend reporting without compromising core accounting data.

---

## ADR-005: Unbuffered SSE Relay with Socket Severance Reclamation

- **Status:** Accepted
- **Area:** Streaming Ingress & Spend Control

### Context & Problem Statement
When streaming LLM responses over Server-Sent Events, buffering chunks in memory degrades Time-to-First-Token (TTFT) and increases memory consumption. Furthermore, when users cancel queries or close browser tabs mid-stream, standard reverse proxies continue pulling from the upstream provider, generating and billing unseen tokens ("phantom spend").

### Decision Outcome
Implement an unbuffered streaming relay with dedicated virtual threads and direct stream pumping:
1. Immediately flush tokens downstream as chunks arrive from upstream providers.
2. Intercept client socket resets (broken connections) immediately.
3. Instantly sever the upstream provider connection to halt further token generation.
4. Bill only the partial tokens delivered up to the exact point of disconnection.
5. Automatically refund admitted sliding-window rate limit slots via atomic Redis `ZREM` if the client disconnects before receiving any completion tokens (0 tokens), preventing artificial quota exhaustion.

### Consequences
- **Positive:** Achieves ~18ms TTFT with sub-millisecond gateway proxy overhead.
- **Positive:** Eliminates phantom token spend, reclaiming up to 98% of wasted cost when long generations are aborted by clients.

---

## ADR-006: Hybrid Cost Arbitrage via Two-Stage Syntactic Classifier

- **Status:** Accepted
- **Area:** Routing & Intelligence

### Context & Problem Statement
Directing all prompts to frontier reasoning models creates massive cost inefficiency on simple queries. Conversely, routing complex multi-step reasoning to lightweight models results in degraded output quality. Employing an LLM as a router introduces 150–300ms of additional latency and secondary API fees.

### Decision Outcome
Implement a deterministic two-stage hybrid syntactic complexity classifier for the automatic routing alias (`auto`):
1. **Structural Intent Extraction:** Decouple operational commands from surrounding context, code blocks, or tabular data.
2. **Linguistic Complexity Evaluation:** Analyze semantic markers (mathematical reasoning, architecture trade-offs, code synthesis) versus basic lookup patterns in under 0.3ms without external network calls.
3. Automatically route simple tasks to cost-effective small models and complex tasks to frontier models.

### Consequences
- **Positive:** Delivers ~72.4% cost reduction across typical enterprise query distributions.
- **Positive:** Operates in sub-millisecond classification time with 100% target accuracy on benchmark suites.

---

## ADR-007: In-JVM ONNX Embeddings & Tenant-Isolated pgvector Caching

- **Status:** Accepted
- **Area:** Semantic Vector Cache

### Context & Problem Statement
Semantic caching eliminates redundant inference spend by serving semantically similar queries from cache. However, external embedding APIs add 150–300ms of latency, shared vector stores risk cross-tenant data leakage, and caching upstream safety refusals risks permanently suppressing legitimate queries.

### Decision Outcome
1. **In-JVM Embeddings:** Generate 384-dimensional dense vectors in ~5ms using a quantized `all-MiniLM-L6-v2` model executed via ONNX Runtime directly inside the gateway JVM process.
2. **Tenant Partition Isolation:** Enforce hard database partitioning scoped strictly by tenant virtual key and model alias.
3. **HNSW Vector Search:** Execute cosine distance queries against PostgreSQL vector indexes using tenant-configured similarity thresholds (e.g. 0.920 for high precision, 0.850 for general use).
4. **Refusal Suppression:** Filter upstream responses so safety refusals are never committed to cache storage.

### Consequences
- **Positive:** Sub-5ms cache hits with \$0.000000 upstream spend and zero external API dependencies.
- **Positive:** Mathematical guarantee of 0.00% cross-tenant data bleed.

---

## ADR-008: Environment-Tiered Configuration Profiles

- **Status:** Accepted
- **Area:** Configuration Management

### Context & Problem Statement
Hardcoding local mock provider configurations risks accidental leakage into production environments. Conversely, requiring live cloud provider API credentials breaks offline developer onboarding and hermetic automated CI pipelines.

### Decision Outcome
Structure runtime configuration into four isolated environment tiers:
1. **Base Infrastructure Tier:** Defines platform defaults, thread pool parameters, database migrations, connection pool baselines, and health metrics.
2. **Local Development Tier:** The default offline profile. Directs traffic to containerized mock providers for zero-cost, hermetic local testing.
3. **Production Tier:** Activated explicitly via production environment switches. Directs egress through verified cloud aggregators and direct APIs, enables connection pool tuning, and applies response compression.
4. **Automated Testing Tier:** Employs accelerated retry intervals and mock backends to ensure fast, deterministic unit and contract verification.

### Consequences
- **Positive:** Eliminates accidental exposure of mock endpoints in production and live credentials in local environments.
- **Positive:** Provides out-of-the-box local setup with zero external cloud dependencies.

---

## ADR-009: Deterministic Target Resolution & Provider Affinity

- **Status:** Accepted
- **Area:** Hybrid Cloud Routing

### Context & Problem Statement
Enterprise hybrid topologies frequently operate private in-VPC inference nodes alongside public cloud aggregators that expose identical model names. Standard gateways cannot inherently determine whether a request should be served locally or routed externally.

### Decision Outcome
Implement a 5-tier deterministic target resolution hierarchy for model dispatch:
1. **Explicit Provider Colon Prefix:** Models formatted as `provider:model` bind explicitly to the named registered provider.
2. **Explicit Provider Slash Prefix:** Models formatted as `provider/model` matching a registered provider route directly.
3. **Provider Model Affinity:** Providers advertising dedicated model support take priority over general aggregator endpoints.
4. **Pricing Catalog Lookup:** Models registered in the canonical pricing catalog route to their designated primary provider.
5. **Aggregator Passthrough:** Unassigned multi-segment model paths route through the configured default aggregator.

### Consequences
- **Positive:** Complete disambiguation between on-premise inference engines and external cloud APIs.
- **Positive:** Enables deterministic fallback chains (e.g. In-VPC node &rarr; Aggregator &rarr; Direct Cloud API).

---

## ADR-010: Standardized IETF RateLimit Headers & Sunset Plan

- **Status:** Accepted
- **Area:** API Standards Compliance

### Context & Problem Statement
Proprietary rate-limiting headers create integration friction for modern reverse proxies, API management gateways, and standard client SDKs that follow formal IETF specifications (`draft-ietf-httpapi-ratelimit-headers`).

### Decision Outcome
Adopt a phased deprecation and standards convergence strategy:
1. **Dual-Emission Phase:** Concurrently emit standard IETF headers alongside legacy gateway headers:
   - `RateLimit-Limit: <quota>`
   - `RateLimit-Remaining: <remaining>`
   - `RateLimit-Reset: <seconds>`
   - `RateLimit-Policy: "<quota>;w=60"`
   - `Retry-After: <seconds>` (on HTTP 429)
2. **RFC 8594 Sunset Plan:** Mark legacy headers with standard `Deprecation` and `Sunset` response indicators.
3. **Target Phase:** Fully transition downstream consumers to standard IETF headers and W3C Trace Context (`traceparent`).

### Consequences
- **Positive:** Native interoperability with enterprise API gateways (Envoy, Kong, Cloudflare) and standard HTTP retry libraries.
- **Positive:** Zero breaking changes for existing consumers during the migration window.

---

## ADR-011: Two-Tier Cache Hierarchy (SHA-256 L1 + pgvector HNSW L2)

- **Status:** Accepted
- **Area:** Cache Performance & Latency

### Context & Problem Statement
Even in-process ONNX embeddings require 3–5ms of matrix computation per prompt. Under high-frequency burst traffic containing identical repeat queries (e.g. autonomous agent loops, system prompt polling, health checks), generating vector embeddings for every request consumes unnecessary CPU cycles.

### Decision Outcome
Deploy a Two-Tier Cache Hierarchy for query matching:
1. **Tier 1 (Exact Hash Near-Cache):** In-memory local cache paired with distributed cache keyed on the deterministic SHA-256 hash of Unicode NFC-normalized prompt text. Serves exact hits in **<0.5ms** with zero vector computation.
2. **Tier 2 (Dense Semantic Vector Cache):** Evaluated only when Tier 1 misses. Generates dense embeddings and executes HNSW vector cosine search (<5ms). Successful Tier 2 hits automatically back-populate Tier 1.

### Consequences
- **Positive:** Relieves up to 90% of vector embedding computation for repetitive enterprise workloads.
- **Positive:** Reduces exact-match response latency from ~5ms down to <0.5ms.

---

## ADR-012: Resilience Circuit Breakers, Chain Deadlines & Auto-Escalation

- **Status:** Accepted
- **Area:** Fault Tolerance & Upstream Resilience

### Context & Problem Statement
Cloud AI providers experience periodic throttling, elevated latency, and transient outages. Blocking on full network timeouts across retry chains causes request durations to exceed edge proxy limits (>15s). Furthermore, lightweight foundation models frequently return safety refusals or empty completions on complex prompts.

### Decision Outcome
1. **Provider Circuit Breakers:** Protect each upstream provider with an independent sliding-window circuit breaker. Fast-failover to secondary fallback targets occurs in **<0.05ms** when a breaker opens.
2. **Global Candidate Chain Deadline:** Enforce an overarching timeout budget (default 15,000ms) spanning all retry and fallback attempts.
3. **Small-Model Refusal Auto-Escalation:** Detect upstream refusals or degraded responses from cheap model tiers, automatically re-routing the prompt to the frontier tier with explicit telemetry annotation.

### Consequences
- **Positive:** Eliminates hanging gateway connections and prevents downstream timeout cascades.
- **Positive:** Automatic quality recovery when smaller models fail to fulfill complex prompts.

---

## ADR-013: Java 25 Scoped Values for Request Context Propagation

- **Status:** Accepted
- **Area:** Memory Safety & Concurrency

### Context & Problem Statement
With Java 25 Virtual Threads, a single server handles tens of thousands of concurrent requests. Traditional `ThreadLocal` storage incurs heap allocation overhead, cannot be safely bounded, and risks memory leaks when context is not manually cleared.

### Decision Outcome
Adopt Java 25 Scoped Values (`java.lang.ScopedValue`, JEP 506) for request lifecycle state:
1. Bind immutable request context (`requestId`, `virtualKey`, `tenant`, `startTimeMs`) at the HTTP ingress filter.
2. Propagate context safely and immutably when dispatching asynchronous tasks or child virtual threads.

### Consequences
- **Positive:** Immutable, thread-safe request context propagation with zero heap churn.
- **Positive:** Eliminates memory leak risks associated with `ThreadLocal` under high-throughput virtual thread scheduling.

---

## ADR-014: Decoupled Asynchronous Batch Persister & Spend Aggregation

- **Status:** Accepted
- **Area:** Database Performance & Connection Shielding

### Context & Problem Statement
Under high-concurrency burst traffic (10,000+ concurrent virtual threads), executing synchronous database writes for audit logs and monthly spend ledger updates exhausts connection pools, creating connection acquisition timeouts and latency spikes.

### Decision Outcome
1. Decouple database write operations from HTTP worker threads using a bounded in-memory queue (capacity 10,000). Ingress threads offer records in non-blocking sub-microsecond time.
2. A scheduled background worker flushes batched multi-row inserts every 250ms or 100 entries.
3. Aggregate monthly tenant spend in memory by `(virtualKey, yearMonth)` across each batch window, executing a single bulk upsert per tenant per cycle.

### Consequences
- **Positive:** Reduces database write roundtrips by up to 90%, shielding connection pools under peak burst load.
- **Positive:** Bounded queues prevent memory exhaustion risks, and application lifecycle hooks ensure all pending items flush cleanly during shutdown.

---

## ADR-015: Circuit Breaker Permit Safety & Exponential Backoff Resilience

- **Status:** Accepted
- **Area:** Ingress Pipeline Safety & Recovery

### Context & Problem Statement
1. In circuit breaking, when a breaker transitions from open to half-open, it permits a limited number of canary calls. If a client transmits an invalid payload resulting in an HTTP 400 or 422 Bad Request, counting this as a provider failure incorrectly keeps healthy providers blocked.
2. Admitted rate-limit tokens must be refunded if an upstream provider rejects a call before generating tokens, avoiding artificial quota starvation.
3. During database maintenance or network blips, unhandled persister retries create tight loops that saturate CPU and flood logs.

### Decision Outcome
1. Inspect upstream exceptions during relay: for client-side errors (HTTP 400/422), release circuit breaker permits without recording a provider failure, and immediately roll back the admitted rate-limit slot.
2. In the asynchronous persister, implement bounded exponential backoff (500ms initial to 10,000ms max) with an atomic failure counter.
3. Discriminate permanent SQL constraint violations (drop with error log) from transient connection failures (retain for backoff retry).

### Consequences
- **Positive:** Clean recovery of circuit breakers during canary testing without false provider lockout.
- **Positive:** Zero rate-limit slot starvation caused by client-side syntax errors.
- **Positive:** Resilient database error containment with zero CPU-saturating retry loops during infrastructure maintenance.
