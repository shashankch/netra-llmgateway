<p align="center">
  <img src="docs/assets/netra-banner.svg" alt="NETRA Enterprise AI Gateway Banner" width="100%">
</p>
<br/>

  <p align="center">
    <strong>Route dynamically across frontier models, eliminate redundant token spend with sub-5ms caching, and ensure zero-downtime inference with one drop-in OpenAI-compatible API.</strong>
  </p>

  <p align="center">
    <a href="https://openjdk.org/projects/jdk/25/"><img src="https://img.shields.io/badge/Java-25%20LTS-0B0F19?style=flat&logo=openjdk&logoColor=ED8B00&labelColor=0B0F19" alt="Java 25 LTS"/></a>
    <a href="https://spring.io/projects/spring-boot"><img src="https://img.shields.io/badge/Spring_Boot-4.1.1-0B0F19?style=flat&logo=springboot&logoColor=6DB33F&labelColor=0B0F19" alt="Spring Boot 4.1.1"/></a>
    <a href="https://github.com/pgvector/pgvector"><img src="https://img.shields.io/badge/PostgreSQL-18%20pgvector-0B0F19?style=flat&logo=postgresql&logoColor=4169E1&labelColor=0B0F19" alt="PostgreSQL 18 pgvector"/></a>
    <a href="https://redis.io"><img src="https://img.shields.io/badge/Redis-8.0%20Lua-0B0F19?style=flat&logo=redis&logoColor=DC382D&labelColor=0B0F19" alt="Redis 8.0 Lua"/></a>
    <a href="docs/openapi.yaml"><img src="https://img.shields.io/badge/OpenAPI-3.1.0-0B0F19?style=flat&logo=openapiinitiative&logoColor=6BA539&labelColor=0B0F19" alt="OpenAPI 3.1.0"/></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-0B0F19?style=flat&logo=apache&logoColor=D22128&labelColor=0B0F19" alt="Apache 2.0 License"/></a>
  </p>

  <p align="center">
    <a href="https://github.com/shashankch/netra-llmgateway/releases/latest"><img src="https://img.shields.io/github/v/release/shashankch/netra-llmgateway?color=059669&label=release&logo=github&labelColor=0B0F19&style=flat" alt="Latest Release"/></a>
    <a href="https://github.com/shashankch/netra-llmgateway/actions/workflows/gateway-ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/shashankch/netra-llmgateway/gateway-ci.yml?branch=main&label=Gateway_CI&logo=githubactions&logoColor=white&labelColor=0B0F19&style=flat" alt="Gateway CI"/></a>
    <a href="https://github.com/shashankch/netra-llmgateway/actions/workflows/console-ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/shashankch/netra-llmgateway/console-ci.yml?branch=main&label=Console_CI&logo=githubactions&logoColor=white&labelColor=0B0F19&style=flat" alt="Console CI"/></a>
    <a href="https://github.com/shashankch/netra-llmgateway/actions/workflows/gateway-verification.yml"><img src="https://img.shields.io/github/actions/workflow/status/shashankch/netra-llmgateway/gateway-verification.yml?branch=main&label=Verification_CI&logo=githubactions&logoColor=white&labelColor=0B0F19&style=flat" alt="Gateway Verification CI"/></a>
    <a href="https://github.com/shashankch/netra-llmgateway/actions/workflows/docs.yml"><img src="https://img.shields.io/github/actions/workflow/status/shashankch/netra-llmgateway/docs.yml?branch=main&label=Docs_CI&logo=githubactions&logoColor=white&labelColor=0B0F19&style=flat" alt="Docs CI"/></a>
  </p>

  <p align="center">
    <a href="#-quickstart-in-60-seconds">Quickstart</a> •
    <a href="#-system-architecture--ingress-topology">Architecture</a> •
    <a href="#-key-architectural-capabilities">Capabilities</a> •
    <a href="#-telemetry-contract--accounting-invariants">Telemetry Contract</a> •
    <a href="https://docs-netrallm.avadhanlabs.dev/">Documentation</a> •
    <a href="docs/api-reference.md">API Reference</a> •
    <a href="docs/openapi.yaml">OpenAPI Spec</a> •
    <a href="docs/SELF-HOSTING.md">Self-Hosting</a> •
    <a href="docs/ROADMAP.md">Roadmap</a>
  </p>

---

## 📖 Overview

