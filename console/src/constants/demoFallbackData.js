/**
 * Pre-seeded demonstrative telemetry, audit logs, vector cache entries,
 * and tenant namespaces for Public Developer Sandbox Mode.
 * 
 * Ensures public showcase visitors experience a rich, fully populated
 * enterprise operational dashboard without exposing private production
 * databases or requiring personal infrastructure credentials.
 */

export const DEMO_KEYS = [
  {
    id: 1,
    virtual_key: 'netra-sk-search-1a2b3c',
    team: 'Search Team',
    rpm_limit: 60,
    monthly_budget_usd: 100.0,
    current_spend_usd: 14.82,
    model_allowlist: ['fast', 'smart', 'auto'],
    semantic_cache_enabled: true,
    similarity_threshold: 0.920,
    status: 'ACTIVE',
    created_at: '2026-11-01T10:00:00Z',
    is_demo: true
  },
  {
    id: 2,
    virtual_key: 'netra-sk-research-4d5e6f',
    team: 'Research Team',
    rpm_limit: 120,
    monthly_budget_usd: 250.0,
    current_spend_usd: 48.65,
    model_allowlist: ['fast', 'smart', 'auto'],
    semantic_cache_enabled: false,
    similarity_threshold: 0.850,
    status: 'ACTIVE',
    created_at: '2026-11-01T10:00:00Z',
    is_demo: true
  },
  {
    id: 3,
    virtual_key: 'netra-sk-free-7g8h9i',
    team: 'Free Tier',
    rpm_limit: 10,
    monthly_budget_usd: 10.0,
    current_spend_usd: 8.94,
    model_allowlist: ['fast'],
    semantic_cache_enabled: true,
    similarity_threshold: 0.850,
    status: 'ACTIVE',
    created_at: '2026-11-02T12:00:00Z',
    is_demo: true
  },
  {
    id: 4,
    virtual_key: 'netra-sk-budget-demo-0j1k2l',
    team: 'Budget Demo',
    rpm_limit: 30,
    monthly_budget_usd: 0.00001,
    current_spend_usd: 0.00001,
    model_allowlist: ['fast', 'auto'],
    semantic_cache_enabled: false,
    similarity_threshold: 0.850,
    status: 'EXHAUSTED',
    created_at: '2026-11-03T15:30:00Z',
    is_demo: true
  }
];

export const DEMO_USAGE = {
  total_requests: 1428,
  total_spend_usd: 3.42,
  total_tokens: 1842500,
  prompt_tokens: 612000,
  completion_tokens: 1230500,
  cache_hits: 492,
  cache_misses: 936,
  cache_hit_rate: 0.3445,
  saved_spend_usd: 1.84,
  p50_latency_ms: 4.2,
  p90_latency_ms: 12.8,
  p99_latency_ms: 38.5,
  routed_volume: 1428,
  fast_executions: 1028,
  smart_executions: 400,
  fast_ratio: 0.72,
  smart_ratio: 0.28,
  stream_requests: 1140,
  standard_requests: 288,
  stream_ratio: 0.798,
  stream_ttft_ms: 118,
  active_connections: 4,
  over_admission_pct: 0.0,
  tier_breakdown: {
    fast: 1028,
    smart: 400
  },
  model_breakdown: {
    'deepseek/deepseek-chat': 945,
    'google/gemini-3.6-flash': 380,
    'nvidia/nemotron-3.5-lightning': 83,
    'anthropic/claude-sonnet-4.6': 20
  }
};

