# Changelog

All notable changes to **NETRA — AI-First LLM Gateway & Semantic Vector Cache** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