**NETRA** (*Sanskrit: नेत्र — Vision / Aperture / Insight*) is an enterprise-grade, sovereign AI Gateway and tenant-isolated Semantic Vector Cache. Sitting in the critical path between client applications and downstream foundation model providers (OpenAI, Anthropic, model aggregators like OpenRouter, self-hosted vLLM clusters), NETRA delivers predictable latency, multi-provider fast-failover, race-safe atomic admission control, and in-JVM vector deduplication.

Built natively on **Java 25 LTS Virtual Threads** and **Spring Boot 4.1.1**, NETRA handles tens of thousands of concurrent connections with minimal memory footprint, sub-0.5ms proxy pass-through overhead, and zero thread pinning.

---

## 🏛️ System Architecture & Ingress Topology

NETRA acts as a non-blocking reverse proxy sitting directly in the critical path between application clients and downstream foundation model providers:

<p align="center">
  <img src="docs/diagrams/00_readme_architecture_dark.svg" alt="NETRA System Architecture Diagram" width="100%">
  <br>
  <em>Figure 1: NETRA End-to-End Request Pipeline &amp; Storage Topology</em>
</p>

---

## ✨ Key Architectural Capabilities

| Capability | Technical Implementation | Production Impact |
|---|---|---|
| **⚡ Virtual Threads Data Plane** | Java 25 LTS Virtual Threads & Scoped Values (JEP 506) | Eliminates OS thread starvation; serves 10,000+ unbuffered streaming SSE sessions with sub-20ms TTFT. |
| **🛡️ Race-Safe Atomic Admission** | Atomic Redis 8.0 Lua scripts with rolling-window ZSETs | Enforces strict RPM and monthly budget caps with **zero over-admission guarantee** under high-concurrency bursts, compliant with standardized IETF RateLimit protocol headers. |
| **🔄 Resilience & Circuit Breakers** | Resilience4j circuit breakers + ordered multi-provider fallback chains | Fast-failover across providers in **<0.05ms** without dead network hops, bounded candidate chain deadline budgets (15s), and small-model refusal auto-escalation. |
| **🧠 Intelligent Prompt Classifier** | Two-stage task instruction signals decoupled from raw token payload | Automatically routes queries to cost-effective (`fast`) or reasoning (`smart`) models with 100% benchmark accuracy (~72.4% cost savings). |
| **💾 Two-Tier Vector Cache** | Tier-1 SHA-256 exact hash near-cache (<0.5ms) + Tier-2 pgvector HNSW (<5ms) | Serves exact repeats and semantic paraphrases at **$0.000000** upstream token cost with cryptographic per-tenant isolation boundaries. |
| **🔌 Phantom Spend Reclaim** | Instant client TCP/HTTP2 stream disconnect detection (`Broken pipe`) | Halts upstream generation in **<2ms**, eliminating 100% of phantom token spend on cancelled or abandoned client sessions. |
| **📊 Exact Micro-Cost Accounting** | Java `BigDecimal` arithmetic scaled to 6 decimal places (`$0.000000 USD`) | Eliminates IEEE-754 floating-point drift; guarantees exact reconciliation between client telemetry headers, ledgers, and live Forex (USD/INR). |
| **⚙️ Canonical Telemetry Contract** | Strict `x-netra-*` and standardized IETF RateLimit headers | Transparent full-stack observability on provider selection, cache tier, failover status, routing rationale, retries, and quota limits. |
| **🖥️ React 19 Ops Console & Sandbox** | React 19 / Vite 6 Ops Console (`console/`) with dark/light themes | Enterprise-grade analytics, live provider health matrix, real-time SSE audit stream, virtual key manager, semantic cache viewer, and high-performance playground with zero-dependency Markdown rendering, copyable code blocks, and Raw inspection toggle. |
| **🌐 Pluggable Multi-Tier Deploy** | Out-of-the-box descriptors for Docker Compose, PaaS, and Cloud VPS | Turnkey 1-click deployment across Railway, Render, Fly.io, OCI Always Free, and AWS Free Tier. |

---

## 🚀 Quickstart in 60 Seconds

### Prerequisites

- Docker Engine & Docker Compose (v2.20+)
- Python 3.9+ (for evaluation & smoke verification scripts)
- Node.js 20+ & npm (for Operations Console UI)
- Java 25 & Gradle 9 (optional for direct native execution)