export const getDemoLogs = () => {
  const now = Date.now();
  return [
    {
      id: 101,
      request_id: 'req_live_8f3a92b',
      created_at: new Date(now - 1000 * 45).toISOString(),
      virtual_key: 'netra-sk-search-1a2b3c',
      team: 'Search Team',
      model: 'deepseek/deepseek-chat',
      routing_tier: 'fast',
      cache_status: 'HIT',
      prompt_tokens: 142,
      completion_tokens: 286,
      total_tokens: 428,
      ttft_ms: 4,
      total_latency_ms: 4.8,
      cost_usd: 0.0000,
      saved_usd: 0.00008,
      status_code: 200,
      stream: true,
      prompt_preview: 'Explain the difference between optimistic concurrency and pessimistic locking in PostgreSQL.',
      response_preview: 'Optimistic concurrency control assumes multiple transactions can complete without affecting each other...',
      is_demo: true
    },
    {
      id: 102,
      request_id: 'req_live_7c2b81e',
      created_at: new Date(now - 1000 * 120).toISOString(),
      virtual_key: 'netra-sk-research-4d5e6f',
      team: 'Research Team',
      model: 'google/gemini-3.6-flash',
      routing_tier: 'smart',
      cache_status: 'MISS',
      prompt_tokens: 480,
      completion_tokens: 820,
      total_tokens: 1300,
      ttft_ms: 142,
      total_latency_ms: 380.5,
      cost_usd: 0.00032,
      saved_usd: 0.0000,
      status_code: 200,
      stream: true,
      prompt_preview: 'Prove correctness and compute asymptotic bound of the master theorem for T(n) = 2T(n/2) + n log n.',
      response_preview: 'Applying the Akra-Bazzi generalization: for T(n) = 2T(n/2) + n log n, p = 1 since 2*(1/2)^1 = 1...',
      is_demo: true
    },
    {
      id: 103,
      request_id: 'req_live_6a1d74c',
      created_at: new Date(now - 1000 * 240).toISOString(),
      virtual_key: 'netra-sk-search-1a2b3c',
      team: 'Search Team',
      model: 'deepseek/deepseek-chat',
      routing_tier: 'fast',
      cache_status: 'HIT',
      prompt_tokens: 85,
      completion_tokens: 164,
      total_tokens: 249,
      ttft_ms: 3,
      total_latency_ms: 3.9,
      cost_usd: 0.0000,
      saved_usd: 0.00004,
      status_code: 200,
      stream: false,
      prompt_preview: 'JSON schema validation regex for ISO-8601 UTC timestamp format.',
      response_preview: 'The standard regex pattern for ISO-8601 UTC timestamps (YYYY-MM-DDTHH:mm:ss.sssZ) is: ^\\d{4}-\\d{2}...',
      is_demo: true
    },
    {
      id: 104,
      request_id: 'req_live_5f9e63b',
      created_at: new Date(now - 1000 * 360).toISOString(),
      virtual_key: 'netra-sk-free-7g8h9i',
      team: 'Free Tier',
      model: 'nvidia/nemotron-3.5-lightning',
      routing_tier: 'fast',
      cache_status: 'MISS',
      prompt_tokens: 65,
      completion_tokens: 110,
      total_tokens: 175,
      ttft_ms: 98,
      total_latency_ms: 195.2,
      cost_usd: 0.00003,
      saved_usd: 0.0000,
      status_code: 200,
      stream: true,
      prompt_preview: 'Format SQL query to count active subscriptions per tier in last 30 days.',
      response_preview: 'SELECT tier, COUNT(id) AS active_subscribers FROM subscriptions WHERE status = "active"...',
      is_demo: true
    },
    {
      id: 105,
      request_id: 'req_live_4e8d52a',
      created_at: new Date(now - 1000 * 600).toISOString(),
      virtual_key: 'netra-sk-research-4d5e6f',
      team: 'Research Team',
      model: 'anthropic/claude-sonnet-4.6',
      routing_tier: 'smart',
      cache_status: 'MISS',
      prompt_tokens: 620,
      completion_tokens: 1140,
      total_tokens: 1760,
      ttft_ms: 210,
      total_latency_ms: 620.4,
      cost_usd: 0.00184,
      saved_usd: 0.0000,
      status_code: 200,
      stream: true,
      prompt_preview: 'Perform distributed deadlock detection analysis in 2-phase locking with wait-for graphs.',
      response_preview: 'Distributed deadlock detection requires cycle detection across the global wait-for graph (WFG)...',
      is_demo: true
    }
  ];
};

export const DEMO_CACHE_STATS = {
  total_entries: 18,
  total_hits: 492,
  total_misses: 936,
  hit_rate: 0.3445,
  keys: {
    'netra-sk-search-1a2b3c': {
      team: 'Search Team',
      entries: 12,
      hits: 384,
      misses: 610,
      hit_rate: 0.386,
      similarity_threshold: 0.920,
      top_matches: [
        {
          id: 'vec_c18a901',
          prompt: 'Explain the difference between optimistic concurrency and pessimistic locking in PostgreSQL.',
          similarity: 0.965,
          hits: 84,
          created_at: '2026-11-10T08:00:00Z',
          ttl_seconds: 86400
        },
        {
          id: 'vec_c18a902',
          prompt: 'JSON schema validation regex for ISO-8601 UTC timestamp format.',
          similarity: 0.982,
          hits: 142,
          created_at: '2026-11-10T09:30:00Z',
          ttl_seconds: 86400
        },
        {
          id: 'vec_c18a903',
          prompt: 'How to calculate p99 tail latency from Prometheus histogram quantiles?',
          similarity: 0.941,
          hits: 56,
          created_at: '2026-11-11T11:15:00Z',
          ttl_seconds: 86400
        }
      ]
    },
    'netra-sk-free-7g8h9i': {
      team: 'Free Tier',
      entries: 6,
      hits: 108,
      misses: 326,
      hit_rate: 0.249,
      similarity_threshold: 0.850,
      top_matches: [
        {
          id: 'vec_f09b101',
          prompt: 'Difference between TCP and UDP with header overhead comparison.',
          similarity: 0.892,
          hits: 62,
          created_at: '2026-11-11T14:00:00Z',
          ttl_seconds: 86400
        },
        {
          id: 'vec_f09b102',
          prompt: 'Explain CAP theorem in simple terms with partitioned networks.',
          similarity: 0.884,
          hits: 46,
          created_at: '2026-11-12T10:20:00Z',
          ttl_seconds: 86400
        }
      ]
    }
  }
};

export const DEMO_PROVIDER_HEALTH = {
  providers: [
    {
      provider: 'openrouter',
      status: 'UP',
      circuit_state: 'CLOSED',
      latency_ms: 124,
      failure_rate: 0.0,
      availability: 100.0,
      last_checked: new Date().toISOString()
    },
    {
      provider: 'mock-alpha',
      status: 'UP',
      circuit_state: 'CLOSED',
      latency_ms: 45,
      failure_rate: 0.0,
      availability: 100.0,
      last_checked: new Date().toISOString()
    },
    {
      provider: 'mock-beta',
      status: 'UP',
      circuit_state: 'CLOSED',
      latency_ms: 52,
      failure_rate: 0.0,
      availability: 100.0,
      last_checked: new Date().toISOString()
    }
  ]
};
