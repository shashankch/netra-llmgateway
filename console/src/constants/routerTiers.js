/**
 * Classification tiers and default model options for routing.
 */

export const ROUTER_TIERS = [
  {
    id: 'fast',
    label: 'fast',
    iconName: 'Zap',
    color: 'var(--accent-cyan)',
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.35)',
    title: 'Fast (Latency Optimized: DeepSeek / Nemotron)'
  },
  {
    id: 'smart',
    label: 'smart',
    iconName: 'Sparkles',
    color: 'var(--accent-lime)',
    bg: 'rgba(163, 230, 53, 0.12)',
    border: 'rgba(163, 230, 53, 0.35)',
    title: 'Smart (Reasoning Frontier: Gemini / Claude / GPT)'
  },
  {
    id: 'auto',
    label: 'auto',
    iconName: 'Cpu',
    color: 'var(--accent-emerald)',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
    title: 'Auto (Syntactic Intent Classifier)'
  }
];

export const DEFAULT_UPSTREAM_MODELS = [
  'deepseek/deepseek-chat',
  'nvidia/nemotron-3.5-lightning',
  'openai/gpt-3.5-turbo-0613',
  'google/gemini-3.6-flash',
  'google/gemini-3.8-flash',
  'anthropic/claude-sonnet-4.6'
];