### 1. Launch Backing Services & Gateway
Launch the complete NETRA stack alongside PostgreSQL 18, Redis 8.0, and upstream providers:

```bash
git clone https://github.com/shashankch/netra-llmgateway.git
cd netra-llmgateway
cp .env.example .env    # Configure upstream keys (OpenRouter / OpenAI) or run with local defaults
make up
```

Verify service readiness:
```bash
curl -f http://localhost:8080/health
# {"status":"ok","service":"netra-gateway","version":"0.7.3"}
```

### 2. Dispatch a Chat Completion
NETRA is a 100% drop-in proxy for `/v1/chat/completions`. Use your existing OpenAI SDK or cURL:

#### Using Python (OpenAI SDK):
```python
from openai import OpenAI

# Direct client to NETRA gateway endpoint
client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="netra-sk-search-1a2b3c"  # Seeded tenant key
)

response = client.chat.completions.create(
    model="fast",  # Or "smart", "auto"
    messages=[{"role": "user", "content": "What is a message queue?"}]
)
print(response.choices[0].message.content)
```

#### Using cURL:
```bash
curl -i -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer netra-sk-search-1a2b3c" \
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

### 3. Stream a Completion via Server-Sent Events (SSE)
Invoke token-by-token unbuffered streaming pass-through over Java 25 Virtual Threads:

```bash
curl -i -N -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer netra-sk-search-1a2b3c" \
  -d '{
    "model": "fast",
    "stream": true,
    "messages": [
      {"role": "user", "content": "Explain event streaming in 3 bullet points."}
    ]
  }'
```

**Streaming Telemetry Headers:**
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream;charset=UTF-8
Cache-Control: no-cache
Connection: keep-alive
x-netra-provider: alpha/alpha-small
x-netra-cache: miss
x-netra-fallback: false
x-netra-route-reason: alias_fast
x-netra-retries: 0

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{"content":"Event"}}]}
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{"content":" streaming..."}}]}
data: [DONE]
```

### 4. Intelligent Routing with 'auto' Alias
Dispatch queries to the `auto` alias; NETRA's two-stage classifier automatically steers queries to the optimal model tier:

```bash
# Complex query automatically routed to 'smart' reasoning model
curl -i -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer netra-sk-research-4d5e6f" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "Prove that the square root of 2 is irrational step by step with mathematical induction."}
    ]
  }'
```

**Routing Telemetry Headers:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
x-netra-provider: alpha/alpha-large
x-netra-cache: miss
x-netra-fallback: false
x-netra-cost-usd: 0.000072
x-netra-route-reason: auto -> smart (score +3.5): +3.5 proof/derivation demand
x-netra-retries: 0
RateLimit-Limit: 300
RateLimit-Remaining: 299
RateLimit-Reset: 60
RateLimit-Policy: 300;w=60
```

### 5. Semantic Vector Cache & $0 Cost Deduplication
Repeat identical or semantically paraphrased prompts; NETRA serves them from the in-JVM ONNX + pgvector HNSW cache with sub-10ms response time and $0.000000 cost:

```bash
# Paraphrased query hits tenant cache above similarity threshold (e.g. 0.92)
curl -i -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer netra-sk-search-1a2b3c" \
  -d '{
    "model": "fast",
    "messages": [
      {"role": "user", "content": "How does a message queue function?"}
    ]
  }'
```

**Cache Hit Telemetry Headers:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
x-netra-provider: alpha/alpha-small
x-netra-cache: hit
x-netra-cache-tier: tier2_semantic
x-netra-fallback: false
x-netra-cost-usd: 0.000000
x-netra-route-reason: semantic_cache_hit
x-netra-retries: 0
RateLimit-Limit: 60
RateLimit-Remaining: 58
RateLimit-Reset: 58
RateLimit-Policy: 60;w=60
```

Inspect cache statistics and hit rates:
```bash
curl -i http://localhost:8080/admin/cache/stats \
  -H "Authorization: Bearer netra-admin-demo"
```

**Cache Statistics Output:**
```json
{
  "total_entries": 1,
  "total_hits": 1,
  "total_misses": 0,
  "hit_rate": 1.00,
  "tier1_exact_hits": 0,
  "tier2_semantic_hits": 1,
  "keys": {
    "netra-sk-search-1a2b3c": {
      "entries": 1,
      "hits": 1,
      "misses": 0,
      "hit_rate": 1.00,
      "tier1_exact_hits": 0,
      "tier2_semantic_hits": 1,
      "similarity_threshold": 0.920,
      "cache_enabled": true
    }
  }
}
```

