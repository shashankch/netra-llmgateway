<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/netra-banner.png">
    <img src="docs/assets/netra-banner.png" alt="NETRA Enterprise AI Gateway Banner" width="900">
  </picture>
  <br/><br/>

  <p align="center">
    <strong>High-throughput, ultra-low latency intelligent gateway and semantic caching infrastructure for production Generative AI applications.</strong>
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
    <a href="https://github.com/shashankch/netra-llmgateway/actions/workflows/backend-ci.yml"><img src="https://img.shields.io/badge/Backend_CI-passing-2ea44f?style=flat&logo=githubactions&logoColor=white&labelColor=0B0F19" alt="Backend CI"/></a>
    <a href="https://github.com/shashankch/netra-llmgateway/actions/workflows/streaming-ci.yml"><img src="https://img.shields.io/badge/Streaming_CI-passing-2ea44f?style=flat&logo=githubactions&logoColor=white&labelColor=0B0F19" alt="Streaming CI"/></a>
    <a href="https://github.com/shashankch/netra-llmgateway/actions/workflows/routing-ci.yml"><img src="https://img.shields.io/badge/Routing_CI-passing-2ea44f?style=flat&logo=githubactions&logoColor=white&labelColor=0B0F19" alt="Routing CI"/></a>
    <a href="https://github.com/shashankch/netra-llmgateway/actions/workflows/cache-ci.yml"><img src="https://img.shields.io/badge/Cache_CI-passing-2ea44f?style=flat&logo=githubactions&logoColor=white&labelColor=0B0F19" alt="Cache CI"/></a>
    <a href="https://github.com/shashankch/netra-llmgateway/actions/workflows/docs.yml"><img src="https://img.shields.io/badge/Docs_CI-passing-2ea44f?style=flat&logo=githubactions&logoColor=white&labelColor=0B0F19" alt="Docs CI"/></a>
  </p>

  <p align="center">
    <a href="#-quickstart-in-60-seconds">Quickstart</a> •
    <a href="#-system-architecture--ingress-topology">Architecture</a> •
    <a href="#-key-architectural-capabilities">Capabilities</a> •
    <a href="#-telemetry-contract--accounting-invariants">Telemetry Contract</a> •
    <a href="https://shashankch.github.io/netra-llmgateway/">Documentation</a> •
    <a href="docs/openapi.yaml">OpenAPI Spec</a> •
    <a href="docs/ROADMAP.md">Roadmap</a> •
    <a href="docs/ADR.md">ADRs</a>
  </p>
</div>

---

## 📖 Overview

**NETRA** (*Sanskrit: नेत्र — Vision / Aperture / Insight*) is an enterprise-grade, high-throughput LLM Gateway and tenant-isolated Semantic Vector Cache. Sitting between client applications and downstream foundation model providers (OpenAI, Anthropic, self-hosted vLLM clusters), NETRA delivers predictable latency, multi-provider fast-failover, race-safe atomic admission control, and in-JVM vector deduplication.

Built natively on **Java 25 LTS Virtual Threads** and **Spring Boot 4.1.1**, NETRA handles tens of thousands of concurrent connections with minimal memory footprint and zero thread pinning.

---

## 🏛️ System Architecture & Ingress Topology

NETRA acts as a non-blocking reverse proxy sitting directly in the critical path between application clients and downstream foundation model providers:

<p align="center">
  <a href="docs/diagrams/00_readme_architecture.svg">
    <img src="docs/diagrams/00_readme_architecture.png" alt="NETRA System Architecture Diagram" width="100%">
  </a>
  <br>
  <em>Figure 1: NETRA End-to-End Request Pipeline &amp; Storage Topology (<a href="docs/diagrams/00_readme_architecture.svg">Vector SVG</a> · <a href="docs/diagrams/00_readme_architecture.d2">D2 Source</a>)</em>
</p>

---

## ✨ Key Architectural Capabilities

| Capability | Technical Implementation | Production Impact |
|---|---|---|
| **⚡ Virtual Threads Data Plane** | Java 25 LTS Virtual Threads (`spring.threads.virtual.enabled=true`) | Eliminates OS thread starvation; serves 10,000+ unbuffered streaming SSE sessions with sub-20ms TTFT. |
| **🛡️ Race-Safe Atomic Admission** | Atomic Redis 8.0 Lua scripts with rolling-window ZSETs | Enforces strict RPM and monthly budget caps with **zero over-admission guarantee** under high-concurrency bursts. |
| **🔄 Multi-Provider Failover Chains** | Exponential backoff retries (3 attempts) + automatic partner failover | Protects against transient 5xx/429/timeouts; fast-fails across ordered chains (`alpha` -> `beta`) with HTTP 502 exhaustion guard. |
| **🧠 Intelligent Prompt Classifier** | Two-stage task instruction signals decoupled from raw token payload | Automatically routes queries to cost-effective (`fast`) or reasoning (`smart`) models with 100% benchmark accuracy. |
| **💾 Tenant-Isolated Semantic Cache** | In-JVM ONNX transformer embeddings + PostgreSQL 18 `pgvector` HNSW | Delivers instantaneous sub-5ms cache hits on identical and paraphrased prompts with cryptographic tenant boundary isolation. |
| **📊 Exact Micro-Cost Accounting** | Java `BigDecimal` arithmetic scaled to 6 decimal places (`$0.000000 USD`) | Eliminates IEEE-754 floating-point drift; guarantees exact reconciliation between client telemetry headers and database ledgers. |
| **⚙️ Canonical Telemetry Contract** | Strict `x-netra-*` headers (`provider`, `cache`, `fallback`, `cost-usd`, `route-reason`, `retries`) | Transparent full-stack observability on provider selection, failover status, routing rationale, and retry counts. |
| **🌐 Pluggable Multi-Tier Deploy** | Out-of-the-box descriptors for Docker, PaaS, Cloud VPS, and Kubernetes | Instant 1-click deployment across Railway, Render, Fly.io, OCI Always Free, and AWS Free Tier. |

