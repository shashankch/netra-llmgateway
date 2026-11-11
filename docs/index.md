<h1 align="center" style="text-align: center !important;" id="netra-llm-gateway-semantic-cache">NETRA LLM Gateway &amp; Semantic Cache</h1>

<p align="center">
  <img src="assets/netra-banner.svg" alt="NETRA Enterprise AI Gateway Banner" width="100%" style="border-radius: 12px; margin: 1rem 0 1rem;">
</p>

<p align="center">
  <a href="https://github.com/shashankch/netra-llmgateway/releases/latest"><img src="https://img.shields.io/github/v/release/shashankch/netra-llmgateway?color=059669&label=release&logo=github&labelColor=0B0F19&style=flat" alt="Latest Release"/></a>
  <a href="https://github.com/shashankch/netra-llmgateway/actions/workflows/gateway-ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/shashankch/netra-llmgateway/gateway-ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white&labelColor=0B0F19&style=flat" alt="CI Status"/></a>
  <a href="https://github.com/shashankch/netra-llmgateway/tree/main"><img src="https://img.shields.io/badge/branch-main-38bdf8.svg?style=flat&logo=git&labelColor=0B0F19" alt="Branch Main"/></a>
</p>

**NETRA** (*Sanskrit: नेत्र / Vision / Aperture / Insight*) is an enterprise-grade, sovereign AI Gateway and tenant-isolated Semantic Vector Cache. Sitting in the critical path between application microservices and foundation model providers, NETRA delivers predictable latency, multi-provider fast-failover, race-safe atomic admission control, and sub-5ms semantic cache hits.

---

## Key Platform Guarantees

- **Universal OpenAI Compatibility:** Direct drop-in proxy for `/v1/chat/completions` requiring zero client SDK modifications.
- **Two-Tier Semantic Vector Cache:** Sub-0.5ms exact hash near-cache (Tier 1) and sub-5ms cosine similarity retrieval (Tier 2) with cryptographic per-tenant boundaries at **$0.000000** upstream cost.
- **Atomic Admission Control:** Single-transaction Redis 8.0 sliding-window rate limiting ensuring **0.00% over-admission** under high-concurrency bursts, compliant with standardized IETF RateLimit protocol headers.
- **Dynamic Cost Arbitrage:** Syntactic difficulty classifier (`auto` tier) routing simple queries to fast models and complex tasks to frontier reasoning models, achieving up to **~72.4% cost savings**.
- **Synchronous Upstream Failover & Resilience:** Resilience4j circuit breakers (<0.05ms fast-failover), multi-provider fallback chains (`fast` &rarr; `primary` &rarr; `fallback`), small-model refusal auto-escalation, and zero-glitch SSE streaming failover.
- **Disconnect Protection & Instant Reclamation:** Instant detection of client socket drops (`Broken pipe`) on Java 25 Virtual Threads, severing upstream compute in <2ms to halt phantom spend, with automatic rate-limit quota rollback on zero-token aborts.
- **Real-Time Financial Telemetry:** Exact 6-decimal micro-cost accounting (`BigDecimal`) in USD with live Forex conversion (USD / INR).

---

## Core Architecture & Technology Stack

| Pillar | Technology | Role in Ingress Pipeline |
|---|---|---|
| <img src="assets/icons/java.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Runtime Engine** | Java 25 LTS (Virtual Threads / Loom & Scoped Values) | High-throughput unbuffered SSE streaming relay & socket cancellation detection |
| <img src="assets/icons/spring.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Framework** | Spring Boot 4.1.1 | Graceful shutdown connection draining, actuator probes & observability |
| <img src="assets/icons/postgres.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Vector Storage** | PostgreSQL 18 & pgvector | Dense vector embeddings (384-dim) with HNSW indexing for sub-5ms cosine caching |
| <img src="assets/icons/redis.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Admission Control** | Redis 8.0 Alpine (Lua Scripting) | Single-transaction sliding-window rate limiting & atomic budget validation (0.00% over-admission) |
| <img src="assets/icons/react.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Operations Console** | React 19 / Vite 6 | Real-time SSE audit logging, multi-currency accounting (USD/INR), cache inspector, and modernized sandbox with 1-click router badges (`fast`/`smart`/`auto`) & Stream/JSON toggle |
| <img src="assets/icons/docker.svg" width="18" height="18" style="vertical-align: middle; margin-right: 6px;"> **Containerization** | Docker Compose & Cloud VPS | Multi-service orchestration with zero-open-port Cloudflare Zero Trust tunnel support |

