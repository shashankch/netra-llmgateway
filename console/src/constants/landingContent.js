/**
 * Static content and presentation data for the NETRA Landing & Overview page.
 */

export const HERO_STATS = [
  {
    id: 'openai-compatible',
    number: 'ANY',
    highlight: 'LLM',
    highlightColor: 'var(--accent-cyan)',
    label: 'OPENAI-COMPATIBLE',
    desc: 'one standard API for every provider'
  },
  {
    id: 'over-admission',
    number: '0.00',
    highlight: '%',
    highlightColor: 'var(--accent-lime)',
    label: 'OVER-ADMISSION',
    desc: 'zero-leak rate & budget limits'
  },
  {
    id: 'semantic-cache',
    number: '< 5',
    highlight: 'ms',
    highlightColor: 'var(--accent-emerald)',
    label: 'SEMANTIC CACHE',
    desc: 'instant answers for repeated prompts'
  },
  {
    id: 'cost-arbitrage',
    number: '72.4',
    highlight: '%',
    highlightColor: 'var(--accent-indigo)',
    label: 'COST ARBITRAGE',
    desc: 'smart model routing by complexity'
  }
];

export const WHY_NETRA_FEATURES = [
  {
    id: 'unified-routing',
    iconName: 'Network',
    accentColor: 'var(--accent-lime)',
    accentBg: 'rgba(210, 248, 35, 0.1)',
    accentBorder: 'rgba(210, 248, 35, 0.25)',
    title: 'Unified Multi-Provider Routing',
    description: 'Route requests seamlessly across private self-hosted models, external cloud providers, and managed aggregators through a single OpenAI-compatible API. Configure logical model aliases with automated fallback chains and zero client SDK modifications.'
  },
  {
    id: 'cost-routing',
    iconName: 'Cpu',
    accentColor: 'var(--accent-indigo)',
    accentBg: 'rgba(99, 102, 241, 0.1)',
    accentBorder: 'rgba(99, 102, 241, 0.25)',
    title: 'Intelligent Cost-Optimized Routing',
    description: 'Dynamically analyze prompt complexity at the gateway layer to route simple queries to high-throughput, economical models and reserve flagship models for advanced reasoning, delivering substantial cost reductions automatically.'
  },
  {
    id: 'semantic-cache',
    iconName: 'Database',
    accentColor: 'var(--accent-emerald)',
    accentBg: 'rgba(16, 185, 129, 0.1)',
    accentBorder: 'rgba(16, 185, 129, 0.25)',
    title: 'High-Performance Semantic Caching',
    description: 'Instantly serve repeated and semantically equivalent queries from a low-latency vector cache with zero upstream model charges. Accelerate response times for common queries from seconds to single-digit milliseconds.'
  },
  {
    id: 'concurrency-limits',
    iconName: 'Gauge',
    accentColor: 'var(--accent-cyan)',
    accentBg: 'rgba(6, 182, 212, 0.1)',
    accentBorder: 'rgba(6, 182, 212, 0.25)',
    title: 'Concurrency Guarantees & Rate Limiting',
    description: 'Enforce strict requests-per-minute quotas and monthly tenant spend ceilings with atomic synchronization. Prevent noisy-neighbor saturation and eliminate billing overruns under high-concurrency production bursts.'
  },
  {
    id: 'active-disconnect',
    iconName: 'Zap',
    accentColor: 'var(--accent-lime)',
    accentBg: 'rgba(210, 248, 35, 0.1)',
    accentBorder: 'rgba(210, 248, 35, 0.25)',
    title: 'Active Client Disconnect Handling',
    description: 'Detect interrupted connections and cancelled user sessions in real time. The gateway immediately terminates the upstream generation stream, eliminating phantom token consumption and wasted spend on abandoned responses.'
  },
  {
    id: 'vector-guardrails',
    iconName: 'CheckCircle2',
    accentColor: 'var(--accent-emerald)',
    accentBg: 'rgba(16, 185, 129, 0.1)',
    accentBorder: 'rgba(16, 185, 129, 0.25)',
    title: 'Precision Vector Guardrails',
    description: 'Calibrated similarity gating ensures only authentic semantic paraphrases retrieve cached completions while strictly rejecting near-miss queries, preventing cache poisoning and ensuring answers remain contextually accurate.'
  },
  {
    id: 'low-latency-relay',
    iconName: 'Activity',
    accentColor: 'var(--accent-cyan)',
    accentBg: 'rgba(6, 182, 212, 0.1)',
    accentBorder: 'rgba(6, 182, 212, 0.25)',
    title: 'Low-Latency Streaming Relay',
    description: 'Stream tokens directly to client applications via unbuffered Server-Sent Events (SSE) with negligible gateway overhead. Engineered for high concurrency and smooth time-to-first-token interactive experiences.'
  },
  {
    id: 'resilient-telemetry',
    iconName: 'Layers',
    accentColor: 'var(--accent-indigo)',
    accentBg: 'rgba(99, 102, 241, 0.1)',
    accentBorder: 'rgba(99, 102, 241, 0.25)',
    title: 'Resilient Telemetry Buffering',
    description: 'Asynchronously aggregate request logs and financial accounting records in a bounded buffer, shielding downstream databases from write amplification and maintaining gateway responsiveness during traffic surges.'
  },
  {
    id: 'multi-tenant-security',
    iconName: 'ShieldCheck',
    accentColor: 'var(--accent-lime)',
    accentBg: 'rgba(210, 248, 35, 0.1)',
    accentBorder: 'rgba(210, 248, 35, 0.25)',
    title: 'Multi-Tenant Security & Isolation',
    description: 'Isolate prompt data, vector cache entries, and usage analytics per virtual key. Ensure complete data privacy between internal teams and client applications with zero cross-tenant prompt leakage.'
  }
];

