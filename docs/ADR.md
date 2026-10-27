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