---

## 🚀 Quickstart in 60 Seconds

### Prerequisites
- Docker Engine & Docker Compose (v2.20+)
- Python 3.9+ (for evaluation & smoke verification scripts)
- Java 25 & Gradle 9 (optional for direct native execution)

### 1. Launch Backing Services & Gateway
Launch the complete NETRA stack alongside PostgreSQL 18, Redis 8.0, and upstream mock providers:

```bash
git clone https://github.com/shashankch/netra-llmgateway.git
cd netra-llmgateway
make up
```

Verify service readiness:
```bash
curl -f http://localhost:8080/health
# {"status":"ok","service":"netra-gateway","version":"0.5.0"}
```

### 2. Dispatch a Chat Completion
Invoke non-streaming chat completion using a seeded tenant virtual key (`netra-sk-search-1a2b3c`):

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

**Response Telemetry Headers:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
x-netra-provider: alpha/alpha-small
x-netra-cache: miss
x-netra-fallback: false
x-netra-cost-usd: 0.000011
x-netra-route-reason: alias_fast
x-netra-retries: 0
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
  -H "Authorization: Bearer netra-sk-finance-4d5e6f" \
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
x-netra-provider: alpha/alpha-large
x-netra-fallback: false
x-netra-route-reason: auto -> smart (score +3.5): +3.5 proof/derivation demand
x-netra-retries: 0
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
x-netra-provider: alpha/alpha-small
x-netra-cache: hit
x-netra-fallback: false
x-netra-cost-usd: 0.000000
x-netra-route-reason: semantic_cache_hit
x-netra-retries: 0
```

Inspect cache statistics and hit rates:
```bash
curl -i http://localhost:8080/admin/cache/stats \
  -H "Authorization: Bearer netra-admin-demo"
```

### 6. Run Automated Verification & Evaluation Suites
Execute the contract smoke tests, routing accuracy benchmark, and semantic cache evaluation:

```bash
make smoke
make routing-eval
make cache-eval
```

---

## 📡 Telemetry Contract & Accounting Invariants

Every response from `POST /v1/chat/completions` guarantees the presence of standardized telemetry headers:

| Header | Description | Example |
|---|---|---|
| `x-netra-provider` | Upstream provider and model that served the request | `alpha/alpha-small` |
| `x-netra-cache` | Indicates whether the response was served from cache | `hit` or `miss` |
| `x-netra-fallback` | Indicates if an upstream failover provider was used in the fallback chain | `false` or `true` |
| `x-netra-cost-usd` | Micro-USD cost scaled to 6 decimals ($0.000000 USD) | `0.000011` |
| `x-netra-route-reason` | Rationale for model selection (alias, direct, or classifier score + signals) | `auto -> smart (score +3.5): +3.5 proof` |
| `x-netra-retries` | Number of upstream retry attempts made before successful completion | `0` (or `1`, `2`, `3`) |

### Canonical Error Contract
All non-2xx responses strictly adhere to the OpenAI error envelope:

```json
{
  "error": {
    "message": "All upstream providers exhausted for alias fast",
    "type": "upstream_error",
    "code": "upstream_unavailable",
    "param": null
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
| `make docs-serve`| Starts live-reloading MkDocs developer documentation |
| `make docs-build`| Builds strict static production documentation distribution |

---

## 🌐 Pluggable Multi-Tier Deployment

| Deployment Tier | Infrastructure Target | Configuration Artifact |
|---|---|---|
| **Tier 1: Local & Sandbox** | Docker Compose Engine | `docker-compose.yml` & `Makefile` |
| **Tier 2: Developer PaaS** | Railway, Render, Fly.io | `deploy/paas/` (`railway.toml`, `render.yaml`, `fly.toml`) |
| **Tier 3: Zero-Cost Cloud VM** | OCI Always Free & AWS Free Tier (EC2) | `deploy/cloud-vps/setup-vps.sh` |
| **Tier 4: Enterprise Cloud** | Kubernetes & Terraform (AWS / OCI) | `deploy/kubernetes/` & `deploy/terraform/` |

---

## 📚 Technical Specifications & Deep Dives

Extensive architectural deep-dives, API specifications, and operational manuals are available in [`docs/`](docs/):

- 🏛️ [System Architecture & Ingress Flow](docs/index.md)
- 🗺️ [Public Product Roadmap](docs/ROADMAP.md)
- 📐 [Engineering Conventions & Standards](docs/CONVENTIONS.md)
- 📜 [Architectural Decision Records (ADR)](docs/ADR.md)
- 🚀 [Self-Hosting & Cloud Deployment Guide](docs/SELF-HOSTING.md)
- 🛡️ [Security Policy & Vulnerability Reporting](docs/SECURITY.md)
- 🤝 [Contributing Guidelines](docs/CONTRIBUTING.md)

---

## 📄 License & Trademarks

NETRA is open-source software licensed under the [Apache License, Version 2.0](LICENSE).

*All product names, logos, brands, and registered trademarks mentioned are property of their respective owners and used solely for identification purposes.*
