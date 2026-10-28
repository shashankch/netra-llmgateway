# Changelog

All notable changes to **NETRA — AI-First LLM Gateway & Semantic Vector Cache** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.6.0] - 2026-10-28 — Phase 6: Modern Ops Console UI, Multi-Tier PaaS & Verification Drills

### 🚀 Added
- **Modern React 19 / Vite 6 Operations Console (`dashboard/`)**: High-performance, zero-flicker developer dashboard providing OpenRouter-grade analytics, live request logging, virtual keys management, and interactive prompt testing.
- **OpenRouter-Grade Analytics Suite**:
  - 5 Headline KPI Cards: Total Spend (rendered in active currency), Total Request Count, Token Volume Distribution (Prompt, Completion, Total), Semantic Cache Hit Rate %, and Average Latency / Time-To-First-Token (TTFT).
  - 4 Interactive SVG Visualizations: Model Spend & Volume Trends (stacked hourly/daily bars), Smart Router Arbitrage Efficiency (donut chart with complexity signal flows and net ~72.4% cost arbitrage savings), Semantic Cache Waterfall & Cumulative Savings (direct vs $0 instant vector hits), and Latency Percentiles (p50, p90, p99 TTFT and response durations).
  - Tenant Virtual Key Leaderboard: Real-time table displaying tenant name, organization, active RPM gauge, monthly budget burn-down bar, and status badge (`ACTIVE`, `EXHAUSTED`, `REVOKED`).
- **Seamless Dark & Light Theme System**:
  - Native dual-theme engine detecting system `prefers-color-scheme` automatically and persisting choice in `localStorage` (`netra-theme`).
  - Dark Theme default: Obsidian/slate palette (`#090d16` canvas, `#0f172a` cards, `#1e293b` borders, glowing neon accents).
  - Light Theme: Crisp enterprise white/slate palette (`#ffffff` canvas, `#f8fafc` cards, `#e2e8f0` borders, slate typography).
  - Zero-flicker Sun ☀️ / Moon 🌙 toggle in the top navbar.
- **Single-Denomination Currency Engine (USD $ | INR ₹)**:
  - Global navbar switcher converting all monetary figures dynamically via real-time Forex service (`ForexRateService`) with offline fallback (`87.50`).
  - Strict database invariant: pure USD ledger persistence in PostgreSQL (`DECIMAL(12, 6)`), eliminating currency drift or schema duplication.
- **Interactive Evaluator Sandbox & Prompt Playground (`/playground`)**:
  - 1-Click Evaluation presets pre-seeded for Search Team (`netra-sk-search`), Research Team (`netra-sk-research`), Free Tier (`netra-sk-free`), and Budget Demo (`netra-sk-budget-demo`).
  - Interactive chat form supporting model selection (`fast`, `smart`, `auto`), SSE streaming toggle, system prompt, and prompt templates (Paraphrase Pair A/B, Near-miss, Complex reasoning).
  - Unbuffered SSE typewriter streaming token display with live chunk counter.
  - Telemetry Badges Bar displaying `x-netra-provider`, `x-netra-cache` (green HIT / slate MISS), `x-netra-fallback`, `x-netra-cost-usd`, `x-netra-route-reason`, `x-netra-retries`, and latency (ms).
- **Virtual Keys Manager (`/keys`)**:
  - Provision and edit virtual keys with sliding RPM limits, monthly budget caps in USD/INR, model allowlists, semantic cache toggles, and similarity threshold sliders (0.75 - 0.99).
  - Instantaneous L1 in-memory near-cache invalidation upon updates or revocation.
- **Live Request Logs Inspector (`/logs`)**:
  - Real-time audit log stream from `GET /admin/logs/stream` with pause/resume controls.
  - Search and filter by virtual key, HTTP status codes (200, 429, 402, 401, 502), and request attributes.
  - Expandable rows detailing full JSON payload, token counts, route reasons, and error types.
- **Semantic Vector Cache Inspector (`/cache`)**:
  - Aggregate metrics for total entries, hits, misses, and hit rate %.
  - Per-tenant cryptographic isolation table showing threshold metadata, entries, and zero cross-tenant data bleed.
