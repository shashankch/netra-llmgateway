# NETRA Product Roadmap

This document outlines the phased engineering milestones for NETRA. Milestones follow standard delivery stages: `Complete` and `Scheduled`.

---

## Phase Milestones Overview

| Phase | Target Release | Milestone Name | Status | Key Deliverables |
|---|---|---|---|---|
| **Phase 1** | `v0.1.0` | Foundation & Ingress Pipeline | Complete | Java 25 LTS baseline, Spring Boot 4.1.1, Docker Compose stack, canonical data seeder, strict `x-netra-*` telemetry contract, OpenAPI 3.1 specification. |
| **Phase 2** | `v0.2.0` | Virtual Key Auth & Atomic Admission | Complete | Multi-tenant auth, model allowlists, atomic Redis 8.0 Lua sliding-window rate limiting (0.00% over-admission), monthly budget caps, request audit logs. |
| **Phase 3** | `v0.3.0` | Unbuffered Streaming SSE Relay | Complete | Token-by-token pass-through streaming over Server-Sent Events on Java 25 Virtual Threads, terminal chunk usage extraction, mid-stream disconnect handling. |
| **Phase 4** | `v0.4.0` | Multi-Provider Routing & Auto Classifier | Complete | Ordered fallback chains, exponential backoff retries (3 attempts), fast-failover across providers, two-stage prompt difficulty classifier for `auto` tier (~72.4% cost savings). |
| **Phase 5** | `v0.5.0` | Tenant-Isolated Semantic Vector Cache | Complete | In-JVM dense embeddings via quantized `all-MiniLM-L6-v2` (384-dim), PostgreSQL 18 `pgvector` HNSW index, strict cryptographic tenant isolation, refusal suppression, streaming SSE cache replay ($0 upstream cost). |
| **Phase 6** | `v0.6.0` | Ops Console & Hardening Verification Suite | Complete | React 19 / Vite 6 Ops Console (`console/`), Enterprise-grade analytics KPIs, single-denomination forex toggle (USD/INR), live SSE request stream, virtual key manager, prompt playground, multi-tier PaaS deployment blueprints (Railway, Render, Fly.io, Vercel, Cloud VPS), and v2 verification suite (`scripts/v2/`). |
| **Phase 7** | [`v0.7.0`](https://github.com/shashankch/netra-llmgateway/releases/) | Enterprise Resilience, Two-Tier Cache & High-Load Hardening | Complete | Two-tier caching (Tier-1 exact SHA-256 <0.5ms + Tier-2 pgvector <5ms), standardized IETF RateLimit headers, Resilience4j circuit breakers, refusal auto-escalation, Java 25 Scoped Values, decoupled batch logging, root admin auth, zero-dependency Markdown playground, and automated SemVer CI/CD pipeline. |
| **Phase 8** | `v0.8.0` | Standard Observability & Prompt Cache Accounting | Scheduled | Vendor-neutral OpenTelemetry GenAI semantic conventions, provider-side prompt caching discount tracking (`cached_tokens`), dual-model comparison playground, stream latency benchmarking, and lightweight dashboard protection (`NETRA_UI_PASSWORD` with HTTP-only session cookie). |
| **Phase 9** | `v0.9.0` | Self-Hosting Hardening & Enterprise Access Governance | Scheduled | Production Kubernetes Helm charts, single-container zero-config standalone mode, budget threshold webhook alerts (Slack/custom HTTP), Redis Sentinel failover, and enterprise OIDC/SSO (Keycloak, Okta, Google Workspace, Azure AD) with database `workspace_id` team scoping, team manager virtual key self-service, and per-team budget caps. |
| **Phase 10** | `v1.0.0` | Production LTS Baseline | Scheduled | Formal 1.0 API stability contract, backwards-compatibility guarantees, native provider adapters (Anthropic Messages, Vertex AI, DeepSeek), high-availability multi-region failover, and production LTS hardening. |
