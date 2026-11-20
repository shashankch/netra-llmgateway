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
  requests: 1428,
  total_requests: 1428,
  cost_usd: 3.42,
  total_spend_usd: 3.42,
  prompt_tokens: 612000,
  completion_tokens: 1230500,
  total_tokens: 1842500,
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
      created_at: new Date(now - 1000 * 30).toISOString(),
      virtual_key: 'netra-sk-search-1a2b3c',
      team: 'Search Team',
      requested_model: 'auto',
      resolved_model: 'deepseek/deepseek-chat',
      model: 'deepseek/deepseek-chat',
      routing_tier: 'fast',
      route_reason: 'auto -> fast (syntactic complexity < 0.35)',
      provider: 'openrouter',
      cache: 'hit',
      cache_status: 'HIT',
      cache_tier: 'tier2_semantic',
      prompt_tokens: 142,
      completion_tokens: 286,
      total_tokens: 428,
      latency_ms: 4.2,
      total_latency_ms: 4.2,
      ttft_ms: 3.8,
      cost_usd: 0.0000,
      saved_usd: 0.00008,
      status_code: 200,
      status: 200,
      stream: true,
      prompt_preview: 'Explain the difference between optimistic concurrency and pessimistic locking in PostgreSQL.',
      response_preview: 'Optimistic concurrency control assumes multiple transactions can complete without affecting each other...',
      is_demo: true
    },
    {
      id: 102,
      request_id: 'req_live_7c2b81e',
      created_at: new Date(now - 1000 * 75).toISOString(),
      virtual_key: 'netra-sk-research-4d5e6f',
      team: 'Research Team',
      requested_model: 'auto',
      resolved_model: 'google/gemini-3.6-flash',
      model: 'google/gemini-3.6-flash',
      routing_tier: 'smart',
      route_reason: 'auto -> smart (deliberative reasoning detected)',
      provider: 'openrouter',
      cache: 'miss',
      cache_status: 'MISS',
      cache_tier: 'bypassed',
      prompt_tokens: 480,
      completion_tokens: 820,
      total_tokens: 1300,
      latency_ms: 340.5,
      total_latency_ms: 340.5,
      ttft_ms: 142,
      cost_usd: 0.00032,
      saved_usd: 0.0000,
      status_code: 200,
      status: 200,
      stream: true,
      prompt_preview: 'Prove correctness and compute asymptotic bound of the master theorem for T(n) = 2T(n/2) + n log n.',
      response_preview: 'Applying the Akra-Bazzi generalization: for T(n) = 2T(n/2) + n log n, p = 1 since 2*(1/2)^1 = 1...',
      is_demo: true
    },
    {
      id: 103,
      request_id: 'req_live_6a1d74c',
      created_at: new Date(now - 1000 * 130).toISOString(),
      virtual_key: 'netra-sk-search-1a2b3c',
      team: 'Search Team',
      requested_model: 'auto',
      resolved_model: 'deepseek/deepseek-chat',
      model: 'deepseek/deepseek-chat',
      routing_tier: 'fast',
      route_reason: 'auto -> fast (regex extraction pattern)',
      provider: 'openrouter',
      cache: 'hit',
      cache_status: 'HIT',
      cache_tier: 'tier2_semantic',
      prompt_tokens: 85,
      completion_tokens: 164,
      total_tokens: 249,
      latency_ms: 3.9,
      total_latency_ms: 3.9,
      ttft_ms: 3.2,
      cost_usd: 0.0000,
      saved_usd: 0.00004,
      status_code: 200,
      status: 200,
      stream: false,
      prompt_preview: 'JSON schema validation regex for ISO-8601 UTC timestamp format.',
      response_preview: 'The standard regex pattern for ISO-8601 UTC timestamps (YYYY-MM-DDTHH:mm:ss.sssZ) is: ^\\d{4}-\\d{2}...',
      is_demo: true
    },
    {
      id: 104,
      request_id: 'req_live_5f9e63b',
      created_at: new Date(now - 1000 * 190).toISOString(),
      virtual_key: 'netra-sk-free-7g8h9i',
      team: 'Free Tier',
      requested_model: 'auto',
      resolved_model: 'nvidia/nemotron-3.5-lightning',
      model: 'nvidia/nemotron-3.5-lightning',
      routing_tier: 'fast',
      route_reason: 'auto -> fast (concise SQL formatting)',
      provider: 'openrouter',
      cache: 'miss',
      cache_status: 'MISS',
      cache_tier: 'tier2_semantic',
      prompt_tokens: 65,
      completion_tokens: 110,
      total_tokens: 175,
      latency_ms: 98.2,
      total_latency_ms: 98.2,
      ttft_ms: 92,
      cost_usd: 0.00003,
      saved_usd: 0.0000,
      status_code: 200,
      status: 200,
      stream: true,
      prompt_preview: 'Format SQL query to count active subscriptions per tier in last 30 days.',
      response_preview: 'SELECT tier, COUNT(id) AS active_subscribers FROM subscriptions WHERE status = "active"...',
      is_demo: true
    },
    {
      id: 105,
      request_id: 'req_live_4e8d52a',
      created_at: new Date(now - 1000 * 260).toISOString(),
      virtual_key: 'netra-sk-research-4d5e6f',
      team: 'Research Team',
      requested_model: 'auto',
      resolved_model: 'anthropic/claude-sonnet-4.6',
      model: 'anthropic/claude-sonnet-4.6',
      routing_tier: 'smart',
      route_reason: 'auto -> smart (formal verification CoT)',
      provider: 'openrouter',
      cache: 'miss',
      cache_status: 'MISS',
      cache_tier: 'bypassed',
      prompt_tokens: 620,
      completion_tokens: 1140,
      total_tokens: 1760,
      latency_ms: 385.4,
      total_latency_ms: 385.4,
      ttft_ms: 195,
      cost_usd: 0.00184,
      saved_usd: 0.0000,
      status_code: 200,
      status: 200,
      stream: true,
      prompt_preview: 'Perform distributed deadlock detection analysis in 2-phase locking with wait-for graphs.',
      response_preview: 'Distributed deadlock detection requires cycle detection across the global wait-for graph (WFG)...',
      is_demo: true
    },
    {
      id: 106,
      request_id: 'req_live_3d7c41f',
      created_at: new Date(now - 1000 * 320).toISOString(),
      virtual_key: 'netra-sk-search-1a2b3c',
      team: 'Search Team',
      requested_model: 'fast',
      resolved_model: 'deepseek/deepseek-chat',
      model: 'deepseek/deepseek-chat',
      routing_tier: 'fast',
      route_reason: 'direct fast profile match',
      provider: 'openrouter',
      cache: 'miss',
      cache_status: 'MISS',
      cache_tier: 'tier2_semantic',
      prompt_tokens: 110,
      completion_tokens: 220,
      total_tokens: 330,
      latency_ms: 112.0,
      total_latency_ms: 112.0,
      ttft_ms: 104,
      cost_usd: 0.00005,
      saved_usd: 0.0000,
      status_code: 200,
      status: 200,
      stream: true,
      prompt_preview: 'List 5 key invariants guaranteed by Raft leader election phase.',
      response_preview: 'Raft guarantees 5 critical safety invariants: Election Safety, Leader Append-Only...',
      is_demo: true
    },
    {
      id: 107,
      request_id: 'req_live_2c6b30e',
      created_at: new Date(now - 1000 * 410).toISOString(),
      virtual_key: 'netra-sk-research-4d5e6f',
      team: 'Research Team',
      requested_model: 'smart',
      resolved_model: 'google/gemini-3.6-flash',
      model: 'google/gemini-3.6-flash',
      routing_tier: 'smart',
      route_reason: 'direct smart tier routing',
      provider: 'openrouter',
      cache: 'miss',
      cache_status: 'MISS',
      cache_tier: 'bypassed',
      prompt_tokens: 340,
      completion_tokens: 680,
      total_tokens: 1020,
      latency_ms: 290.8,
      total_latency_ms: 290.8,
      ttft_ms: 130,
      cost_usd: 0.00025,
      saved_usd: 0.0000,
      status_code: 200,
      status: 200,
      stream: true,
      prompt_preview: 'Derive space complexity of skip list search operations under uniform distribution.',
      response_preview: 'In a skip list with parameter p = 1/2, node level heights follow a geometric distribution...',
      is_demo: true
    },
    {
      id: 108,
      request_id: 'req_live_1b5a29d',
      created_at: new Date(now - 1000 * 500).toISOString(),
      virtual_key: 'netra-sk-search-1a2b3c',
      team: 'Search Team',
      requested_model: 'auto',
      resolved_model: 'deepseek/deepseek-chat',
      model: 'deepseek/deepseek-chat',
      routing_tier: 'fast',
      route_reason: 'auto -> fast (lookup request)',
      provider: 'openrouter',
      cache: 'hit',
      cache_status: 'HIT',
      cache_tier: 'tier2_semantic',
      prompt_tokens: 95,
      completion_tokens: 180,
      total_tokens: 275,
      latency_ms: 3.5,
      total_latency_ms: 3.5,
      ttft_ms: 3.1,
      cost_usd: 0.0000,
      saved_usd: 0.00006,
      status_code: 200,
      status: 200,
      stream: true,
      prompt_preview: 'How does LSM-Tree compaction differ between Size-Tiered and Leveled Compaction in RocksDB?',
      response_preview: 'Size-Tiered compaction merges files of similar size, favoring write throughput...',
      is_demo: true
    },
    {
      id: 109,
      request_id: 'req_live_0a4918c',
      created_at: new Date(now - 1000 * 620).toISOString(),
      virtual_key: 'netra-sk-free-7g8h9i',
      team: 'Free Tier',
      requested_model: 'fast',
      resolved_model: 'nvidia/nemotron-3.5-lightning',
      model: 'nvidia/nemotron-3.5-lightning',
      routing_tier: 'fast',
      route_reason: 'fast consumer quota',
      provider: 'openrouter',
      cache: 'miss',
      cache_status: 'MISS',
      cache_tier: 'tier2_semantic',
      prompt_tokens: 70,
      completion_tokens: 125,
      total_tokens: 195,
      latency_ms: 105.4,
      total_latency_ms: 105.4,
      ttft_ms: 99,
      cost_usd: 0.00003,
      saved_usd: 0.0000,
      status_code: 200,
      status: 200,
      stream: true,
      prompt_preview: 'Difference between gRPC unary and server streaming protocols.',
      response_preview: 'Unary RPC sends a single request and returns a single response, whereas server streaming...',
      is_demo: true
    },
    {
      id: 110,
      request_id: 'req_live_9f3807b',
      created_at: new Date(now - 1000 * 750).toISOString(),
      virtual_key: 'netra-sk-search-1a2b3c',
      team: 'Search Team',
      requested_model: 'auto',
      resolved_model: 'deepseek/deepseek-chat',
      model: 'deepseek/deepseek-chat',
      routing_tier: 'fast',
      route_reason: 'auto -> fast (short summary query)',
      provider: 'openrouter',
      cache: 'miss',
      cache_status: 'MISS',
      cache_tier: 'tier2_semantic',
      prompt_tokens: 120,
      completion_tokens: 240,
      total_tokens: 360,
      latency_ms: 125.6,
      total_latency_ms: 125.6,
      ttft_ms: 115,
      cost_usd: 0.00006,
      saved_usd: 0.0000,
      status_code: 200,
      status: 200,
      stream: true,
      prompt_preview: 'Summary of B-Tree fanout impact on SSD I/O operations.',
      response_preview: 'High fanout in B-Trees reduces tree depth, ensuring most page lookups complete in 3-4 random reads...',
      is_demo: true
    }
  ];
};

