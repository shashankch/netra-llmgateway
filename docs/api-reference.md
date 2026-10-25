# NETRA REST API Reference

The NETRA LLM Gateway provides an OpenAI-compatible REST API at `/v1/chat/completions` alongside platform health and operations endpoints.

An OpenAPI 3.1.0 specification is maintained directly at [`docs/openapi.yaml`](openapi.yaml).

---

## 1. Authentication

All data plane endpoints require a valid tenant Virtual API Key supplied via the HTTP `Authorization` header:

```http
Authorization: Bearer netra-sk-search-1a2b3c
```

| Virtual Key Prefix | Team / Role | RPM Limit | Monthly Budget | Description |
|---|---|---|---|---|
| `netra-sk-search-*` | Search Team | 60 RPM | $100.00 | High-frequency query parsing |
| `netra-sk-research-*` | AI Labs | 30 RPM | $500.00 | Deep reasoning & smart tier models |
| `netra-sk-free-*` | Free Tier | 10 RPM | $10.00 | Rate-limit testing baseline |

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
| `x-netra-fallback` | `false` | `true` if primary provider failed and failover model was invoked. |
| `x-netra-cost-usd` | `0.000015` | Exact request cost in USD calculated to 6 decimal places ($0.000000). *(Omitted on streaming responses upfront per contract)* |
| `x-netra-route-reason` | `alias_direct` | Decision rationale applied by the dynamic model router. |
| `x-netra-retries` | `0` | Number of upstream network retries executed. |

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

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1729891200,"model":"alpha-small","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1729891200,"model":"alpha-small","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":1,"total_tokens":6}}

data: [DONE]
```

---

## 3. Operations & Admin Endpoints

### `GET /health`

Gateway liveness and readiness probe.

```json
{
  "status": "ok",
  "service": "netra-gateway",
  "version": "0.3.0"
}
```

---

### `GET /admin/usage`

Aggregated spend and token consumption per virtual key over a date window. Reconciles exactly with client-side verification script totals.

#### Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | **Yes** | Virtual API key to filter usage for. |
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
| `limit` | integer | No | Maximum log records returned (default 50, max 500). |

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
    "error_type": null,
    "created_at": "2026-10-24T15:00:00Z"
  }
]
```

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
| `400 Bad Request` | `invalid_request_error` | `invalid_request_error` | Missing body, empty `messages` array, or malformed JSON. |
| `401 Unauthorized` | `authentication_error` | `invalid_api_key` | Missing, unrecognized, or deactivated `netra-sk-*` virtual key. |
| `403 Forbidden` | `model_not_allowed` | `model_not_allowed` | Requested model is not on the virtual key's allowlist. |
| `404 Not Found` | `not_found_error` | `model_not_found` | Model alias or provider model does not exist in gateway catalog. |
| `429 Too Many Requests` | `rate_limit_exceeded` | `rate_limit_exceeded` | Atomic sliding-window RPM limit breached in Redis 8.0 Lua engine. |
| `402 Payment Required` | `budget_exceeded` | `budget_exceeded` | Tenant's monthly USD budget cap exhausted. |
| `502 Bad Gateway` | `upstream_error` | `upstream_error` | All configured primary and fallback upstream providers failed. |
| `500 Server Error` | `server_error` | `internal_error` | Sanitized unexpected gateway exception without leaking stack traces. |

---

## 5. Live Dynamic Forex Engine

NETRA features an integrated `ForexRateService` for cross-currency accounting:

- **Live Upstream**: Fetches current exchange rates via Frankfurter open forex API.
- **Resilience L1 Cache**: Caffeine in-memory cache with configurable 6-hour TTL.
- **Offline Safety Fallback**: Automatic fail-safe to `87.50` INR/USD if outbound network access is blocked or the upstream API experiences downtime.

---

## 6. Machine-Readable OpenAPI 3.1 Specification

Download or inspect the complete OpenAPI contract:

- **Raw YAML Contract**: [`docs/openapi.yaml`](openapi.yaml)
- **JSON Schema Invariants**: OpenAI v1 chat completion compatibility with strict `x-netra-*` header definitions.
