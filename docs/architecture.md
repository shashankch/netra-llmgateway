# System Architecture & Ingress Pipeline

The NETRA LLM Gateway operates as a non-blocking, tenant-isolated reverse proxy deployed in the critical path between application clients and foundation model providers.

---

## 1. High-Level System Architecture

The following diagram illustrates the complete end-to-end request lifecycle through NETRA's data plane, intelligence plane, and backing storage tiers:

![NETRA System Architecture](diagrams/01_system_architecture_light.svg#only-light)
![NETRA System Architecture](diagrams/01_system_architecture_dark.svg#only-dark)

---

## 2. Ingress Pipeline & Execution Stages

Every incoming HTTP request to `POST /v1/chat/completions` traverses five decoupled architectural stages:

![Ingress Execution Pipeline Stages](diagrams/02_ingress_pipeline_light.svg#only-light)
![Ingress Execution Pipeline Stages](diagrams/02_ingress_pipeline_dark.svg#only-dark)

### Stage 1: Virtual Key Authentication & L1 Ingress Cache

- Evaluates the incoming HTTP `Authorization: Bearer netra-sk-*` header.
- Validates the key against an in-memory Caffeine L1 cache (<50μs) to eliminate database read IOPS on the fast path.
- Checks tenant status (`ACTIVE`, `SUSPENDED`, `REVOKED`) and enforces the tenant's model allowlist.
- Rejects unauthenticated or unauthorized requests immediately with HTTP 401 (`invalid_api_key`) or HTTP 403 (`model_not_allowed`).

### Stage 2: Atomic Rate Limiting & Budget Admission Control

- Dispatches a single-command Redis 8.0 Lua script (`admission.lua`).
- Evaluates sliding-window Sorted Set (ZSET) RPM counters and monthly budget spend atomically.
- Guarantees **0.00% over-admission** under high-concurrency burst traffic.
- If limits are exceeded, returns HTTP 429 (`rate_limit_exceeded`) or HTTP 402 (`budget_exceeded`).
- If an upstream network failure occurs later in the request lifecycle, the admitted slot is automatically rolled back via `ZREM`.

### Stage 3: Tenant-Isolated Semantic Vector Cache

- Generates a 384-dimensional dense vector embedding in ~5ms using an in-process ONNX transformer (`all-MiniLM-L6-v2`).
- Queries PostgreSQL 18 `pgvector` using the cosine distance operator `<=>` accelerated by HNSW indexing (`m=16, ef_construction=64`).
- Strictly partitions queries at the SQL level (`WHERE virtual_key = :key AND model_alias = :alias`), ensuring complete cryptographic tenant isolation.
- If a match exceeds the tenant similarity threshold (e.g., 0.92):

    * Returns the cached response in **sub-5ms** with `$0.000000` upstream token cost.
    * Replays streaming completions progressively as Server-Sent Events (SSE) ending with `data: [DONE]`.

### Stage 4: Intelligent Model Routing & Upstream Failover

- Resolves model aliases (`fast`, `smart`, `auto`) or direct model identifiers.
- For `model: "auto"`:

    * Invokes the two-stage syntactic difficulty classifier (`PromptDifficultyClassifier`).
    * Decouples task instructions from data payloads and scores grammatical complexity signals in <0.2ms.
    * Steers simple queries to `fast` models and complex reasoning tasks to `smart` models, achieving ~72.4% cost savings.

- Dispatches requests across ordered fallback chains (e.g., primary `alpha-small` &rarr; fallback `beta-small`).
- Absorbs transient HTTP 5xx errors and timeouts with bounded exponential backoff retries (3 attempts).

![Prompt Routing & Cost Arbitrage Flow](diagrams/04_routing_arbitrage_light.svg#only-light)
![Prompt Routing & Cost Arbitrage Flow](diagrams/04_routing_arbitrage_dark.svg#only-dark)

### Stage 5: Unbuffered Streaming Relay & Financial Ledger

- Streams token deltas to clients over Java 25 Virtual Threads using unbuffered Server-Sent Events (~20ms Time-to-First-Token).
- Detects client disconnections (`Broken pipe`) immediately and halts upstream compute to eliminate phantom spend.
- On stream completion, captures token counts and computes exact micro-USD costs using 6-decimal `BigDecimal` precision.
- Writes structured audit records to PostgreSQL asynchronously via a concurrency-throttled worker.
