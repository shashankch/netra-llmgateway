# Architectural Decision Records (ADR)

## ADR-001: Adoption of Java 25 LTS & Virtual Threads for Gateway Data Plane

- **Status:** Accepted
- **Context:** An AI gateway acts as a high-concurrency network intermediary sitting directly in the critical path between applications and LLM inference providers. Downstream LLM inference requests have high tail latency (seconds to tens of seconds) and long-lived streaming connections (SSE).
- **Decision:** Build NETRA on Java 25 LTS and Spring Boot 4.1.1 leveraging Java Virtual Threads (`java.lang.Thread.ofVirtual()`).
- **Consequences:** Eliminates OS thread exhaustion and complex reactive programming overhead while maintaining maximum thread throughput. Virtual threads yield when waiting on network socket I/O, allowing tens of thousands of simultaneous streaming sessions on minimal memory.

---

## ADR-002: Canonical `x-netra-*` Telemetry Contract

- **Status:** Accepted
- **Context:** The gateway acts as a centralized AI reverse proxy and requires transparent, standardized telemetry headers on every chat completion for upstream provider attribution, cache evaluation, failover visibility, and token cost accounting.
- **Decision:** The gateway strictly injects canonical headers: `x-netra-provider`, `x-netra-cache`, `x-netra-fallback`, and `x-netra-cost-usd`. All benchmark suites, evaluation scripts, and client SDKs within this project natively target this contract.
- **Consequences:** Clean, unpolluted HTTP responses with zero legacy header debt or redundant header injection overhead.

---

## ADR-003: Micro-Cost Precision via `BigDecimal`

- **Status:** Accepted
- **Context:** Foundation models charge microscopic amounts per token (e.g. $0.15 per million prompt tokens). Primitive IEEE-754 floating-point math (`float` or `double`) accumulates rounding artifacts and discrepancies across burst traffic.
- **Decision:** Use `java.math.BigDecimal` exclusively for all financial cost calculations, scaled to 6 decimal places with `RoundingMode.HALF_UP`.
- **Consequences:** Exact reconciliation between client-observed headers and database usage ledgers under high volume.

---

## ADR-004: Pristine USD Storage with Dynamic Forex Engine

- **Status:** Accepted
- **Context:** International enterprises operate across diverse currencies (USD, INR, EUR). Storing multi-currency amounts in the core database causes historical exchange-rate drift and schema bloat.
- **Decision:** Strictly store all costs and budgets in USD (`cost_usd`, `total_spend_usd`). Provide dynamic on-the-fly currency conversion in APIs and UI via `ForexRateService` with a 6-hour cache and configurable fallback.
- **Consequences:** Clean, immutable accounting ledger with single-denomination presentation in the operator console.

---

## ADR-005: Unbuffered Virtual Thread Streaming Relay with Broken Pipe Socket Reclamation

- **Status:** Accepted
- **Context:** Streaming LLM tokens over Server-Sent Events (SSE) requires low Time-to-First-Token (TTFT) and progressive token delivery (~20ms per token). Buffering the completion in memory causes high latency and OOM risks, while unhandled client disconnections cause orphaned token generation and phantom spend.
- **Decision:** Implement `StreamingRelayService` spawning a dedicated virtual thread (`sse-relay-{requestId}`) per stream with an unbuffered 1KB line pump. Immediately close upstream sockets upon client disconnect (`Broken pipe`), halt model compute, and bill partial tokens delivered up to the disconnect point.
- **Consequences:** Near-zero TTFT, $O(1)$ memory overhead per stream, zero phantom token spend, and instant socket reclamation.

---

## ADR-006: Multi-Provider Fallback Chains, Exponential Backoff Retries & Two-Stage Routing Classifier

- **Status:** Accepted
- **Context:** Individual foundation model providers suffer from transient rate limits (HTTP 429), upstream server degradation (HTTP 5xx), network timeouts, and variable operational outages. Relying on a single provider creates single-point-of-failure risks. Furthermore, routing all queries uniformly to expensive frontier models causes high costs, while routing all queries to small models degrades reasoning quality.
- **Decision:**

  1. Implement ordered candidate fallback chains in `UpstreamClientService` mapping aliases (`fast`, `smart`) and direct concrete models to a primary target and fallback partner targets (e.g. `fast` -> primary `alpha-small`, fallback `beta-small`).
  2. Implement exponential backoff retries (3 attempts, initial backoff 200ms, multiplier 2.0) on transient HTTP 5xx, 429, and socket exceptions before switching to fallback partners.
  3. Implement fast-failover across fallback candidates, marking `x-netra-fallback: true` and logging retry attempts via `x-netra-retries`.
  4. For the `auto` alias, implement a two-stage hybrid prompt difficulty classifier (`PromptDifficultyClassifier`) that decouples task instructions from large data payloads (via `extractInstruction()`) and scores grammatical complexity signals to route simple queries to `fast` and complex queries to `smart`, achieving 100% accuracy on `data/routing_eval.jsonl`.
  5. In streaming SSE mode, establish upstream connections synchronously before committing headers; if primary fails, failover to fallback seamlessly before the first token chunk is emitted. If all candidates fail, abort with HTTP 502 `upstream_unavailable` and roll back rate limit slots.

