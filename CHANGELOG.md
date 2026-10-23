# Changelog

All notable changes to **NETRA — AI-First LLM Gateway & Semantic Vector Cache** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
