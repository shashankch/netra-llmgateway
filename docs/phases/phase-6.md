# Phase 6: Modern Ops Console UI & E2E Verification Drills

> **Milestone Release:** `v0.6.0`  
> **Status:** Shipped & Verified  
> **Core Deliverables:** React 19 / Vite 6 Ops Console, OpenRouter-Grade Analytics Suite, Single-Denomination Forex Toggle, Evaluator Sandbox, Multi-Tier PaaS Blueprints, and Official Verification Report (`docs/verification-report.md`).

---

## 1. System Architecture Overview

Phase 6 introduces a modern developer operations console and verification sandbox running on **React 19** and **Vite 6** (`dashboard/`), paired with multi-tier PaaS deployment blueprints and end-to-end verification suites.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          NETRA Ops Console (React 19 / Vite 6)                  │
│                                                                                 │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   │
│   │ OpenRouter-Grade    │  │ Evaluator Sandbox   │  │ Virtual Keys &      │   │
│   │ Telemetry Analytics │  │ & Prompt Playground │  │ Multi-Tenant Quotas │   │
│   └──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘   │
└──────────────┼────────────────────────┼────────────────────────┼────────────────┘
               │                        │                        │
       SSE / Polling             /v1/chat/completions      /admin/keys
               │                        │                        │
┌──────────────▼────────────────────────▼────────────────────────▼────────────────┐
│                    NETRA Core Gateway Data & Admin Planes (Port 8080)           │
│                                                                                 │
│   • Java 25 Virtual Threads Ingress & Dispatch                                 │
│   • Redis 8.0 Lua Atomic Sliding-Window Admission (0.00% Over-Admission)       │
│   • In-JVM ONNX all-MiniLM-L6-v2 Dense Embeddings + pgvector HNSW Cache        │
│   • Hybrid Syntactic + Margin-Gated auto Router                                │
│   • Live Forex Engine (USD Base Storage + Single-Denomination UI Toggle)      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. React 19 Ops Console Features (`dashboard/`)

### 2.1 OpenRouter-Grade Analytics Suite
The Operations Console delivers real-time visibility into gateway health, financial burn-down, and traffic routing:

- **5 Headline KPI Cards:**
  - **Total Spend:** Formatted in the active currency selected via the global navbar toggle (USD `$` or INR `₹`).
  - **Total Request Count:** Monitored via atomic Redis Lua counters.
  - **Token Volume Breakdown:** Prompt, completion, and total tokens tracked per model.
  - **Semantic Cache Hit Rate %:** Percentage of requests resolved under 5ms with $0.00 USD upstream cost.
  - **Average Latency / TTFT:** Monotonic millisecond tracking across p50, p90, and p99 percentiles.

- **4 Interactive Telemetry Charts:**
  1. **Model Spend & Volume Trends:** Hourly and daily volume distribution across `fast`, `smart`, and `auto` aliases.
  2. **Smart Router Arbitrage Efficiency:** SVG donut chart and complexity flow illustrating query allocation to Fast vs. Frontier models, highlighting the ~72.4% cost arbitrage savings achieved by margin gating.
  3. **Semantic Cache Waterfall & Cumulative Savings:** Dual area/bar chart displaying direct upstream calls vs. $0 instant cache hits (<5ms), tracking cumulative dollars/rupees saved.
  4. **Latency Percentiles:** Direct comparison of p50, p90, and p99 response durations.

### 2.2 Seamless Dark & Light Theme System
- **Auto-Detection:** Automatically inspects the operating system `prefers-color-scheme: dark | light` on initial visit.
- **Persistent Selection:** User preference is cached in `localStorage` (`netra-theme`).
- **Dark Theme (Default):** Premium obsidian/slate palette (`#090d16` canvas, `#0f172a` cards, `#1e293b` borders, emerald and cyan neon telemetry).
- **Light Theme:** Crisp, high-contrast enterprise white/slate palette (`#ffffff` canvas, `#f8fafc` cards, `#e2e8f0` borders, `#0f172a` slate typography).
- **Zero-Flicker Re-Theming:** 1-click Sun ☀️ / Moon 🌙 toggle in the top navbar swaps tokens dynamically with no page reload.