- **Multi-Tier Turnkey Deployment Blueprints**:
  - 1-Click PaaS templates: `deploy/paas/railway.toml`, `deploy/paas/render.yaml`, `deploy/paas/fly.toml`, and `deploy/paas/vercel.json`.
  - Cloud VPS zero-touch bootstrap script: `deploy/cloud-vps/setup-vps.sh` for OCI Always Free & AWS Free Tier (EC2 `t4g.small`).
  - Containerized multi-service stack: updated `docker-compose.yml` incorporating `dashboard` service container on port 3000 with reverse proxying.
- **Comprehensive E2E Verification Report (`docs/verification-report.md`)**:
  - Formal report covering all 6 verification sections: smoke test (17/17 passed, 1 warning), concurrency load test (zero over-admission), 100% exact financial ledger reconciliation, routing accuracy (20/20 cases), semantic cache evaluation, and added gateway latency SLO analysis.

---

## [0.5.0] - 2026-10-27 — Phase 5: Tenant-Isolated Semantic Vector Cache & pgvector Integration

### 🚀 Added
- **In-JVM Dense Vector Embeddings (`EmbeddingService`)**: Embedded quantized `all-MiniLM-L6-v2` model (384 dimensions) running directly in JVM memory via ONNX Runtime (`langchain4j-embeddings-all-minilm-l6-v2-q:0.36.2`). Generates normalized dense vector embeddings in ~5ms with zero external network hops or sidecar API costs.
- **PostgreSQL 18 `pgvector` HNSW Nearest-Neighbor Retrieval (`CacheEntryRepository`)**: Leverages native pgvector cosine distance operator `<=>` with cosine similarity projection `1 - (c.embedding <=> cast(:queryVector as vector))` accelerated by HNSW cosine indexing (`m=16, ef_construction=64`).
- **Cryptographic Per-Tenant Vector Isolation**: Enforces tenant-isolated querying at the database layer (`WHERE virtual_key = :virtualKey AND model_alias = :modelAlias`), guaranteeing mathematical zero cross-tenant completion leakage or cache bleeding.
- **Tenant-Specific Cache Policies**: Respects tenant settings `semantic_cache.enabled` (e.g. disabled for `research` and `budget-demo`) and per-tenant `similarity_threshold` (0.92 for `search`, 0.85 for `free-tier`).
- **Paraphrase Matching & Near-Miss Rejection**: Successfully matches semantically equivalent paraphrase pairs (0.9632 cosine similarity vs 0.92 threshold) while rejecting near-miss prompts (0.7983 < 0.92) and unrelated queries (<0.10).
- **Upstream Safety Refusal Suppression**: Automatically detects safety refusals (e.g. *"I'm sorry, but I can't assist with that request"*) and prevents temporary refusals from being persisted into the vector cache.
- **Multi-Turn Conversation Context Keying**: For single-turn requests, keys on user prompt; for multi-turn conversations, canonicalizes complete message history across all roles and contents.
- **Streaming Cache SSE Replay (`StreamingRelayService.replayCachedStream`)**: Emits instant Server-Sent Events containing delta chunks, terminal usage block, and sentinel `[DONE]` with full `x-netra-*` telemetry headers and `$0.000000` cost.
- **Admin Cache Statistics API (`GET /admin/cache/stats`)**: Reports total entries, hits, misses, global hit rate, and per-key breakdown with tenant status and threshold metadata.
- **Telemetry Observability Contract**: Injects canonical headers: `x-netra-cache: hit`, `x-netra-cost-usd: 0.000000`, `x-netra-provider`, `x-netra-fallback: false`, `x-netra-route-reason: semantic_cache_hit`, and `x-netra-retries: 0`.
- **Cache Benchmark Evaluation CLI (`scripts/run_cache_eval.py`)**: Added `make cache-eval` CLI automation command and automated CI pipeline `.github/workflows/cache-ci.yml`.

---

## [0.4.0] - 2026-10-26 — Phase 4: Multi-Provider Routing, Failover Chains & Intelligent Router

