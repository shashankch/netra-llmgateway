# NETRA REST API Reference

The NETRA LLM Gateway provides an OpenAI-compatible REST API at `/v1/chat/completions` alongside platform health and operations endpoints.

An OpenAPI 3.1.0 specification is maintained directly at [`docs/openapi.yaml`](openapi.yaml).

### Base URLs

| Environment | Base URL | Description |
|---|---|---|
| **Production Cloud Gateway** | `https://gateway-netrallm.avadhanlabs.dev` | Live production data plane |
| **Local Docker Development** | `http://localhost:8080` | Local container environment |

---

## 1. Authentication

All data plane endpoints require a valid tenant Virtual API Key supplied via the HTTP `Authorization` header:

```http
Authorization: Bearer netra-sk-search-1a2b3c
```

| Virtual Key Prefix | Team / Role | RPM Limit | Monthly Budget | Description |
|---|---|---|---|---|
| `netra-sk-search-*` | search | 60 RPM | $50.00 | High-frequency query parsing |
| `netra-sk-research-*` | research | 300 RPM | $500.00 | Deep reasoning & smart tier models |
| `netra-sk-free-*` | free-tier | 10 RPM | $5.00 | Rate-limit testing baseline |
| `netra-sk-budget-demo-*` | budget-demo | 60 RPM | $0.00001 | Budget exhaustion demo key |

---

## 2. Ingress Endpoints

### `POST /v1/chat/completions`

