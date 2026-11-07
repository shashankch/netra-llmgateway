# Changelog

All notable changes to **NETRA LLM Gateway & Semantic Vector Cache** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.7.1] - 2026-11-08

### Added
- **Playground Ergonomics**: Added 1-click model alias selection (`fast`, `smart`, `auto`), segmented Stream/JSON slider, and grouped benchmark test scenarios.
- **Spend Visibility**: Added sub-1% spend badge and progress visibility indicator for active virtual keys.
- **Provider Telemetry**: Added upstream call telemetry separating zero-cost cache hits from outbound provider traffic.
- **UI Deployment Workflows**: Added deployment guides for local Docker Compose, standalone Vite development, and edge CDN hosting.

### Changed
- **Unified Ingress Hostnames**: Migrated cloud endpoints to single-level hyphenated subdomains for wildcard SSL compatibility.
- **Documentation Custom Domain**: Configured sovereign domain `docs-netrallm.avadhanlabs.dev` via GitHub Pages CNAME.
- **Local Dev Port**: Enforced deterministic port 3000 binding for local console development.

### Fixed
- **Cross-Origin Requests**: Added high-precedence CORS filter to allow cross-subdomain communication between console and gateway.
- **Dropdown Clipping**: Fixed vertical text cutoff across model selection and benchmark scenario dropdowns.
- **Health Check Deduplication**: Unified concurrent background health probes via a shared in-flight request.
- **Pagination Safety**: Added safe upper bounds to prevent arithmetic overflow on large cursor offsets.
- **Documentation Deployment**: Preserved CNAME configuration across automated documentation build artifacts.

---

## [0.7.0] - 2026-11-03

### Added
- **Scoped Values Context**: Replaced thread-local context with immutable, thread-safe scoped values across virtual threads.
- **Connection Pool Protection**: Added an in-memory bounded batch buffer for asynchronous audit logging, shielding database pools under high-concurrency bursts.
- **Two-Tier Cache Hierarchy**: Sub-0.5ms exact hash near-cache and sub-5ms semantic vector cache with automatic back-population.
- **IETF RateLimit Protocol**: Added compliance with standardized sliding-window rate limit headers.
- **Dynamic Circuit Breakers**: Added automated fast-failover across providers and live provider health telemetry.
- **Refusal Auto-Escalation**: Automatically detects small-model refusals and transparently escalates requests to frontier reasoning models.
- **Console Analytics Polish**: Added virtual key spend pagination, cache inspection modals, and live audit log stream viewer.

---

## [0.6.0] - 2026-10-28

### Added
- **Operations Console**: React 19 and Vite 6 operations console providing real-time analytics, request audit logs, virtual key management, and prompt playground.
- **Analytics Suite**: KPI metrics for spend, request count, token volume distribution, cache hit rate, and latency percentiles.
- **Dual-Theme Support**: Dark obsidian default theme and crisp enterprise light theme with persistent user preference.
- **Multi-Currency Display**: Dynamic USD and INR currency switcher with live foreign exchange conversion.
- **Turnkey Deployment**: Container orchestration and deployment blueprints for Docker Compose, PaaS, and cloud virtual machines.

---

## [0.5.0] - 2026-10-27

### Added
- **In-JVM Dense Vector Embeddings**: Embedded quantized embedding model running in JVM memory for sub-5ms vector generation without external API dependencies.
- **pgvector Cosine Retrieval**: Nearest-neighbor semantic retrieval with HNSW indexing for rapid similarity matching.
- **Per-Tenant Vector Isolation**: Strict tenant isolation at the database layer preventing cross-tenant completion leakage.
- **Semantic Cache Policies**: Configurable per-tenant cache enablement and similarity thresholds.
- **Safety Refusal Suppression**: Prevents upstream safety refusals from polluting the persistent vector cache.
- **Streaming Cache Replay**: Instant replay of cached completions over Server-Sent Events with zero upstream token cost.

---

## [0.4.0] - 2026-10-26

### Added
- **Multi-Provider Fallback Chains**: Configurable fallback routes for model aliases and direct model targets.
- **Exponential Backoff**: Automated retries for transient upstream failures before switching to fallback providers.
- **Prompt Difficulty Classifier**: Syntactic intent classification routing simple queries to fast models and complex queries to frontier reasoning models.
- **Streaming Failover**: Synchronous connection establishment ensuring upstream failures trigger failover before committing streaming response headers.
- **Provider Exhaustion Guard**: Graceful error handling and admission slot rollback when all fallback candidates are unavailable.

---

## [0.3.0] - 2026-10-25

### Added
- **Unbuffered Streaming Relay**: Pass-through streaming engine forwarding Server-Sent Events on virtual threads with minimal latency.
- **Client Disconnect Protection**: Detects client socket terminations, immediately severing upstream compute connections to prevent unbilled spend.
- **Premature Severance Handling**: Detects unexpected upstream drops, marks errors cleanly, and restores rate-limit slots when zero tokens are delivered.
- **Usage Finalization**: Parses terminal usage objects and provides fallback token estimation when usage blocks are omitted.

---

## [0.2.0] - 2026-10-24

### Added
- **Virtual Key Authentication**: Two-tier tenant authentication with in-memory caching and model allowlist enforcement.
- **Atomic Lua Admission**: Single-transaction Redis rate limiting guaranteeing zero over-admission under concurrent bursts.
- **Budget Guardrails**: Dynamic monthly spend tracking with automatic rejection when budget limits are exceeded.
- **Audit Logging**: Comprehensive audit trail recording request outcomes, token usage, and billing metadata.
- **Admin APIs**: Management endpoints for usage reconciliation, audit logs, and cache inspection.

---

## [0.1.0] - 2026-10-23

### Added
- **Core Runtime**: Java 25 LTS and Spring Boot on high-throughput virtual threads.
- **OpenAI Compatibility**: Non-blocking proxy for chat completions supporting standard request payloads.
- **Micro-Cost Accounting**: High-precision financial arithmetic calculating request spend in USD.
- **Persistence Foundation**: Relational storage and vector indexing for tenants, model pricing, and audit records.
- **Documentation Scaffolding**: Static documentation site and OpenAPI 3.1 specification.