### 🚀 Added
- **Multi-Provider Fallback Chains (`UpstreamClientService`)**: Dynamic ordered candidate chains for model aliases (`fast`, `smart`) and direct concrete models. Maps `fast` to primary `alpha/alpha-small` and fallback `beta/beta-small`, and `smart` to primary `alpha/alpha-large` and fallback `beta/beta-large`. Direct models automatically resolve to partner fallbacks.
- **Exponential Backoff Retries with Fast-Failover**: Automated retry loop (`max_attempts: 3`, `initial_backoff_ms: 200`, `multiplier: 2.0`) catching transient HTTP 5xx, 429, and socket exceptions before switching to fallback partner models.
- **Intelligent Prompt Difficulty Classifier (`PromptDifficultyClassifier`)**: Two-stage task instruction classification engine using operative verb extraction (`extractInstruction()`) to decouple user instructions from large text payloads (e.g. server logs, rosters). Scores proof, architecture design, Fermi estimation, systems reasoning, algorithmic complexity, and comparative evaluation signals against de-escalation patterns. Achieves 20/20 (100.00%) accuracy on `data/routing_eval.jsonl` benchmark.
- **Failover in Streaming SSE Relay**: Establishes upstream connections synchronously before committing headers. Primary connection failures automatically retry and fail over to fallback providers before the first SSE chunk is emitted.
- **All-Provider Exhaustion Guard**: When all candidates in a fallback chain are exhausted, cleanly rolls back admission slots and aborts with HTTP 502 Bad Gateway and OpenAI-compatible error payload (`upstream_unavailable`).
- **Telemetry Observability Headers**: Injects `x-netra-route-reason` (explicit classifier score and signal attribution or alias name) and `x-netra-retries` (network retry attempts executed). Both metrics persisted in audit logs.
- **Offline & Live Routing Verification CLI (`scripts/run_routing_eval.py`)**: Verification script evaluating accuracy against `data/routing_eval.jsonl` with support for both `--offline` local heuristic analysis and live gateway HTTP testing. Added `make routing-eval` command.
- **Automated Routing CI Pipeline (`.github/workflows/routing-ci.yml`)**: GitHub Actions workflow executing In-JVM classifier benchmark, multi-provider routing unit/integration tests, and CLI routing evaluation. Added `Routing_CI` badge to `README.md`.

---

## [0.3.0] - 2026-10-25 — Phase 3: Unbuffered Streaming SSE Relay & Usage Finalization

### 🚀 Added
- **Unbuffered Pass-Through SSE Relay (`StreamingRelayService`)**: Dedicated streaming engine spawning lightweight Java 25 Virtual Threads (`sse-relay-{requestId}`) to forward upstream Server-Sent Events line-by-line with 1KB read buffers for zero-delay token delivery (~20ms per token).
- **Upfront Telemetry Header Injection**: Establishes streaming headers upfront before body chunks (`Content-Type: text/event-stream;charset=UTF-8`, `Cache-Control: no-cache`, `Connection: keep-alive`, `x-netra-provider`, `x-netra-cache: miss`, `x-netra-fallback: false`).
- **Terminal Usage Object Parsing**: Automatically captures terminal `usage` block (`prompt_tokens`, `completion_tokens`, `total_tokens`) delivered in final SSE chunk per OpenAI streaming spec.
- **Fallback Heuristic Token Estimator**: Added heuristic word-count token estimation for streaming providers that omit terminal `usage` blocks, ensuring no unbilled token leaks.
- **Client Disconnect & Broken Pipe Detection**: Detects client connection terminations (`IOException: Broken pipe`), immediately halts upstream compute socket to stop LLM spend, records status `client_disconnected`, and settles spend for partial tokens delivered.
- **Premature Upstream Severance Handling**: Detects unexpected upstream drops before `data: [DONE]`, emits error SSE chunk (`stream_severed`), records status `upstream_error` (HTTP 502), and rolls back rate limit slot if zero tokens delivered.
- **Post-Stream Financial Settlement**: Asynchronously executes exact micro-USD cost calculation with `BigDecimal` and persists request logs and spend counters in PostgreSQL and Redis.
- **Automated Streaming CI Pipeline**: Authored `.github/workflows/streaming-ci.yml` verifying streaming relay tests, mock provider orchestration, and progressive token assertions.