export const DEMO_CACHE_STATS = {
  total_entries: 18,
  total_hits: 492,
  total_misses: 936,
  hit_rate: 0.3445,
  tier1_exact_hits: 142,
  tier2_semantic_hits: 350,
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
      cache_enabled: true,
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
    },
    'netra-sk-research-4d5e6f': {
      team: 'Research Team',
      entries: 0,
      hits: 0,
      misses: 400,
      hit_rate: 0.0,
      similarity_threshold: 0.850,
      cache_enabled: false,
      top_matches: []
    },
    'netra-sk-budget-demo-0j1k2l': {
      team: 'Budget Demo',
      entries: 0,
      hits: 0,
      misses: 0,
      hit_rate: 0.0,
      similarity_threshold: 0.850,
      cache_enabled: false,
      top_matches: []
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

// Realistic fallback cached entries for instant offline/demo inspection
export const DEMO_CACHE_ENTRIES = {
  'netra-sk-search-1a2b3c': [
    {
      id: 'c8f1e2a0-4b5c-4d8e-9f0a-1b2c3d4e5f60',
      prompt_text: 'Explain the difference between optimistic concurrency and pessimistic locking in PostgreSQL.',
      completion_text: 'Optimistic Concurrency Control (OCC) and Pessimistic Locking differ fundamentally in their concurrency conflict resolution:\n\n1. Locking vs Verification: Pessimistic locking acquires row-level locks upfront (e.g. SELECT FOR UPDATE), blocking conflicting writers until transaction completion. OCC allows concurrent reads and writes without locks, verifying conflict freedom during commit time.\n2. Throughput Characteristics: OCC achieves near-linear scalability in read-heavy workloads with low collision probability. Pessimistic locking prevents abort cascades in write-heavy transactional hotspots.\n3. PostgreSQL Implementation: PostgreSQL uses Multi-Version Concurrency Control (MVCC) by default, functioning as a non-blocking optimistic engine for SELECT queries while providing SELECT FOR UPDATE for pessimistic synchronization.',
      model_alias: 'fast',
      resolved_provider: 'openrouter/deepseek/deepseek-chat',
      hit_count: 84,
      created_at: '2026-11-10T08:00:00Z'
    },
    {
      id: 'c8f1e2a0-4b5c-4d8e-9f0a-1b2c3d4e5f61',
      prompt_text: 'JSON schema validation regex for ISO-8601 UTC timestamp format.',
      completion_text: 'The standard regex pattern for strict ISO-8601 UTC timestamps (YYYY-MM-DDTHH:mm:ss.sssZ) is:\n\n^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?Z$\n\nKey validations:\n- Enforces 4-digit Gregorian calendar years and zero-padded 2-digit months (01-12).\n- Restricts hours (00-23) and minutes/seconds (00-59).\n- Supports optional millisecond/nanosecond decimal precision.\n- Requires trailing uppercase "Z" representing zero UTC offset.',
      model_alias: 'fast',
      resolved_provider: 'openrouter/deepseek/deepseek-chat',
      hit_count: 142,
      created_at: '2026-11-10T09:30:00Z'
    },
    {
      id: 'c8f1e2a0-4b5c-4d8e-9f0a-1b2c3d4e5f62',
      prompt_text: 'How to calculate p99 tail latency from Prometheus histogram quantiles?',
      completion_text: 'In Prometheus PromQL, compute p99 tail latency across service instances using histogram_quantile:\n\nhistogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))\n\nOperational guidelines:\n1. Rate Window: Use at least a 2m to 5m rate interval (e.g. [5m]) to ensure sufficient sample counts per bucket.\n2. Bucket Dimension: Always aggregate over "le" (less-than-or-equal) bucket label when using sum().\n3. Linear Interpolation: Remember Prometheus assumes uniform distribution within the bucket containing the 99th percentile.',
      model_alias: 'fast',
      resolved_provider: 'openrouter/deepseek/deepseek-chat',
      hit_count: 56,
      created_at: '2026-11-11T11:15:00Z'
    }
  ],
  'netra-sk-free-7g8h9i': [
    {
      id: 'd9e2f3b1-5c6d-5e9f-0a1b-2c3d4e5f6a71',
      prompt_text: 'Difference between TCP and UDP with header overhead comparison.',
      completion_text: 'TCP and UDP differ primarily in delivery guarantees and header serialization overhead:\n\n1. Connection State: TCP is connection-oriented with 3-way handshake (SYN, SYN-ACK, ACK) and stateful byte stream tracking. UDP is connectionless with zero session handshake latency.\n2. Header Size: Standard TCP header overhead is 20 to 60 bytes (including optional timestamps and SACK options). UDP maintains a constant 8-byte header.\n3. Reliability & Congestion Control: TCP guarantees in-order arrival via sequence numbering, acknowledgments, and window scaling (CUBIC/BBR). UDP offers fire-and-forget datagram delivery with zero packet retransmission.',
      model_alias: 'fast',
      resolved_provider: 'openrouter/deepseek/deepseek-chat',
      hit_count: 62,
      created_at: '2026-11-11T14:00:00Z'
    },
    {
      id: 'd9e2f3b1-5c6d-5e9f-0a1b-2c3d4e5f6a72',
      prompt_text: 'Explain CAP theorem in simple terms with partitioned networks.',
      completion_text: 'The CAP theorem states that a distributed data store can guarantee at most two out of three properties under network partitions:\n\n1. Consistency (C): Every read receives the most recent write or an error.\n2. Availability (A): Every non-failing node returns a non-error response, without guarantee of latest data.\n3. Partition Tolerance (P): The cluster continues operating despite dropped or delayed inter-node network packets.\n\nIn real-world networks where partitions (P) are inevitable, distributed architectures must choose between Consistency (CP, e.g. Raft/Paxos aborting or blocking reads) or Availability (AP, e.g. Cassandra/DynamoDB serving stale replicas).',
      model_alias: 'fast',
      resolved_provider: 'openrouter/deepseek/deepseek-chat',
      hit_count: 46,
      created_at: '2026-11-12T10:20:00Z'
    }
  ],
  'netra-sk-research-4d5e6f': [],
  'netra-sk-budget-demo-0j1k2l': []
};

// Default profile presets for the Interactive Evaluation Playground
export const DEFAULT_PLAYGROUND_PRESETS = [
  { 
    label: 'Search Team', 
    key: 'netra-sk-search-1a2b3c', 
    model: 'fast', 
    desc: 'Cache threshold: 0.92, RPM: 60', 
    rpm: '60 RPM',
    cache: 'Tier-2 Vector (\u2265 0.92)',
    role: 'High-throughput search inference profile with aggressive semantic caching to minimize latency.'
  },
  { 
    label: 'Research Team', 
    key: 'netra-sk-research-4d5e6f', 
    model: 'auto', 
    desc: 'Auto router, cache: disabled', 
    rpm: '120 RPM',
    cache: 'Bypassed (Zero Cache)',
    role: 'Analytical research queries routed through the difficulty classifier (auto tier) to optimize cost vs reasoning.'
  },
  { 
    label: 'Free Tier', 
    key: 'netra-sk-free-7g8h9i', 
    model: 'fast', 
    desc: 'RPM: 10, cache threshold: 0.85', 
    rpm: '10 RPM',
    cache: 'Active (\u2265 0.85)',
    role: 'Restricted consumer tier with strict Redis rate limits to showcase real-time burst rate limiting.'
  },
  { 
    label: 'Budget Demo', 
    key: 'netra-sk-budget-demo-0j1k2l', 
    model: 'fast', 
    desc: 'Strict monthly limit demonstration ($0.00001 cap)', 
    rpm: '30 RPM',
    cache: 'Bypassed',
    role: 'Micro-capped profile ($0.00001 spend ceiling) engineered to demonstrate atomic monthly budget exhaustion.'
  }
];
