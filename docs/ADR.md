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