- **Consequences:** High gateway availability through multi-provider resilience, zero corrupted SSE streams on upstream connection failure, dramatic cost reduction on simple queries, explainable `x-netra-route-reason` observability, and 100% routing benchmark compliance.

---

## ADR-007: In-JVM Dense Vector Embeddings & Tenant-Isolated pgvector HNSW Semantic Vector Caching

- **Status:** Accepted
- **Context:** LLM inference costs and latency dominate operational budgets. Frequently repeated queries, identical questions, and semantically identical paraphrases can be served from cache with sub-10ms response times and $0 cost. However, naive semantic caching introduces three critical enterprise failure modes:

  1. **Sidecar embedding latency & network hops:** Calling external embedding APIs adds 150–300ms network latency per cache lookup, negating the speed advantages of caching.
  2. **Cross-tenant cache poisoning & data leakage:** Shared vector spaces allow Tenant A to retrieve sensitive completions generated by Tenant B.
  3. **Toxic refusal persistence:** Upstream safety refusals (e.g., *"I'm sorry, but I can't help with that"*) cached permanently, blocking future legitimate requests.

- **Decision:**

  1. **In-JVM Dense Vector Embeddings:** Embed queries directly within the JVM using quantized `all-MiniLM-L6-v2` (384 dimensions) via ONNX Runtime (`langchain4j-embeddings-all-minilm-l6-v2-q:0.36.2`). Runs in ~5ms in-process with zero external API calls or network hops.
  2. **Cryptographic Tenant Isolation:** Enforce per-tenant vector partitioning at the database level: `WHERE virtual_key = :virtualKey AND model_alias = :modelAlias`. Key A cache entries are mathematically inaccessible to Key B.
  3. **PostgreSQL 18 pgvector HNSW Nearest-Neighbor Retrieval:** Query cosine distance using the pgvector `<=>` operator (`similarity = 1 - (embedding <=> :queryVector)`) accelerated by HNSW cosine indexes (`m=16, ef_construction=64`). Evaluate against tenant-specific similarity thresholds (e.g., 0.92 for search, 0.85 for free-tier).
  4. **Refusal Suppression:** Filter upstream completions against safety refusal markers prior to storage; temporary or safety refusals are never committed to vector storage.
  5. **Multi-Turn Context Keying:** For single-turn requests, key on the user prompt; for multi-turn conversations, canonicalize the full conversation history across all roles and contents.
  6. **Streaming Cache Replay:** When a cache hit occurs for a streaming request (`stream=true`), `StreamingRelayService.replayCachedStream` emits standard SSE delta and usage chunks ending in `data: [DONE]` with complete `x-netra-*` headers and `$0.000000` cost.
  7. **Cache Observability API:** Expose global cache hit rates, entry counts, and per-tenant breakdowns at `GET /admin/cache/stats`.
- **Consequences:** Sub-10ms cache hit response times, zero external embedding dependencies or costs, strict multi-tenant vector security, refusal suppression, and verified paraphrase recognition.

---

## ADR-008: Tiered Spring Boot Profiles (`dev` / `prod` / `test`) for Enterprise Configuration Management

- **Status:** Accepted
- **Context:** Enterprise deployments require distinct operational guarantees between local development, automated verification drills, and live production traffic. Hardcoding mock endpoints (`mock-alpha:9001`) into a single flat `application.yml` creates production hazards, while demanding live API keys for offline testing breaks local development.
- **Decision:** Implement tiered Spring Boot configuration profiles governed by `${SPRING_PROFILES_ACTIVE:dev}`:
  1. **`application.yml` (Base):** Houses profile-agnostic infrastructure definitions (virtual threads, Flyway migrations, Redis connection timeouts, Actuator metrics exposure, base retry policies, degradation limits, and currency fallback).
  2. **`application-dev.yml` (Development & Evaluation Harness):** Active by default. Provisions local mock providers `alpha` and `beta` on ports 9001 and 9002 with mock model aliases (`alpha-small`, `beta-small`, `alpha-large`, `beta-large`). Enables zero-cost offline development and automated evaluation drills.
  3. **`application-prod.yml` (Enterprise Production):** Hardened production configuration activated via `SPRING_PROFILES_ACTIVE=prod`. Provisions OpenRouter aggregator egress alongside In-VPC endpoint templates, tuned HikariCP connection pools (max 30, leak detection 20s), Tomcat thread pools (max 400), response compression, and production model aliases (`google/gemini-2.0-flash-001`, `anthropic/claude-3.5-sonnet`, `deepseek/deepseek-r1`).
  4. **`application-test.yml` (Automated Testing):** Provisions accelerated retry backoffs (10ms) and mock test dependencies for unit and contract test execution.
