# NETRA — Intelligent LLM Gateway & Semantic Cache

<p align="center">
  <img src="assets/netra-banner.svg" alt="NETRA Enterprise AI Gateway Banner" width="100%" style="border-radius: 12px; margin: 1rem 0 2rem;">
</p>

**NETRA** (*Sanskrit: नेत्र — Vision / Aperture / Insight*) is an enterprise-grade, high-throughput LLM Gateway and tenant-isolated Semantic Vector Cache. Sitting in the critical path between application microservices and foundation model providers, NETRA delivers predictable latency, multi-provider failover, race-safe atomic admission control, and sub-5ms semantic cache hits.

---

## Key Platform Guarantees

- **Universal OpenAI Compatibility:** Direct drop-in proxy for `/v1/chat/completions` — zero client SDK changes required.
- **Tenant-Isolated Semantic Cache:** Sub-5ms cosine similarity retrieval with cryptographic per-tenant boundaries at **$0.000000** upstream cost.
- **Atomic Admission Control:** Single-transaction Redis 8.0 sliding-window rate limiting ensuring **0.00% over-admission** under high-concurrency bursts.
- **Dynamic Cost Arbitrage:** Syntactic difficulty classifier (`auto` tier) routing simple queries to fast models and complex tasks to frontier reasoning models, achieving up to **~72.4% cost savings**.
- **Synchronous Upstream Failover:** Multi-provider fallback chains (`fast` &rarr; `primary` &rarr; `fallback`) with bounded exponential retries and zero-glitch SSE streaming failover.
- **Real-Time Financial Telemetry:** Exact 6-decimal micro-cost accounting (`BigDecimal`) in USD with live Forex conversion (USD / INR).

---

## Core Architecture & Technology Stack

| Pillar | Technology | Role in Ingress Pipeline |
|---|---|---|
| <img src="assets/icons/java.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Runtime Engine** | Java 25 LTS (Virtual Threads / Loom) | High-throughput unbuffered SSE streaming relay & socket cancellation detection |
| <img src="assets/icons/spring.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Framework** | Spring Boot 4.1.1 | Graceful shutdown connection draining, actuator probes & observability |
| <img src="assets/icons/postgres.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Vector Storage** | PostgreSQL 18 & pgvector | Dense vector embeddings (384-dim) with HNSW indexing for sub-5ms cosine caching |
| <img src="assets/icons/redis.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Admission Control** | Redis 8.0 Alpine (Lua Scripting) | Single-transaction sliding-window rate limiting & atomic budget validation (0.00% over-admission) |
| <img src="assets/icons/react.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Operations Console** | React 19 / Vite 6 | Real-time SSE audit logging, multi-currency accounting (USD/INR) & prompt playground |
| <img src="assets/icons/docker.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Containerization** | Docker Compose & Cloud VPS | Multi-service orchestration with zero-open-port Cloudflare Zero Trust tunnel support |

---

## Architectural Topology

![NETRA System Architecture](diagrams/00_readme_architecture_light.svg#only-light)
![NETRA System Architecture](diagrams/00_readme_architecture_dark.svg#only-dark)

---

## Canonical Telemetry Contract

Every completion response emitted by NETRA strictly carries canonical `x-netra-*` telemetry headers:

| Header | Description | Example Value |
|---|---|---|
| `x-netra-provider` | Upstream provider and model that served the request | `alpha/alpha-small` |
| `x-netra-cache` | Indicates whether the completion was served from cache | `hit` or `miss` |
| `x-netra-fallback` | Indicates if an upstream failover provider was invoked | `false` or `true` |
| `x-netra-cost-usd` | Computed request cost formatted to 6 decimal places | `0.000014` |
| `x-netra-route-reason` | Decision rationale applied by the model router | `auto -> smart (score +3.5)` |
| `x-netra-retries` | Number of upstream network retries absorbed before success | `0` |

---

## Quickstart in 60 Seconds

### 1. Launch Backing Services & Gateway

```bash
git clone https://github.com/shashankch/netra-llmgateway.git
cd netra-llmgateway
make up
```

Verify service readiness:

```bash
curl -f http://localhost:8080/health
# {"status":"ok","service":"netra-gateway","version":"0.6.0"}
```

### 2. Dispatch a Chat Completion

```bash
curl -i -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer netra-sk-search-1a2b3c" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fast",
    "messages": [
      {"role": "user", "content": "What is a message queue?"}
    ]
  }'
```

---

## Explore Technical Documentation

- 🏛️ **[System Architecture](architecture.md)** — Ingress stages, pipeline flow, and virtual threads execution topology.
- ⚖️ **[Gateway Comparison](comparison.md)** — Architectural tradeoffs against direct vendor APIs and public SaaS aggregators.
- 📡 **[REST API Reference](api-reference.md)** — Complete OpenAPI 3.1 endpoint schemas, error envelopes, and request bodies.
- 📜 **[Architectural Decision Records (ADRs)](ADR.md)** — Design decisions ADR-001 through ADR-010.
- 🚀 **[Self-Hosting Guide](SELF-HOSTING.md)** — Turnkey deployment blueprints for Docker, Railway, Render, Fly.io, and Cloud VPS.
- ✅ **[Official Verification Report](verification-report.md)** — Benchmark results, concurrency load test data, and semantic cache evaluations.