Creates a model response for the given chat conversation. Supports both non-streaming JSON responses and streaming Server-Sent Events (SSE).

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <virtual-key>` |
| `Content-Type` | string | **Yes** | `application/json` |

#### Request Body
```json
{
  "model": "fast",
  "messages": [
    {
      "role": "user",
      "content": "Explain vector embeddings in one sentence."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 100,
  "stream": false
}
```

#### Canonical Telemetry Response Headers
Every successful response from NETRA includes canonical telemetry headers:

| Header | Example | Description |
|---|---|---|
| `x-netra-provider` | `alpha/alpha-small` | Upstream provider and concrete model that served the request. |
| `x-netra-cache` | `miss` | Indicates whether the response was served from semantic cache (`hit` or `miss`). |
| `x-netra-cache-tier` | `tier1_exact` | Cache tier that fulfilled the query (`tier1_exact` for sub-0.5ms SHA-256 hash or `tier2_semantic` for pgvector HNSW). |
| `x-netra-fallback` | `false` | `true` if primary provider failed and failover model was invoked. |
| `x-netra-cost-usd` | `0.000015` | Exact request cost in USD calculated to 6 decimal places ($0.000000). *(Omitted on streaming responses upfront per contract)* |
| `x-netra-route-reason` | `alias_direct` | Decision rationale applied by the dynamic model router. |
| `x-netra-retries` | `0` | Number of upstream network retries executed. |
| `x-netra-escalated` | `true` | Emitted when a small-model refusal was automatically escalated to the smart reasoning tier. |

#### Standardized IETF RateLimit Protocol Headers (`draft-ietf-httpapi-ratelimit-headers`)
In full compliance with modern enterprise API standards, NETRA emits standardized rate-limiting headers on all responses:

| Header | Example | Description |
|---|---|---|
| `RateLimit-Limit` | `60` | Maximum request quota configured for the active sliding window. |
| `RateLimit-Remaining` | `57` | Remaining requests permitted within the current window. |
| `RateLimit-Reset` | `42` | Relative delta in seconds until the active window resets (immune to clock drift). |
| `RateLimit-Policy` | `60;w=60` | Quota policy definition in format `<limit>;w=<window_seconds>`. |
| `Retry-After` | `42` | Relative delta in seconds before client may retry (emitted on HTTP 429). |

#### Streaming Server-Sent Events (SSE)
Setting `"stream": true` switches the gateway into unbuffered pass-through mode over Java 25 Virtual Threads. Response headers are sent immediately:

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

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1729891200,"model":"alpha-small","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1729891200,"model":"alpha-small","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":1,"total_tokens":6}}

data: [DONE]
```

---

## 3. Operations & Admin Endpoints

### `GET /health` & `GET /health/live`

Basic service ping and container liveness probe. Returns operational status and active gateway version. To inspect automated build verification on `main`, see [GitHub Actions CI](https://github.com/shashankch/netra-llmgateway/actions/workflows/gateway-ci.yml).

```json
{
  "status": "ok",
  "service": "netra-gateway",
  "version": "0.7.0"
}
```

---

### `GET /health/ready`

Deep synthetic readiness probe for Kubernetes and container PaaS environments. Verifies live PostgreSQL connectivity (`conn.isValid(1)`) and Redis cluster availability (`conn.ping()`).

#### Response (200 OK — Ready to Serve Traffic)
```json
{
  "status": "UP",
  "database": "UP",
  "redis": "UP",
  "seeder": "READY",
  "version": "0.7.0"
}
```

#### Response (503 Service Unavailable — Backing Service Degraded)
```json
{
  "status": "DEGRADED",
  "database": "DOWN",
  "redis": "UP",
  "version": "0.7.0"
}
```

---

### `GET /admin/usage`

Aggregated spend and token consumption per virtual key over a date window. Reconciles exactly with client-side verification script totals.

#### Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | No | Virtual API key to filter usage for (defaults to all tenants). |
| `from` | string (YYYY-MM-DD) | No | Start date (defaults to 1st of current month). |
| `to` | string (YYYY-MM-DD) | No | End date (defaults to today). |

#### Request Header
```http
Authorization: Bearer netra-admin-demo
```

#### Response (200 OK)
```json
{
  "key": "netra-sk-search-1a2b3c",
  "from": "2026-10-01",
  "to": "2026-10-24",
  "requests": 412,
  "prompt_tokens": 18734,
  "completion_tokens": 9211,
  "cost_usd": 0.014100,
  "cache_hits": 96
}
```

---

### `GET /admin/logs`

Chronological audit log entries, newest first, including all rejected requests (401, 403, 404, 429, 402, 502) and successful calls.

#### Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | No | Optional virtual API key filter. |
| `status` | string / integer | No | Optional status code filter (e.g. `200`, `429`, `401`, `502`) or error filter (`ERR`). |
| `search` | string | No | Case-insensitive search across request ID, virtual key, model, and route reason. |
| `limit` | integer | No | Maximum log records returned (default 50, max 500). |
| `page` | integer | No | Zero-indexed page number for pagination (default 0). |
| `offset` | integer | No | Zero-indexed record offset for cursor/offset pagination. |

#### Request Header
```http
Authorization: Bearer netra-admin-demo
```

#### Response (200 OK)
```json
[
  {
    "id": "e02063df-3396-4231-9106-a13dc694e907",
    "request_id": "req_1a2b3c4d5e6f",
    "virtual_key": "netra-sk-search-1a2b3c",
    "requested_model": "fast",
    "resolved_provider": "alpha",
    "resolved_model": "alpha-small",
    "status": "ok",
    "status_code": 200,
    "prompt_tokens": 12,
    "completion_tokens": 48,
    "cost_usd": 0.000015,
    "cache": "miss",
    "fallback": false,
    "route_reason": "alias_direct",
    "retries": 0,
    "latency_ms": 32,
    "is_stream": false,
    "escalated": false,
    "cache_tier": "tier1_exact",
    "error_type": null,
    "created_at": "2026-10-24T15:00:00Z"
  }
]
```

### `GET /admin/cache/stats`

Returns aggregate semantic vector cache hit rates, entry counts, and per-tenant cryptographic isolation breakdowns.

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <admin-secret>` |

#### Response (200 OK)
```json
{
  "total_entries": 150,
  "total_hits": 120,
  "total_misses": 30,
  "hit_rate": 0.80,
  "tier1_exact_hits": 45,
  "tier2_semantic_hits": 75,
  "keys": {
    "netra-sk-search-1a2b3c": {
      "entries": 150,
      "hits": 120,
      "misses": 30,
      "hit_rate": 0.80,
      "tier1_exact_hits": 45,
      "tier2_semantic_hits": 75,
      "similarity_threshold": 0.920,
      "cache_enabled": true
    }
  }
}
```

---

### `GET /admin/cache/entries`

Inspects stored semantic and exact cache completions, query prompts, models, hit frequencies, and timestamps. Filterable by virtual key namespace and prompt substring.

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <admin-secret>` |

#### Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | No | Tenant virtual key namespace (e.g. `netra-sk-search-1a2b3c`) |
| `search` | string | No | Search query matching prompt text or model alias |
| `limit` | integer | No | Maximum entries returned (default: 50, max: 200) |
| `page` | integer | No | Zero-based page number (default: 0) |
| `offset` | integer | No | Zero-based cursor offset (takes precedence over page) |

#### Response (200 OK)
```json
[
  {
    "id": "7f8b9a2c-1d3e-4f5a-8b9c-0d1e2f3a4b5c",
    "virtual_key": "netra-sk-search-1a2b3c",
    "model_alias": "fast",
    "prompt_text": "Explain what load balancers do in distributed web systems.",
    "resolved_provider": "openrouter/openai/gpt-4o-mini",
    "completion_text": "Load balancers distribute incoming network traffic across a farm of backend servers.",
    "response_json": "{\"choices\":[{\"message\":{\"content\":\"Load balancers distribute...\"}}]}",
    "hit_count": 18,
    "created_at": "2026-10-24T14:30:00Z",
    "last_hit_at": "2026-10-24T15:12:00Z",
    "similarity_threshold": 0.920,
    "tier": "tier2_semantic"
  }
]
```

---

### `DELETE /admin/cache/entries/{id}`

Evicts a cached completion entry by UUID from both PostgreSQL `pgvector` storage and in-memory caches.

#### Path Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string (UUID) | **Yes** | Unique cache entry identifier. |

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <admin-secret>` |

#### Response (200 OK)
```json
{
  "success": true,
  "id": "7f8b9a2c-1d3e-4f5a-8b9c-0d1e2f3a4b5c"
}
```

---

### `GET /admin/keys`

Returns all configured virtual keys, active RPM quotas, monthly budget caps, current monthly spend, allowlists, and real-time status (`ACTIVE`, `EXHAUSTED`, `REVOKED`).

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <admin-secret>` |

#### Response (200 OK)
```json
[
  {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "virtual_key": "netra-sk-search-1a2b3c",
    "team": "Search Team",
    "monthly_budget_usd": 100.000000,
    "current_spend_usd": 14.250000,
    "rpm_limit": 60,
    "tpm_limit": 100000,
    "model_allowlist": ["fast", "smart", "auto"],
    "semantic_cache_enabled": true,
    "similarity_threshold": 0.920,
    "is_active": true,
    "status": "ACTIVE",
    "created_at": "2026-10-24T12:00:00Z"
  }
]
```

---

### `POST /admin/keys`

Provisions a new virtual API key for a tenant or application with automated near-cache seeding.

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <admin-secret>` |
| `Content-Type` | string | **Yes** | `application/json` |

#### Request Body
```json
{
  "virtual_key": "netra-sk-finance-demo",
  "team": "Finance Core",
  "rpm_limit": 60,
  "monthly_budget_usd": 250.00,
  "model_allowlist": ["fast", "smart", "auto"],
  "semantic_cache_enabled": true,
  "similarity_threshold": 0.880
}
```

---

### `PUT /admin/keys/{id}`

Updates an existing virtual API key's quotas, allowlists, cache configuration, or active state.

#### Path Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string (UUID) | **Yes** | Unique tenant record identifier. |

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <admin-secret>` |
| `Content-Type` | string | **Yes** | `application/json` |

#### Request Body
```json
{
  "rpm_limit": 120,
  "monthly_budget_usd": 500.00,
  "model_allowlist": ["fast", "smart", "auto"],
  "semantic_cache_enabled": true,
  "similarity_threshold": 0.900,
  "is_active": true
}
```

#### Response (200 OK)
Returns the updated tenant record (`TenantAdminResponse`).

---

### `DELETE /admin/keys/{id}`

Revokes an active virtual API key. Subsequent completion requests from this key return HTTP 401 Unauthorized (`invalid_api_key`).

#### Path Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string (UUID) | **Yes** | Unique tenant record identifier. |

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <admin-secret>` |

#### Response (204 No Content)
Returns empty body upon successful revocation.

---

### `POST /admin/logs/stream-ticket`

Issues a short-lived (60-second), cryptographically generated single-use ticket (`stk-*`) for authenticating browser `EventSource` connections without leaking static admin credentials in query parameters.

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <admin-secret>` |

#### Response (200 OK)
```json
{
  "ticket": "stk-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "expires_in": 60
}
```

---

### `GET /admin/logs/stream`

Real-time Server-Sent Events (SSE) stream broadcasting newly recorded audit log entries and rejections as they occur.

#### Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `ticket` | string | No | Single-use ticket obtained from `POST /admin/logs/stream-ticket` (Recommended for browser `EventSource`). |
| `token` | string | No | *Deprecated:* Admin secret query token. Use `ticket` or `Authorization` header instead. |

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | No | `Bearer <admin-secret>` (Alternative to `ticket`). |

#### Stream Event Output (`text/event-stream`)
```http
event: connected
data: connected to NETRA live log stream

event: log
data: {"request_id":"req_1a2b3c","virtual_key":"netra-sk-search","requested_model":"fast","status_code":200,"latency_ms":32,"cost_usd":0.000014}
```

---

### `GET /admin/currency/rate`

Returns the active live USD to INR exchange rate with dynamic fallback.

#### Response (200 OK)
```json
{
  "base": "USD",
  "target": "INR",
  "rate": 85.00
}
```

---

### `GET /admin/pricing`

Returns configured model aliases, active pricing rates per 1M tokens, fallback chains, and foundation model catalogs.

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <admin-secret>` |

#### Response (200 OK)
```json
{
  "aliases": {
    "fast": {
      "primary": "alpha-small",
      "fallbacks": ["beta-small", "openai/gpt-4o-mini"],
      "input_per_1m": 0.15,
      "output_per_1m": 0.60,
      "provider": "alpha"
    },
    "smart": {
      "primary": "alpha-large",
      "fallbacks": ["beta-large", "anthropic/claude-3.5-sonnet"],
      "input_per_1m": 3.00,
      "output_per_1m": 12.00,
      "provider": "alpha"
    },
    "auto": {
      "primary": "alpha-small",
      "fallbacks": ["beta-small", "alpha-large", "beta-large"],
      "route_by_difficulty": {
        "simple": "fast",
        "complex": "smart"
      },
      "input_per_1m": 0.15,
      "output_per_1m": 0.60,
      "provider": "alpha"
    }
  },
  "models": [
    {
      "model": "alpha-small",
      "provider": "alpha",
      "input_per_1m": 0.15,
      "output_per_1m": 0.60
    },
    {
      "model": "alpha-large",
      "provider": "alpha",
      "input_per_1m": 3.00,
      "output_per_1m": 12.00
    }
  ]
}
```

---

### `GET /admin/providers/health`

Exposes live provider health snapshots, sliding-window latency profiles, and automated circuit breaker telemetry.

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | string | **Yes** | `Bearer <admin-secret>` |

#### Response (200 OK)
```json
[
  {
    "provider": "alpha",
    "status": "HEALTHY",
    "circuit_state": "CLOSED",
    "failure_rate": 0.0,
    "slow_call_rate": 0.0,
    "buffered_calls": 20,
    "successful_calls": 20,
    "failed_calls": 0,
    "slow_calls": 0,
    "p95_latency_ms": 24
  },
  {
    "provider": "beta",
    "status": "HEALTHY",
    "circuit_state": "CLOSED",
    "failure_rate": 0.0,
    "slow_call_rate": 0.0,
    "buffered_calls": 15,
    "successful_calls": 15,
    "failed_calls": 0,
    "slow_calls": 0,
    "p95_latency_ms": 28
  }
]
```

!!! note "Provider Startup Latency Samples"
    `p95_latency_ms` is `null` when a provider is in a cold state before latency samples have been recorded.

---

## 4. Error Response Contract

Every error or rejection returned by NETRA strictly adheres to OpenAI JSON error standards:

```json
{
  "error": {
    "message": "Monthly budget of $5.00 exhausted for this key",
    "type": "budget_exceeded",
    "code": "budget_exceeded"
  }
}
```

| HTTP Status | Error `type` | Error `code` | Description / Trigger Case |
|---|---|---|---|
| `400 Bad Request` | `invalid_request_error` | `invalid_request` | Missing body, empty `messages` array, or malformed JSON. |
| `401 Unauthorized` | `authentication_error` | `invalid_api_key` | Missing, unrecognized, or deactivated `netra-sk-*` virtual key. |
| `403 Forbidden` | `model_not_allowed` | `model_not_allowed` | Requested model is not on the virtual key's allowlist. |
| `404 Not Found` | `not_found_error` | `model_not_found` | Model alias or provider model does not exist in gateway catalog. |
| `429 Too Many Requests` | `rate_limit_exceeded` | `rate_limit_exceeded` | Atomic sliding-window RPM limit breached in Redis 8.0 Lua engine. |
| `402 Payment Required` | `budget_exceeded` | `budget_exceeded` | Tenant's monthly USD budget cap exhausted. |
| `502 Bad Gateway` | `upstream_error` | `upstream_unavailable` | All configured primary and fallback upstream providers failed. |
| `500 Server Error` | `server_error` | `internal_error` | Sanitized unexpected gateway exception without leaking stack traces. |

---

## 5. Live Dynamic Forex Engine

NETRA features an integrated real-time foreign exchange engine for cross-currency accounting:

- **Live Upstream**: Fetches current exchange rates via Frankfurter open forex API.
- **Resilience L1 Cache**: Caffeine in-memory cache with configurable 6-hour TTL.
- **Offline Safety Fallback**: Automatic fail-safe to a static exchange rate fallback if outbound network access is blocked or the upstream API experiences downtime.

---

## 6. Machine-Readable OpenAPI 3.1 Specification

Download or inspect the complete OpenAPI contract:

- **Raw YAML Contract**: [`docs/openapi.yaml`](openapi.yaml)
- **JSON Schema Invariants**: OpenAI v1 chat completion compatibility with strict `x-netra-*` header definitions.
