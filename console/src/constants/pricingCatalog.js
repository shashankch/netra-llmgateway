/**
 * Default catalog pricing models and provider display name formatting mappings.
 */

export const DEFAULT_PRICING_MODELS = [
  { model: 'alpha-small', provider: 'alpha', input_per_1m: 0.15, output_per_1m: 0.60, context_window: '128k' },
  { model: 'alpha-large', provider: 'alpha', input_per_1m: 3.00, output_per_1m: 15.00, context_window: '128k' },
  { model: 'beta-small', provider: 'beta', input_per_1m: 0.10, output_per_1m: 0.40, context_window: '128k' },
  { model: 'beta-large', provider: 'beta', input_per_1m: 2.50, output_per_1m: 10.00, context_window: '128k' },
  { model: 'deepseek/deepseek-chat', provider: 'deepseek', input_per_1m: 0.14, output_per_1m: 0.28, context_window: '128k' },
  { model: 'deepseek/deepseek-r1', provider: 'deepseek', input_per_1m: 0.55, output_per_1m: 2.19, context_window: '128k' },
  { model: 'nvidia/nemotron-3.5-lightning', provider: 'nvidia', input_per_1m: 0.07, output_per_1m: 0.20, context_window: '128k' },
  { model: 'openai/gpt-4o-mini', provider: 'openai', input_per_1m: 0.15, output_per_1m: 0.60, context_window: '128k' },
  { model: 'openai/gpt-4o', provider: 'openai', input_per_1m: 2.50, output_per_1m: 10.00, context_window: '128k' },
  { model: 'openai/gpt-4.1-nano', provider: 'openai', input_per_1m: 0.10, output_per_1m: 0.40, context_window: '128k' },
  { model: 'openai/gpt-3.5-turbo-0613', provider: 'openai', input_per_1m: 1.00, output_per_1m: 2.00, context_window: '16k' },
  { model: 'openai/o3-mini', provider: 'openai', input_per_1m: 1.10, output_per_1m: 4.40, context_window: '200k' },
  { model: 'google/gemini-2.0-flash-001', provider: 'google', input_per_1m: 0.10, output_per_1m: 0.40, context_window: '1M' },
  { model: 'google/gemini-2.5-flash-lite', provider: 'google', input_per_1m: 0.10, output_per_1m: 0.40, context_window: '1M' },
  { model: 'google/gemini-3.6-flash', provider: 'google', input_per_1m: 0.75, output_per_1m: 3.75, context_window: '1M' },
  { model: 'google/gemini-3.8-flash', provider: 'google', input_per_1m: 0.75, output_per_1m: 3.75, context_window: '1M' },
  { model: 'anthropic/claude-3.5-sonnet', provider: 'anthropic', input_per_1m: 3.00, output_per_1m: 15.00, context_window: '200k' },
  { model: 'anthropic/claude-sonnet-4.6', provider: 'anthropic', input_per_1m: 3.00, output_per_1m: 15.00, context_window: '200k' },
  { model: 'meta-llama/llama-3.3-70b-instruct', provider: 'vllm-local', input_per_1m: 0.00, output_per_1m: 0.00, context_window: '131k' }
];

export const PROVIDER_NAME_MAP = {
  'openai': 'OpenAI',
  'google': 'Google',
  'anthropic': 'Anthropic',
  'deepseek': 'DeepSeek',
  'nvidia': 'NVIDIA',
  'alpha': 'Alpha',
  'beta': 'Beta',
  'vllm-local': 'vLLM Local',
  'vllm': 'vLLM'
};

export function formatProviderName(provider) {
  if (!provider) return '';
  if (provider.toUpperCase() === 'ALL') return 'All';
  const clean = provider.toLowerCase();
  return PROVIDER_NAME_MAP[clean] || (clean.charAt(0).toUpperCase() + clean.slice(1));
}
