/**
 * Benchmark test scenarios and tenant presets for the Playground evaluation sandbox.
 */

export const DEMO_TENANT_PRESETS = [
  {
    label: 'Search Team',
    key: 'netra-sk-search-1a2b3c',
    model: 'fast',
    desc: 'Cache threshold: 0.92, RPM: 60',
    defaultStatus: 'DEMO'
  },
  {
    label: 'Research Team',
    key: 'netra-sk-research-4d5e6f',
    model: 'auto',
    desc: 'Auto router, cache: disabled',
    defaultStatus: 'DEMO'
  },
  {
    label: 'Free Tier',
    key: 'netra-sk-free-7g8h9i',
    model: 'fast',
    desc: 'RPM: 10, cache threshold: 0.85',
    defaultStatus: 'DEMO'
  },
  {
    label: 'Budget Demo',
    key: 'netra-sk-budget-demo-0j1k2l',
    model: 'fast',
    desc: 'Strict monthly limit demonstration ($0.00001 cap)',
    defaultStatus: 'DEMO'
  }
];

export const BENCHMARK_PROMPT_TEMPLATES = [
  {
    group: 'Semantic Vector Cache — Pair A (Distributed Web Systems)',
    label: 'Pair A · Step 1 (Seed Cache): "What is a load balancer and why is it needed?"',
    text: 'What is a load balancer and why is it needed?',
    model: 'fast'
  },
  {
    group: 'Semantic Vector Cache — Pair A (Distributed Web Systems)',
    label: 'Pair A · Step 2 (Semantic Hit): "Explain what load balancers do in distributed web systems."',
    text: 'Explain what load balancers do in distributed web systems.',
    model: 'fast'
  },
  {
    group: 'Semantic Vector Cache — Pair B (Commercial SaaS Policy)',
    label: 'Pair B · Step 1 (Seed Cache): "What is the refund policy for annual subscription plans?"',
    text: 'What is the refund policy for annual subscription plans?',
    model: 'fast'
  },
  {
    group: 'Semantic Vector Cache — Pair B (Commercial SaaS Policy)',
    label: 'Pair B · Step 2 (Semantic Hit): "If I bought an annual tier, can I request a full refund?"',
    text: 'If I bought an annual tier, can I request a full refund?',
    model: 'fast'
  },
  {
    group: 'Cache Boundary & Threshold Guardrails',
    label: 'Near-Miss Guard (Rejection): "What are the configuration steps for 2FA on Linux?"',
    text: 'What are the configuration steps for two-factor authentication on Linux?',
    model: 'fast'
  },
  {
    group: 'Dynamic Adaptive Router Proofs',
    label: 'Auto → Fast Tier (Low Complexity): "What is the capital of France?"',
    text: 'What is the capital of France?',
    model: 'auto'
  },
  {
    group: 'Dynamic Adaptive Router Proofs',
    label: 'Auto → Smart Tier (High Complexity): "Design a distributed rate limiter for 10M RPS"',
    text: 'Design a distributed rate limiter for 10M RPS and prove its correctness with mathematical bounds.',
    model: 'auto'
  },
  {
    group: 'Direct Upstream Model Execution',
    label: 'Direct Frontier: "Explain quantum computing in 2 concise sentences."',
    text: 'Explain quantum computing in 2 concise sentences.',
    model: 'openai/gpt-4o-mini'
  }
];