### 2.3 Single-Denomination Currency Toggle (USD $ | INR ₹)
In accordance with NETRA architectural invariants:
- **Clean USD Database:** Database ledgers strictly record pure USD values (`DECIMAL(12, 6)`).
- **Live Dynamic Forex:** In-memory `ForexRateService` fetches live exchange rates from public forex APIs (Frankfurter) with a 6-hour Caffeine cache and fallback to `87.50`.
- **Single-Denomination UI:** The console displays **only one denomination at a time** (e.g. `$0.000014` or `₹0.0012`), eliminating dual-currency clutter. The top navbar toggle instantly re-renders all KPI cards, chart axes, tables, and budget inputs.

### 2.4 Evaluator Sandbox & Prompt Playground (`/playground`)
The interactive playground allows engineers and evaluators to test all gateway capabilities with zero setup:
- **1-Click Pre-Seeded Accounts:**
  - `Search Team` (`netra-sk-search-1a2b3c`): Semantic cache enabled, 0.920 threshold, 60 RPM.
  - `Research Team` (`netra-sk-research-4d5e6f`): Auto router enabled, cache disabled, 60 RPM.
  - `Free Tier` (`netra-sk-free-7g8h9i`): 10 RPM limit, 0.850 cache threshold (concurrency drill key).
  - `Budget Demo` (`netra-sk-budget-demo-0j1k2l`): $0.00001 cap (Drill 402 key).
- **Evaluation Test Presets:**
  - Paraphrase Pair A (Original & Paraphrase)
  - Paraphrase Pair B (Original & Paraphrase)
  - Near-Miss Query (Rejection test)
  - Complex vs. Simple Auto-Router Queries
- **Live SSE Streaming Typewriter:** Tokens render in real time with unbuffered typewriter animation.
- **Telemetry Badges Bar:** Real-time visual feedback for `x-netra-provider`, `x-netra-cache` (`HIT` / `MISS`), `x-netra-fallback` (`true` / `false`), `x-netra-cost-usd`, `x-netra-route-reason`, `x-netra-retries`, and latency (ms).

### 2.5 Virtual Keys Manager (`/keys`)
- Real-time leaderboard table showing team name, RPM quota, monthly budget burn-down bar, model allowlists, semantic cache status, and similarity threshold.
- Interactive modal to provision new virtual keys or update existing parameters with instantaneous L1 near-cache invalidation.

### 2.6 Live Request Logs Inspector (`/logs`)
- Real-time audit log stream from `GET /admin/logs/stream`.
- Filter by virtual key, HTTP status (200, 429, 402, 401, 502), or text query.
- Expandable rows detailing full JSON payloads, token counts, route reasons, and error types.

---

## 3. Multi-Tier PaaS & Cloud Deployment Blueprints

Phase 6 provides turnkey production deployment configurations:

| Platform | Configuration File | Description |
|---|---|---|
| **Railway** | `deploy/paas/railway.toml` | 1-Click Railway template deploying Gateway + PostgreSQL 18 + Redis 8.0. |
| **Render** | `deploy/paas/render.yaml` | Render Blueprint infrastructure-as-code deploying Web Service + PostgreSQL + Redis. |
| **Fly.io** | `deploy/paas/fly.toml` | Edge microVM deployment with automatic scaling. |
| **Vercel** | `deploy/paas/vercel.json` | 1-Click Vercel frontend deployment with API reverse-proxy rewrite rules. |
| **Cloud VPS** | `deploy/cloud-vps/setup-vps.sh` | Zero-touch bash bootstrap for Oracle Cloud (OCI Always Free) & AWS Free Tier (EC2 `t4g.small`). |
| **Docker Compose** | `docker-compose.yml` | Multi-container stack (Gateway, PostgreSQL 18 with pgvector, Redis 8.0, Mocks, and Dashboard). |

---

## 4. Verification Drills Summary

All official evaluation scripts and drills pass:
1. **Smoke Test (`scripts/smoke_test.py`):** **17 passed, 0 failed, 1 warning** (paraphrases hit, auth rejects, unknown models reject, streaming terminates with `[DONE]`).
2. **Concurrency Load Test (`scripts/load_test.py`):** **0 over-admission** under 10 concurrent threads against 10 RPM limit. Client-side financial sums reconcile with `GET /admin/usage`.
3. **Routing Evaluation (`scripts/run_routing_eval.py`):** **20/20 (100.0%) benchmark accuracy** on `data/routing_eval.jsonl`.
4. **Semantic Cache Benchmark (`scripts/run_cache_eval.py`):** Verified cosine similarity, cross-tenant isolation, and $0 instant cache replay.

For full logs, data reconciliation tables, and architectural trade-off analyses, consult [Verification Report](../verification-report.md).