---

## Architectural Topology

![NETRA System Architecture](diagrams/00_readme_architecture_dark.svg)

---

## Canonical Telemetry Contract

Every completion response emitted by NETRA strictly carries canonical `x-netra-*` telemetry headers:

| Header | Description | Example Value |
|---|---|---|
| `x-netra-provider` | Upstream provider and model that served the request | `alpha/alpha-small` |
| `x-netra-cache` | Indicates whether the completion was served from cache | `hit` or `miss` |
| `x-netra-cache-tier` | Cache tier resolving the response | `tier1_exact` or `tier2_semantic` |
| `x-netra-fallback` | Indicates if an upstream failover provider was invoked | `false` or `true` |
| `x-netra-cost-usd` | Computed request cost formatted to 6 decimal places | `0.000014` |
| `x-netra-route-reason` | Decision rationale applied by the model router | `auto -> smart (score +3.5)` |
| `x-netra-retries` | Number of upstream network retries absorbed before success | `0` |
| `x-netra-escalated` | Indicates if small-model refusal was auto-escalated | `true` |

### Standardized IETF RateLimit Headers

In compliance with `draft-ietf-httpapi-ratelimit-headers`, all responses carry standardized admission metadata:

| Header | Description | Example Value |
|---|---|---|
| `RateLimit-Limit` | Maximum request quota configured for the sliding window | `60` |
| `RateLimit-Remaining` | Remaining requests permitted within the active window | `57` |
| `RateLimit-Reset` | Delta in seconds until the active window resets | `42` |
| `RateLimit-Policy` | Quota policy definition in format `<limit>;w=<seconds>` | `60;w=60` |
| `Retry-After` | Seconds to wait before retrying (emitted on HTTP 429) | `42` |

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
# {"status":"ok","service":"netra-gateway","version":"0.7.1"}
```

Inspect live provider health & circuit breaker telemetry:
```bash
curl -i http://localhost:8080/admin/providers/health \
  -H "Authorization: Bearer netra-admin-demo"
```

!!! tip "Release & Version Verification"
    To inspect active builds and automated verification reports on the `main` branch, visit the [GitHub Actions CI Console](https://github.com/shashankch/netra-llmgateway/actions/workflows/gateway-ci.yml) or view [latest source on `main`](https://github.com/shashankch/netra-llmgateway/tree/main).

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

**Response Telemetry Headers & Body:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
x-netra-provider: alpha/alpha-small
x-netra-cache: miss
x-netra-fallback: false
x-netra-cost-usd: 0.000011
x-netra-route-reason: alias_fast
x-netra-retries: 0
RateLimit-Limit: 60
RateLimit-Remaining: 59
RateLimit-Reset: 60
RateLimit-Policy: 60;w=60

{
  "id": "chatcmpl-7f8b9a2c",
  "object": "chat.completion",
  "created": 1729891200,
  "model": "alpha-small",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "A message queue is an asynchronous communications protocol that enables decoupled components to produce and consume messages reliably."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 25,
    "total_tokens": 37
  }
}
```

!!! tip "Cloud Ingress Endpoints (`avadhanlabs.dev`) [Pre-Prod / Demo Only]"
    *(These endpoints are provided for pre-prod and demo evaluation; for production workloads, deploy your own self-hosted instance.)*

    * **Gateway Data Plane:** `https://gateway-netrallm.avadhanlabs.dev/v1/chat/completions`
    * **Operations Console:** `https://console-netrallm.avadhanlabs.dev`
    * **Documentation Site:** `https://docs-netrallm.avadhanlabs.dev`