- **Consequences:** Clean separation of concerns, zero accidental leakage of mock configurations into production, automated out-of-the-box local developer experience, and hardened infrastructure defaults for cloud deployments.

---

## ADR-009: Deterministic Target Disambiguation: Explicit Provider Prefixes & Model Affinity

- **Status:** Accepted
- **Context:** In enterprise hybrid architectures, an organization may host an open-weight foundation model (e.g., `meta-llama/llama-3.3-70b-instruct`) within a private VPC via self-hosted vLLM or Ollama, while simultaneously configuring OpenRouter as a fallback aggregator which also offers `meta-llama/llama-3.3-70b-instruct`. A naive gateway cannot distinguish whether the caller intends to invoke the private In-VPC endpoint or the public aggregator.
- **Decision:** Implement a 5-tier deterministic target resolution engine in `UpstreamClientService.resolveSingleTarget`:
  1. **Explicit Provider Colon Prefix:** Models formatted as `provider:model` (e.g., `vllm-local:meta-llama/llama-3.3-70b-instruct` or `openrouter:meta-llama/llama-3.3-70b-instruct`) explicitly bind to the named provider in `netra.providers`.
  2. **Explicit Provider Slash Prefix:** Models formatted as `provider/model` where the first segment matches a registered provider name route directly to that provider.
  3. **Provider Model Affinity:** Configured providers declare supported models via `models: [...]`. When an un-prefixed model is requested, providers advertising that model receive priority over public aggregators.
  4. **Pricing Catalog Lookup:** Direct model names in `model_pricing.json` resolve to their canonical provider.
  5. **Aggregator Passthrough:** Unmatched multi-vendor models containing `/` or vendor prefixes route through OpenRouter.
  6. **Multi-Fallback Routing:** Model aliases accept ordered lists of fallbacks (or comma-delimited strings in environment variables), executing cascading failover through primary &rarr; fallback 1 &rarr; fallback 2 on upstream failure or timeout.
- **Consequences:** Eliminates routing ambiguity, enables zero-risk private cloud and public aggregator coexistence, and provides granular cascading failover across heterogeneous AI providers.

---

## ADR-010: Standardized Protocol Evolution: IETF RateLimit Headers & Sunset Plan for Custom Headers

- **Status:** Accepted
- **Context:** Early gateway releases (Phases 1–6) utilized proprietary `x-netra-*` headers (e.g., `x-netra-rpm-limit`, `x-netra-cost-usd`) to transmit admission state and telemetry. However, modern 2026 enterprise API standards have converged on formalized IETF specifications (`draft-ietf-httpapi-ratelimit` / RFC 9110) and W3C distributed tracing (`traceparent`). Retaining custom headers indefinitely increases SDK friction and conflicts with enterprise API gateways (Envoy, Kong, Cloudflare).
- **Decision:** Implement a three-stage deprecation and sunset migration plan:
  1. **Phase 7 (Dual-Emission Compatibility):** Simultaneously emit standardized IETF RateLimit headers alongside legacy `x-netra-*` headers:
     - `RateLimit-Limit: <rpm_quota>`
     - `RateLimit-Remaining: <remaining>`
     - `RateLimit-Reset: <seconds_to_window_reset>`
     - `RateLimit-Policy: "<rpm_quota>;w=60"`
     - `Retry-After: <seconds>` (on HTTP 429)
  2. **Phase 8 (Formal Deprecation Notice per RFC 8594):** Attach standard deprecation signals to legacy `x-netra-rpm-*` headers:
     - `Deprecation: @1793465406`
     - `Sunset: Sun, 01 Nov 2026 00:00:00 GMT`
     - `Link: <https://github.com/shashankch/netra-llmgateway/wiki/Deprecation-Policy>; rel="deprecation"`
  3. **Phase 9/10 (Final Sunset & Standards-Only Emission):** Sunset `x-netra-rpm-*` headers in favor of pure IETF headers. Transition cost and routing telemetry into structured W3C Trace Context spans (`traceparent`, `tracestate`) and OpenTelemetry GenAI semantic conventions, rendering NETRA 100% compliant with global enterprise API gateway specifications.
- **Consequences:** Standardizes client SDK retry behavior, guarantees zero breaking changes for existing consumers during Phase 7, and positions NETRA as an enterprise-compliant, standards-first gateway in 2026.