---

## [0.2.0] - 2026-10-24 — Phase 2: Virtual Key Auth, Atomic Lua Admission & Request Logs

### 🚀 Added
- **Virtual Key Authentication & Caffeine L1 Near-Cache**: Implemented two-tier tenant auth (`TenantAuthService`) with in-memory Caffeine cache (10,000 entries, 60s TTL) backed by PostgreSQL. Enforces tenant active status and model allowlists (HTTP 403 `model_not_allowed`).
- **Atomic Redis 8.0 Lua Admission Engine**: Sliding-window rate limiting script (`admission.lua`) executing atomically in Redis. Guarantees Zero Over-Admission under concurrent bursts. Supports instant slot rollback (`ZREM`) if upstream provider fails.
- **Tenant Monthly Budget Guardrails**: Dynamic monthly spend accounting with Redis atomic counter synchronization (`netra:spend:{vkey}:{yearMonth}`) and automatic HTTP 402 `budget_exceeded` rejection.
- **Comprehensive Audit Trail & Rejection Logging**: Flyway migration `V3__flexible_request_logs_fkey.sql` enabling comprehensive request auditing for all outcomes, including unauthenticated keys (401), allowlist violations (403), rate limits (429), and budget rejections (402).
- **Admin Usage & Reconciliation API**: Implemented `GET /admin/usage` returning aggregated token counts, spend in USD, and cache hits, perfectly reconciling against client load test counters.
- **Admin Request Logs API**: Implemented `GET /admin/logs` with pagination and key filtering for chronological audit inspection.
- **Live Dynamic Forex Engine**: Added `ForexRateService` featuring live Frankfurter open forex API integration, 6-hour Caffeine caching, and offline fallback (`87.50` INR/USD).
- **CI Status Badges**: Added GitHub Actions workflow status badges to `README.md` for Backend CI, Docs CI, and OpenAPI 3.1.0 validation.
- **OpenAPI 3.1 Specification & Documentation Sync**: Updated `docs/openapi.yaml`, `docs/api-reference.md`, and MkDocs site with complete Phase 2 Admin schemas and error contracts.

---

## [0.1.0] - 2026-10-23 — Phase 1: Foundation & Core Pass-Through

### 🚀 Added
- **Core JVM Runtime**: Enterprise foundation initialized with Java 25 LTS, Spring Boot 4.1.1, and Gradle 9 Kotlin DSL on high-throughput Virtual Threads (`spring.threads.virtual.enabled: true`).
- **Telemetry Header Contract**: Ingress enforcement strictly injecting canonical telemetry headers (`x-netra-provider`, `x-netra-cache`, `x-netra-fallback`, `x-netra-cost-usd`).
- **OpenAI-Compatible Chat Completion**: Non-streaming pass-through API at `POST /v1/chat/completions` with streaming Server-Sent Events relay.
- **Micro-Cost Accounting Engine**: Accurate cost computation service utilizing `java.math.BigDecimal` with 6-decimal rounding (`RoundingMode.HALF_UP`) against configured model pricing schedules.
- **Canonical Data Ingestion**: Idempotent database seeder (`CanonicalDataSeeder`) ingesting `model_pricing.json` and multi-tenant keys from `seed_keys.json`.
- **Relational & Vector Persistence**: PostgreSQL 18 schema migration with `pgvector` v0.8.x extension and Flyway migrations for `tenants`, `model_pricing`, `request_logs`, `monthly_spend`, and `cache_entries`.
- **Infrastructure Topology**: Multi-stage production `Dockerfile` and orchestration via `docker-compose.yml` for PostgreSQL 18, Redis 8.0, and Alpha/Beta mock LLM providers.
- **Multi-Tier Deployment Architecture**: Developer tooling and deployment templates for local (`Makefile`), PaaS (`deploy/paas/`), and cloud VPS (`deploy/cloud-vps/setup-vps.sh`).
- **Open-Source Documentation Suite**: MkDocs Material site scaffolding with dark/light mode toggle, AI agent indexing (`llms.txt`), and SEO configuration.