Inspect live provider health and circuit breaker telemetry:
```bash
curl -i http://localhost:8080/admin/providers/health \
  -H "Authorization: Bearer netra-admin-demo"
```

**Provider Health Telemetry Output:**
```json
[
  {
    "provider": "mock-alpha",
    "circuit_state": "CLOSED",
    "failure_rate": 0.0,
    "slow_call_rate": 0.0,
    "p95_latency_ms": 42.15,
    "total_calls": 24,
    "failed_calls": 0
  }
]
```

### 6. Run Automated Verification & Evaluation Suites
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

### 7. Launch & Serve Operations Console UI
Access the real-time telemetry dashboard, semantic cache inspector, and model playground:

```bash
# Docker Compose (included in make up)
http://localhost:3000

# Standalone Development (Vite hot-reload)
make console-dev        # or: cd console && npm install && npm run dev

# Production Build & Preview Server
make console-build
make console-serve      # or: cd console && npm run preview
```

### 8. Essential Environment Variables

#### Backend Gateway (`.env`)
| Variable | Default / Example | Purpose |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `dev` (or `prod`) | Profile selector: `dev` for local mock providers, `prod` for live upstream providers |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | API key for upstream model aggregator routing (OpenRouter / compatible endpoints) |
| `OPENAI_API_KEY` | `sk-proj-...` | *(Optional)* Direct OpenAI API key if bypassing aggregator |
| `VLLM_BASE_URL` | `http://localhost:8000/v1` | *(Optional)* In-VPC local/private model endpoint (vLLM / Ollama) |
| `NETRA_ADMIN_TOKEN` | `netra-admin-demo` | Bearer token for `/admin/*` control plane and analytics endpoints |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/netra` | PostgreSQL JDBC connection string (auto-resolved in Docker) |
| `SPRING_DATA_REDIS_HOST` | `localhost` | Redis host for atomic rate limiting and admission control |
| `CLOUDFLARE_TUNNEL_TOKEN` | `eyJhIjoi...` | *(Optional)* Zero-Open-Port Cloudflare Tunnel token for ingress |

#### Frontend Operations Console (`console/.env`)
| Variable | Default / Example | Purpose |
|---|---|---|
| `VITE_GATEWAY_URL` | `""` (relative `/` proxy) | Target gateway base URL (e.g. `https://gateway-netrallm.avadhanlabs.dev`) |
| `VITE_BACKEND_TARGET` | `http://localhost:8080` | Backend target used by Vite dev server reverse proxy |

---

## 📡 Telemetry Contract & Accounting Invariants

Every response from `POST /v1/chat/completions` guarantees the presence of standardized telemetry headers:

| Header | Description | Example |
|---|---|---|
| `x-netra-provider` | Upstream provider and model that served the request | `alpha/alpha-small` |
| `x-netra-cache` | Indicates whether the response was served from cache | `hit` or `miss` |
| `x-netra-cache-tier` | Cache tier resolving the response (`tier1_exact` or `tier2_semantic`) | `tier1_exact` |
| `x-netra-fallback` | Indicates if an upstream failover provider was used in the fallback chain | `false` or `true` |
| `x-netra-cost-usd` | Micro-USD cost scaled to 6 decimals ($0.000000 USD) | `0.000011` |
| `x-netra-route-reason` | Rationale for model selection (alias, direct, or classifier score + signals) | `auto -> smart (score +3.5): +3.5 proof` |
| `x-netra-retries` | Number of upstream retry attempts made before successful completion | `0` (or `1`, `2`, `3`) |
| `x-netra-escalated` | Indicates if small-model refusal was auto-escalated to smart reasoning tier | `true` |

### Standardized IETF RateLimit Protocol Headers
| Header | Description | Example |
|---|---|---|
| `RateLimit-Limit` | Maximum request quota configured for the active sliding window | `60` |
| `RateLimit-Remaining` | Remaining requests permitted within the current window | `59` |
| `RateLimit-Reset` | Relative delta in seconds until the active window resets | `60` |
| `RateLimit-Policy` | Quota policy definition conforming to IETF draft (`<limit>;w=<window>`) | `60;w=60` |
| `Retry-After` | Relative delta in seconds before client may retry (emitted on HTTP 429) | `42` |