export const CAPABILITY_CARDS = [
  {
    tab: 'playground',
    title: 'Developer Playground',
    iconName: 'Terminal',
    accentColor: 'var(--accent-lime)',
    description: 'Test token streaming, prompt complexity auto routing, and real-time latency badges.',
    actionText: 'Launch Console →'
  },
  {
    tab: 'keys',
    title: 'API Keys & Governance',
    iconName: 'Key',
    accentColor: 'var(--accent-cyan)',
    description: 'Provision virtual keys, model allowlists, sliding-window RPM quotas, and monthly budgets.',
    actionText: 'Manage Keys →'
  },
  {
    tab: 'analytics',
    title: 'Real-Time Analytics',
    iconName: 'Activity',
    accentColor: 'var(--accent-emerald)',
    description: 'Track spend in USD/INR, request velocity, token burn-down, and semantic cache savings.',
    actionText: 'View Analytics →'
  },
  {
    tab: 'logs',
    title: 'Audit Request Stream',
    iconName: 'FileText',
    accentColor: 'var(--accent-indigo)',
    description: 'Real-time Server-Sent Events audit stream with virtual key and status code filtering.',
    actionText: 'Stream Logs →'
  }
];

export const COMPARISON_ROWS = [
  {
    capability: 'Data Residency & Privacy',
    iconName: 'ShieldCheck',
    accentColor: 'var(--accent-lime)',
    accentBg: 'rgba(210, 248, 35, 0.1)',
    accentBorder: 'rgba(210, 248, 35, 0.25)',
    rawApi: 'Proprietary vendor cloud perimeter; prompts and data exit organization boundary',
    publicAggregator: 'Transits third-party multi-tenant SaaS edge before reaching upstream',
    netra: '100% In-VPC private deployment with strict network isolation and zero data egress'
  },
  {
    capability: 'Two-Tier Semantic Cache',
    iconName: 'Database',
    accentColor: 'var(--accent-emerald)',
    accentBg: 'rgba(16, 185, 129, 0.1)',
    accentBorder: 'rgba(16, 185, 129, 0.25)',
    rawApi: 'Provider-specific prompt caching billed at standard upstream rates',
    publicAggregator: 'None; every request incurs full upstream token charges',
    netra: 'Sub-5ms vector cache serving repeated and paraphrased queries at zero upstream cost'
  },
  {
    capability: 'Boundary Discrimination',
    iconName: 'CheckCircle2',
    accentColor: 'var(--accent-cyan)',
    accentBg: 'rgba(6, 182, 212, 0.1)',
    accentBorder: 'rgba(6, 182, 212, 0.25)',
    rawApi: 'Exact string hash matching only; misses semantic paraphrases',
    publicAggregator: 'None; every variant query billed as a new prompt',
    netra: 'Calibrated cosine similarity gating with near-miss rejection to prevent cache poisoning'
  },
  {
    capability: 'Mid-Stream Disconnects',
    iconName: 'Zap',
    accentColor: 'var(--accent-lime)',
    accentBg: 'rgba(210, 248, 35, 0.1)',
    accentBorder: 'rgba(210, 248, 35, 0.25)',
    rawApi: 'Upstream generates to completion; unseen tokens are fully billed',
    publicAggregator: 'Uncontrolled; streams continue generating upon client disconnect',
    netra: 'Instant stream termination halts upstream generation immediately, stopping phantom token spend'
  },
  {
    capability: 'Rate Limiting & Budgets',
    iconName: 'Gauge',
    accentColor: 'var(--accent-cyan)',
    accentBg: 'rgba(6, 182, 212, 0.1)',
    accentBorder: 'rgba(6, 182, 212, 0.25)',
    rawApi: 'Opaque provider-side throttling with unpredictable 429 burst limits',
    publicAggregator: 'Prepaid account balance checks without real-time tenant rate limits',
    netra: 'Atomic sliding-window rate limits and monthly spend ceilings with automatic rollback on failure'
  },
  {
    capability: 'Cost Arbitrage Routing',
    iconName: 'Cpu',
    accentColor: 'var(--accent-indigo)',
    accentBg: 'rgba(99, 102, 241, 0.1)',
    accentBorder: 'rgba(99, 102, 241, 0.25)',
    rawApi: 'Hardcoded model references in client application code',
    publicAggregator: 'Manual model selection or basic static fallback without difficulty analysis',
    netra: 'Dynamic prompt complexity analysis routing routine queries to fast tiers and reasoning to smart tiers'
  },
  {
    capability: 'High-Availability Failover',
    iconName: 'Activity',
    accentColor: 'var(--accent-cyan)',
    accentBg: 'rgba(6, 182, 212, 0.1)',
    accentBorder: 'rgba(6, 182, 212, 0.25)',
    rawApi: 'Client-side try/catch retry loops that amplify latency during provider outages',
    publicAggregator: 'Hosted multi-provider fallback dependent on third-party SaaS availability',
    netra: 'Autonomous circuit breakers and ordered candidate chains with strict timeout budgets'
  },
  {
    capability: 'Streaming Relay Performance',
    iconName: 'Clock',
    accentColor: 'var(--accent-emerald)',
    accentBg: 'rgba(16, 185, 129, 0.1)',
    accentBorder: 'rgba(16, 185, 129, 0.25)',
    rawApi: 'Variable connection latency dependent on vendor server proximity',
    publicAggregator: 'Additional network hop through third-party proxy adding 50–150ms roundtrip delay',
    netra: 'Non-blocking unbuffered streaming relay with sub-millisecond gateway pass-through overhead'
  },
  {
    capability: 'Deployment & License',
    iconName: 'Key',
    accentColor: 'var(--accent-lime)',
    accentBg: 'rgba(210, 248, 35, 0.1)',
    accentBorder: 'rgba(210, 248, 35, 0.25)',
    rawApi: 'Proprietary vendor cloud infrastructure with vendor lock-in',
    publicAggregator: 'Closed-source proprietary SaaS platform',
    netra: '100% open source (Apache 2.0) deployable anywhere via Docker, PaaS, or bare metal'
  }
];
