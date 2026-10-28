# NETRA Product Roadmap

This document outlines the phased engineering milestones for NETRA. Milestones follow standard delivery stages: `Complete`, `In Progress`, and `Scheduled`.

---

## Phase Milestones

| Phase | Target Release | Milestone Name | Status | Key Deliverables |
|---|---|---|---|---|
| **Phase 1** | `v0.1.0` | Foundation & Ingress Pipeline | Complete | Java 25 LTS baseline, Spring Boot 4.1.1, Docker Compose stack, canonical data seeder, strict `x-netra-*` telemetry contract, OpenAPI 3.1 specification (`openapi.yaml`). |
| **Phase 2** | `v0.2.0` | Virtual Key Auth & Atomic Admission | Complete | Multi-tenant auth, model allowlists, atomic Redis 8.0 Lua sliding-window rate limiting, zero over-admission guarantee, monthly budget caps, request audit logs. |
| **Phase 3** | `v0.3.0` | Unbuffered Streaming SSE Relay | Complete | Token-by-token pass-through streaming over Server-Sent Events on Java 25 Virtual Threads, terminal chunk usage extraction, mid-stream disconnect handling. |
| **Phase 4** | `v0.4.0` | Multi-Provider Routing & Auto Classifier | Complete | Ordered fallback chains (primary + fallbacks), exponential backoff retries (3 attempts), fast-failover across providers, two-stage prompt difficulty classifier for `auto` tier achieving 100% accuracy on `data/routing_eval.jsonl`, and `x-netra-route-reason` / `x-netra-retries` telemetry headers. |
| **Phase 5** | `v0.5.0` | Tenant-Isolated Semantic Vector Cache | Complete | In-JVM dense embeddings via quantized `all-MiniLM-L6-v2` (384-dim), PostgreSQL 18 `pgvector` HNSW index (`<=>` cosine distance), strict per-tenant cryptographic isolation, paraphrase matching, near-miss rejection, refusal suppression, multi-turn context keying, streaming SSE cache replay, and `GET /admin/cache/stats`. |
| **Phase 6** | `v0.6.0` | Ops Console & Telemetry Dashboard | Complete | React 19 / Vite 6 Ops Console (`dashboard/`), OpenRouter-grade analytics KPIs, single-denomination forex toggle (USD/INR), live SSE request stream, virtual key manager, prompt playground with 1-click evaluator presets, multi-tier PaaS deployment blueprints (Railway, Render, Fly.io, Vercel, OCI/AWS VPS), and comprehensive E2E verification report (`docs/verification-report.md`). |
| **Phase 7** | `v0.7.0` | Quality Escalation & Circuit Breaker | Scheduled | Response-quality escalation on refusal detection, provider health state machines with circuit breaker half-open probes. |
| **Phase 8** | `v0.8.0` | High-Load Hardening & Distributed Resilience | Scheduled | PACELC-tuned Redis fail-open admission, token bucket burst management, memory backpressure limits. |
| **Phase 9** | `v0.9.0` | Enterprise Security & Guardrails | Scheduled | OWASP Top 10 for LLM guardrails, PII redaction, token vaulting with AES-256-GCM. |
| **Phase 10** | `v1.0.0` | Cloud Infrastructure & Multi-Region | Scheduled | Terraform IaC (AWS ECS / OCI), Kubernetes Helm charts, automated budget self-recharge with Stripe and UPI / Razorpay. |