### Canonical Error Contract
All non-2xx responses strictly adhere to the OpenAI error envelope:

```json
{
  "error": {
    "message": "All upstream providers exhausted for alias fast",
    "type": "upstream_error",
    "code": "upstream_unavailable"
  }
}
```

---

## 🛠️ Developer Automation CLI

The repository includes a comprehensive `Makefile` for developer workflows:

| Command | Action |
|---|---|
| `make dev` | Boots backing services in Docker and launches gateway locally |
| `make up` | Builds and starts full multi-container production stack |
| `make down` | Gracefully tears down containers, networks, and persistent volumes |
| `make test` | Executes Gradle unit and integration test suite (Java 25) |
| `make smoke` | Runs automated smoke verification suite |
| `make routing-eval` | Runs prompt difficulty classifier accuracy benchmark on `data/routing_eval.jsonl` |
| `make cache-eval` | Runs semantic vector cache hit and tenant isolation benchmark |
| `make load` | Runs burst concurrency load test asserting zero over-admission |
| `make chaos` | Runs v2 fault injection, socket abort, and budget drills |
| `make cache-fuzz` | Runs v2 adversarial vector cache and privacy auditor |
| `make stress` | Runs v2 high-concurrency throughput and TTFT benchmark |
| `make verify-all` | Executes complete end-to-end verification harness (v1 + v2) |
| `make console-dev`| Starts React 19 Ops Console in Vite hot-reload development mode |
| `make console-build`| Builds optimized production React 19 Ops Console bundle |
| `make console-serve`| Serves production-built React 19 Ops Console bundle on port 3000 |
| `make docs-serve`| Starts live-reloading developer documentation |
| `make docs-build`| Builds strict static production documentation distribution |

---

## 🌐 Pluggable Multi-Tier Deployment

| Deployment Tier | Infrastructure Target | Configuration Artifact | Live Endpoint / Route |
|---|---|---|---|
| **Tier 1: Local & Sandbox** | Docker Compose Engine | `docker-compose.yml` & `Makefile` | `http://localhost:8080` (API) • `http://localhost:3000` (Console) |
| **Tier 2: Developer PaaS** | Railway, Render, Fly.io, Vercel | `deploy/paas/` (`railway.toml`, `render.yaml`, `fly.toml`, `vercel.json`) | Turnkey auto-assigned HTTPS edge routes |
| **Tier 3: Production Cloud VM & VPS** | AWS EC2, GCP, OCI Compute, Hetzner | `deploy/cloud-vps/setup-vps.sh` | Zero-open-port Cloudflare Zero Trust tunnel |
| **Reference Cloud Ingress** | `avadhanlabs.dev` (Demo / Pre-Prod Reference) | Custom domain DNS / Tunnel mapping | `gateway-netrallm.avadhanlabs.dev` • `console-netrallm.avadhanlabs.dev` • `docs-netrallm.avadhanlabs.dev` |
| **Documentation Site** | GitHub Pages | `zensical.toml` | [docs-netrallm.avadhanlabs.dev](https://docs-netrallm.avadhanlabs.dev/) |

---

## 📚 Technical Documentation & Guides

Comprehensive product documentation, API references, and deployment guides are available in [`docs/`](docs/) and on the [Documentation Site](https://docs-netrallm.avadhanlabs.dev/):

- 🏛️ [System Architecture & Ingress Flow](docs/architecture.md)
- 📋 [Architecture Decision Records (ADRs)](docs/adr.md)
- ⚖️ [Gateway Comparison Matrix](docs/comparison.md)
- 📡 [REST API Reference](docs/api-reference.md)
- 📊 [Verification & Benchmark Report](docs/verification-report.md)
- 🚀 [Self-Hosting & Cloud Deployment Guide](docs/SELF-HOSTING.md)
- 🗺️ [Public Product Roadmap](docs/ROADMAP.md)
- 🛡️ [Security Policy & Vulnerability Reporting](docs/SECURITY.md)
- 🤝 [Contributing Guidelines](docs/CONTRIBUTING.md)

---

## 📄 License & Trademarks

NETRA is open-source software licensed under the [Apache License, Version 2.0](LICENSE).

*All product names, logos, brands, and registered trademarks mentioned are property of their respective owners and used solely for identification purposes.*
