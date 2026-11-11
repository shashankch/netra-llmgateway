# Changelog

All notable changes to **NETRA LLM Gateway & Semantic Vector Cache** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.7.3](https://github.com/shashankch/netra-llmgateway/compare/netra-llmgateway-v0.7.2...netra-llmgateway-v0.7.3) (2026-11-11)

### Features

* **console:** zero-dependency markdown renderer in playground response pane with copyable code blocks, typography, tables, and segmented markdown vs raw view mode toggle
* **gateway:** multi-file release-please automated SemVer pipeline synchronization across `build.gradle.kts`, `package.json`, and OpenAPI definitions
* **infra:** scope `console` container under `local` and `console` docker compose profiles to ensure standard `docker compose up -d` boots strictly core backend infrastructure

### Bug Fixes

* **console,ci:** pull version from gateway health and upgrade actions to node 24 runtime ([#16](https://github.com/shashankch/netra-llmgateway/issues/16)) ([88e6c60](https://github.com/shashankch/netra-llmgateway/commit/88e6c60d13a44123a7263508fec518b9c02d03f5))
* **gateway:** synchronize runtime health controller and unit test assertions with active build manifest release version ([#17](https://github.com/shashankch/netra-llmgateway/issues/17))

## [0.7.2](https://github.com/shashankch/netra-llmgateway/compare/netra-llmgateway-v0.7.1...netra-llmgateway-v0.7.2) (2026-11-11)


### Features

* **phase-1:** foundation, canonical data seeder, pass-through ingress, and docs CI ([#1](https://github.com/shashankch/netra-llmgateway/issues/1)) ([255fddf](https://github.com/shashankch/netra-llmgateway/commit/255fddf6408354a6c6ccc844eb2c65c168db8aa0))
* **phase-2:** virtual key auth, atomic lua admission, and request logs ([#2](https://github.com/shashankch/netra-llmgateway/issues/2)) ([d8155d8](https://github.com/shashankch/netra-llmgateway/commit/d8155d8f8f77ff450c6076a97cf5e58a8ba5afec))
* **phase-3:** unbuffered streaming sse relay and usage finalization ([#3](https://github.com/shashankch/netra-llmgateway/issues/3)) ([b380c28](https://github.com/shashankch/netra-llmgateway/commit/b380c2832b65449937b52025ef360318ad02db3c))
* **phase-4:** multi-provider routing, fast-failover, and intelligent auto router ([#4](https://github.com/shashankch/netra-llmgateway/issues/4)) ([c056191](https://github.com/shashankch/netra-llmgateway/commit/c0561913b5e8d84cb9bbf3c6ca99b8c4dacd7cd6))
* **phase-5:** tenant-isolated semantic vector cache, pgvector integration and sync docs ([#5](https://github.com/shashankch/netra-llmgateway/issues/5)) ([bc3c6d2](https://github.com/shashankch/netra-llmgateway/commit/bc3c6d29e32c1fb76faab480e0881c4a3d8b45f2))
* **phase-6-7:** enterprise operations console, resilience4j circuit breakers, two-tier caching, and hardened security ([#6](https://github.com/shashankch/netra-llmgateway/issues/6)) ([c851e4a](https://github.com/shashankch/netra-llmgateway/commit/c851e4a7ca0577b2aae383495e2c8f5a6c8d20e4))


### Bug Fixes

* **ci, infra:** auto-fallback to sudo docker compose for fresh VM provisioning ([#7](https://github.com/shashankch/netra-llmgateway/issues/7)) ([43f153d](https://github.com/shashankch/netra-llmgateway/commit/43f153d29d7e2d064c75d83893d093661945b34d))
* **console,gateway:** enterprise console polish, high-precedence CORS filter, and full documentation sync ([#12](https://github.com/shashankch/netra-llmgateway/issues/12)) ([da8650f](https://github.com/shashankch/netra-llmgateway/commit/da8650f0bef81dde7a2189df67345c80fcdb391c))
* **console:** persist background monitoring toggle on modal save, update default model aliases in production profile ([#10](https://github.com/shashankch/netra-llmgateway/issues/10)) ([e05fe6f](https://github.com/shashankch/netra-llmgateway/commit/e05fe6fc6a10278b92085e0f597e4b597ce50f9a))
* **console:** prevent route reason badge from overlapping token usage in request logs, playground state fixes, caching improvements ([#11](https://github.com/shashankch/netra-llmgateway/issues/11)) ([da76bd5](https://github.com/shashankch/netra-llmgateway/commit/da76bd5eaea5fb898306201f651c6646570490a1))
* **docs:** preserve CNAME in pages artifact and document Cloudflare DNS-only setup ([#13](https://github.com/shashankch/netra-llmgateway/issues/13)) ([3f7abeb](https://github.com/shashankch/netra-llmgateway/commit/3f7abeb94fe6aeb08bb7a6c19a355fe5e1f05bbc))
* **ingress, infra:** single-level hyphenated subdomains for Cloudflare SSL & automated docker compose elevation ([#8](https://github.com/shashankch/netra-llmgateway/issues/8)) ([d6e9acf](https://github.com/shashankch/netra-llmgateway/commit/d6e9acfe7f1c9ca4e20dd5a23bc216462c969faa))
* **script:** hyphen domain and vps script ([#9](https://github.com/shashankch/netra-llmgateway/issues/9)) ([63fb70b](https://github.com/shashankch/netra-llmgateway/commit/63fb70b4e7c617b6d9ac31d182cbe993e31cd025))

## [0.7.1] - 2026-11-08

### Added
- **Playground Ergonomics**: Added 1-click model alias selection (`fast`, `smart`, `auto`), segmented Stream/JSON slider, and grouped benchmark test scenarios.
- **Spend Visibility**: Added sub-1% spend badge and progress visibility indicator for active virtual keys.
- **Provider Telemetry**: Added upstream call telemetry separating zero-cost cache hits from outbound provider traffic.
- **UI Deployment Workflows**: Added deployment guides for local Docker Compose, standalone Vite development, and edge CDN hosting.
- **Environment Variables Reference**: Documented essential backend and frontend environment variables in README, quickstart, and self-hosting documentation.
- **Verification Commands Reference**: Documented `make load`, `make chaos`, `make cache-fuzz`, `make stress`, and `make verify-all` across public guides and contributing references.
- **Docker Compose Profiles**: Isolated mock upstream services (`mock-alpha`, `mock-beta`) under `dev` and `test` profiles, keeping production environments lean and mock-free.

### Changed
- **Unified Ingress Hostnames**: Migrated cloud endpoints to single-level hyphenated subdomains for wildcard SSL compatibility.
- **Documentation Custom Domain**: Configured sovereign domain `docs-netrallm.avadhanlabs.dev` via GitHub Pages CNAME.
- **Local Dev Port**: Enforced deterministic port 3000 binding for local console development.
- **CI Workflow Standardization**: Aligned GitHub Actions workflow and job names to clean production conventions.
- **Hero Banner Tagline**: Synchronized banner and landing hero copy to unified OpenAI-compatible interface phrasing.
- **Documentation Hygiene**: Removed promotional references and cleaned up verification terminology.

### Fixed
- **Cross-Origin Requests**: Added high-precedence CORS filter to allow cross-subdomain communication between console and gateway.
- **Dropdown Clipping**: Fixed vertical text cutoff across model selection and benchmark scenario dropdowns.
- **Health Check Deduplication**: Unified concurrent background health probes via a shared in-flight request.
- **Pagination Safety**: Added safe upper bounds to prevent arithmetic overflow on large cursor offsets.
- **Documentation Deployment**: Preserved CNAME configuration across automated documentation build artifacts.
- **Console Initial Load Probing**: Added immediate initial health probe on console mount to display live connectivity status on first render.
- **Responsive UI Layouts**: Refactored grid templates, navbar controls, and playground containers to eliminate viewport overflow and adapt fluidly across mobile and tablet screen sizes.
- **Playground Profile State Invariant**: Disabled unseeded demo profiles and inactive virtual keys in customer production deployments, adding inline key status feedback and direct minting shortcuts.
- **Figure Caption Links**: Removed redundant dark-theme and legacy D2 source links from architecture diagrams.

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

[0.7.1]: https://github.com/shashankch/netra-llmgateway/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/shashankch/netra-llmgateway/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/shashankch/netra-llmgateway/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/shashankch/netra-llmgateway/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/shashankch/netra-llmgateway/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/shashankch/netra-llmgateway/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/shashankch/netra-llmgateway/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/shashankch/netra-llmgateway/releases/tag/v0.1.0
