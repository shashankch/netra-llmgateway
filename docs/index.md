# NETRA Architecture & Core Specification

Welcome to the technical documentation for **NETRA** — an enterprise AI-First LLM Gateway and Semantic Vector Cache built on Java 25 LTS Virtual Threads, PostgreSQL 18 with `pgvector`, and Redis 8.0.

---

## System Architecture & Component Topology

<p align="center">
  <a href="diagrams/01_system_architecture.svg">
    <img src="diagrams/01_system_architecture.png" alt="NETRA System Architecture Diagram" width="100%">
  </a>
  <br>
  <em>Figure 1: NETRA End-to-End System Architecture &amp; Component Topology (<a href="diagrams/01_system_architecture.svg">Vector SVG</a> · <a href="diagrams/01_system_architecture.d2">D2 Source</a>)</em>
</p>

---

## Ingress Contract & Headers

Every successful chat completion response from `POST /v1/chat/completions` strictly emits canonical `x-netra-*` telemetry headers:

| Header | Description | Example |
|---|---|---|
| `x-netra-provider` | Upstream provider and model that served the request | `alpha/alpha-small` |
| `x-netra-cache` | Indicates whether the response was served from cache | `hit` or `miss` |
| `x-netra-fallback` | Indicates if an upstream failover provider was used | `false` or `true` |
| `x-netra-cost-usd` | Computed cost in micro-USD ($0.000000 USD) | `0.000011` |