### 3. Launch & Serve Operations Console UI

Open the real-time telemetry dashboard, semantic cache inspector, and model playground:

```bash
# Docker Compose (included in make up)
http://localhost:3000

# Standalone Development (Vite hot-reload)
make console-dev        # or: cd console && npm install && npm run dev

# Production Build & Preview Server
make console-build
make console-serve      # or: cd console && npm run preview
```

### 4. Run Automated Verification Suites

Execute the contract smoke tests, routing accuracy benchmark, concurrency load tests, and v2 hardening suites:

```bash
# Core Verification Suite (v1)
make smoke              # 17 contract checks (headers, streaming, auth, 4xx)
make routing-eval       # 20 prompt difficulty trap cases (auto classifier)
make cache-eval         # Paraphrase match, near-miss rejection, $0 deduplication
make load               # 30-request concurrency burst (asserts 0.00% over-admission)

# Hardening Verification Suite (v2)
make chaos              # Abrupt client socket drops, budget limits, vector faults
make cache-fuzz         # Cross-tenant vector isolation & refusal suppression
make stress             # Sustained concurrency throughput & TTFT percentiles

# Run Complete Suite
make verify-all         # Executes all 7 verification drills sequentially
```

### 5. Essential Environment Variables

#### Backend Gateway (`.env`)
| Variable | Default / Example | Purpose |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `dev` (or `prod`) | Profile selector: `dev` for local mock providers, `prod` for OpenRouter / live upstream |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | API key for unified 500+ model routing via OpenRouter |
| `OPENAI_API_KEY` | `sk-proj-...` | *(Optional)* Direct OpenAI API key if bypassing aggregator |
| `VLLM_BASE_URL` | `http://localhost:8000/v1` | *(Optional)* In-VPC private endpoint (vLLM / Ollama) |
| `NETRA_ADMIN_TOKEN` | `netra-admin-demo` | Bearer token for `/admin/*` control plane and analytics endpoints |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/netra` | PostgreSQL JDBC connection string (auto-resolved in Docker) |
| `SPRING_DATA_REDIS_HOST` | `localhost` | Redis host for atomic rate limiting and sliding-window quotas |
| `CLOUDFLARE_TUNNEL_TOKEN` | `eyJhIjoi...` | *(Optional)* Cloudflare Tunnel token for zero-open-port ingress |

#### Frontend Operations Console (`console/.env`)
| Variable | Default / Example | Purpose |
|---|---|---|
| `VITE_GATEWAY_URL` | `""` (relative `/` proxy) | Target gateway base URL (e.g. `https://gateway-netrallm.avadhanlabs.dev`) |
| `VITE_BACKEND_TARGET` | `http://localhost:8080` | Backend target used by Vite dev server reverse proxy |

---

## Explore Technical Documentation

- 🏛️ **[System Architecture](architecture.md)** — Ingress stages, pipeline flow, and virtual threads execution topology.
- 📋 **[Architecture Decisions (ADRs)](adr.md)** — Architectural decision records, evaluated options, and engineering rationale.
- ⚖️ **[Gateway Comparison](comparison.md)** — Architectural tradeoffs against direct vendor APIs and public SaaS aggregators.
- 📡 **[REST API Reference](api-reference.md)** — Complete OpenAPI 3.1 endpoint schemas, error envelopes, and request bodies.
- 📊 **[Verification & Benchmark Report](verification-report.md)** — Empirical verification, load benchmarks, 0.00% over-admission guarantees, and routing accuracy results.
- 🚀 **[Self-Hosting Guide](SELF-HOSTING.md)** — Turnkey deployment blueprints for Docker, Railway, Render, Fly.io, and Cloud VPS.
- 🗺️ **[Product Roadmap](ROADMAP.md)** — Platform engineering milestones and upcoming product releases.
- 🛡️ **[Security Policy](SECURITY.md)** — Vulnerability reporting, security posture, and disclosure guidelines.
- 🤝 **[Contributing Guidelines](CONTRIBUTING.md)** — Development workflow, code standards, and verification suites.
