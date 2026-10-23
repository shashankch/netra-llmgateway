-- NETRA LLM Gateway - Initial Database Schema
-- Baseline: PostgreSQL 18 with pgvector v0.8.x extension

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants (Virtual API Keys)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    virtual_key VARCHAR(64) UNIQUE NOT NULL,
    team VARCHAR(128) NOT NULL,
    monthly_budget_usd NUMERIC(12, 6) NOT NULL DEFAULT 100.000000,
    rpm_limit INT NOT NULL DEFAULT 60,
    tpm_limit INT DEFAULT 100000,
    model_allowlist TEXT[] NOT NULL,
    semantic_cache_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    similarity_threshold NUMERIC(4, 3) NOT NULL DEFAULT 0.850,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_vkey ON tenants(virtual_key);

-- 2. Model Pricing Table (USD per 1M tokens)
CREATE TABLE IF NOT EXISTS model_pricing (
    model VARCHAR(64) PRIMARY KEY,
    provider VARCHAR(64) NOT NULL,
    input_per_1m NUMERIC(10, 4) NOT NULL,
    output_per_1m NUMERIC(10, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Comprehensive Request Audit Logs (16-field audit trail per DATA_MODEL.md)
CREATE TABLE IF NOT EXISTS request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(64) NOT NULL,
    virtual_key VARCHAR(64) NOT NULL REFERENCES tenants(virtual_key),
    requested_model VARCHAR(64) NOT NULL,
    resolved_provider VARCHAR(64),
    resolved_model VARCHAR(64),
    status VARCHAR(32) NOT NULL, -- 'ok', 'cache_hit', 'rejected_auth', 'rejected_allowlist', 'rejected_rate_limit', 'rejected_budget', 'upstream_error'
    status_code INT NOT NULL,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0.000000,
    cache VARCHAR(16) NOT NULL DEFAULT 'miss', -- 'hit' or 'miss'
    fallback BOOLEAN NOT NULL DEFAULT FALSE,
    route_reason VARCHAR(256),
    retries INT NOT NULL DEFAULT 0,
    latency_ms BIGINT NOT NULL,
    is_stream BOOLEAN NOT NULL DEFAULT FALSE,
    error_type VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_req_vkey_created ON request_logs(virtual_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_req_created ON request_logs(created_at DESC);

-- 4. Monthly Spend Aggregation Table
CREATE TABLE IF NOT EXISTS monthly_spend (
    virtual_key VARCHAR(64) NOT NULL REFERENCES tenants(virtual_key),
    year_month VARCHAR(7) NOT NULL, -- e.g. '2026-10'
    total_spend_usd NUMERIC(12, 6) NOT NULL DEFAULT 0.000000,
    request_count BIGINT NOT NULL DEFAULT 0,
    total_prompt_tokens BIGINT NOT NULL DEFAULT 0,
    total_completion_tokens BIGINT NOT NULL DEFAULT 0,
    cache_hits BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (virtual_key, year_month)
);

-- 5. Semantic Vector Cache Entries
CREATE TABLE IF NOT EXISTS cache_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    virtual_key VARCHAR(64) NOT NULL REFERENCES tenants(virtual_key),
    model_alias VARCHAR(64) NOT NULL,
    prompt_text TEXT NOT NULL,
    embedding vector(384) NOT NULL,
    response_json JSONB NOT NULL,
    hit_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_hit_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_cache_vkey_alias ON cache_entries(virtual_key, model_alias);
