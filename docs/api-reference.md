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
| `x-netra-cost-usd` | `0.000015` | Exact request cost in USD calculated to 6 decimal places ($0.000000). |
| `x-netra-route-reason` | `alias_direct` | Decision rationale applied by the dynamic model router. |
| `x-netra-retries` | `0` | Number of upstream network retries executed. |

---

## 3. Operations Endpoints

### `GET /health`

Gateway liveness and readiness probe.

```json
{
  "status": "ok",
  "service": "netra-gateway",
  "version": "0.1.0"
}
```

---

## 4. Machine-Readable OpenAPI 3.1 Specification

Download or inspect the complete OpenAPI contract:

- **Raw YAML Contract**: [`docs/openapi.yaml`](openapi.yaml)
- **JSON Schema Invariants**: OpenAI v1 chat completion compatibility with strict `x-netra-*` header definitions.
