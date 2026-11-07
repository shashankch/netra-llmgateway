import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getApiUrl } from '../config/api';
import { 
  Send, Sparkles, Database, ShieldAlert, Cpu, 
  Terminal, Zap, CheckCircle2, AlertTriangle, XCircle,
  Clock, Coins, Copy, Check, Trash2, RotateCcw
} from 'lucide-react';

export default function Playground({ adminToken = 'netra-admin-demo' }) {
  const { formatCurrency, currency } = useTheme();

  // Selected virtual key with sessionStorage persistence across tab navigation
  const [virtualKey, setVirtualKey] = useState(() => {
    try {
      return sessionStorage.getItem('netra_playground_vkey') || 'netra-sk-search-1a2b3c';
    } catch {
      return 'netra-sk-search-1a2b3c';
    }
  });
  const [model, setModel] = useState(() => {
    try {
      return sessionStorage.getItem('netra_playground_model') || 'fast';
    } catch {
      return 'fast';
    }
  });
  const [stream, setStream] = useState(() => {
    try {
      const stored = sessionStorage.getItem('netra_playground_stream');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [prompt, setPrompt] = useState(() => {
    try {
      const stored = sessionStorage.getItem('netra_playground_prompt');
      return stored !== null ? stored : 'What is a load balancer and why is it needed?';
    } catch {
      return 'What is a load balancer and why is it needed?';
    }
  });
  const [systemPrompt, setSystemPrompt] = useState(() => {
    try {
      const stored = sessionStorage.getItem('netra_playground_sysprompt');
      return stored !== null ? stored : 'You are NETRA, an enterprise AI assistant.';
    } catch {
      return 'You are NETRA, an enterprise AI assistant.';
    }
  });

  // Execution state with sessionStorage persistence
  const [executing, setExecuting] = useState(false);
  const [responseContent, setResponseContent] = useState(() => {
    try {
      return sessionStorage.getItem('netra_playground_response') || '';
    } catch {
      return '';
    }
  });
  const [telemetry, setTelemetry] = useState(() => {
    try {
      const stored = sessionStorage.getItem('netra_playground_telemetry');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [errorInfo, setErrorInfo] = useState(null);
  const [chunkCount, setChunkCount] = useState(() => {
    try {
      const stored = sessionStorage.getItem('netra_playground_chunk_count');
      return stored ? Number(stored) : 0;
    } catch {
      return 0;
    }
  });
  const [copiedResponse, setCopiedResponse] = useState(false);

  // Dynamic Gateway Catalog & Virtual Key Configuration with localStorage caching
  const [catalog, setCatalog] = useState(() => {
    try {
      const cached = localStorage.getItem('netra_pricing_catalog');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [tenantKeys, setTenantKeys] = useState([]);

  const abortControllerRef = useRef(null);
  const responseContainerRef = useRef(null);

  // Auto-scroll response container when streaming tokens arrive
  useEffect(() => {
    if (executing && responseContainerRef.current) {
      responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight;
    }
  }, [responseContent, executing]);

  // Load live pricing aliases, upstream models, and configured tenant keys
  useEffect(() => {
    let isMounted = true;
    const loadDynamicCatalog = async () => {
      try {
        const headers = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};
        const [pricingRes, keysRes] = await Promise.allSettled([
          fetch(getApiUrl('/admin/pricing'), { headers }),
          fetch(getApiUrl('/admin/keys'), { headers })
        ]);

        if (pricingRes.status === 'fulfilled' && pricingRes.value.ok) {
          const pricingJson = await pricingRes.value.json();
          if (isMounted) {
            setCatalog(pricingJson);
            try { localStorage.setItem('netra_pricing_catalog', JSON.stringify(pricingJson)); } catch (e) {}
          }
        }
        if (keysRes.status === 'fulfilled' && keysRes.value.ok) {
          const keysJson = await keysRes.value.json();
          if (isMounted && Array.isArray(keysJson) && keysJson.length > 0) {
            setTenantKeys(keysJson);
            // If current key is default demo and no saved key in session, auto-select first active real key
            if (keysJson.some(k => k.status === 'ACTIVE')) {
              const firstActive = keysJson.find(k => k.status === 'ACTIVE');
              const hasPersistedKey = (() => {
                try { return !!sessionStorage.getItem('netra_playground_vkey'); } catch { return false; }
              })();
              if (firstActive && virtualKey === 'netra-sk-search-1a2b3c' && !hasPersistedKey) {
                setVirtualKey(firstActive.virtual_key);
                if (firstActive.model_allowlist && firstActive.model_allowlist.length > 0) {
                  setModel(firstActive.model_allowlist[0]);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not load dynamic pricing or keys in Playground:', err);
      }
    };
    loadDynamicCatalog();
    return () => { isMounted = false; };
  }, [adminToken]);

  // Support seamless deep-linking / prefill from Vector Cache Inspector
  useEffect(() => {
    try {
      const prefillPrompt = sessionStorage.getItem('netra_playground_prefill_prompt');
      const prefillKey = sessionStorage.getItem('netra_playground_prefill_key');
      if (prefillPrompt) {
        setPrompt(prefillPrompt);
        sessionStorage.removeItem('netra_playground_prefill_prompt');
      }
      if (prefillKey) {
        setVirtualKey(prefillKey);
        sessionStorage.removeItem('netra_playground_prefill_key');
      }
    } catch (e) {
      // Ignore sessionStorage permission errors
    }
  }, []);

  // Sync state variables to sessionStorage so state is preserved across tab navigation
  useEffect(() => {
    try { sessionStorage.setItem('netra_playground_vkey', virtualKey); } catch (e) {}
  }, [virtualKey]);

  useEffect(() => {
    try { sessionStorage.setItem('netra_playground_model', model); } catch (e) {}
  }, [model]);

  useEffect(() => {
    try { sessionStorage.setItem('netra_playground_stream', String(stream)); } catch (e) {}
  }, [stream]);

  useEffect(() => {
    try { sessionStorage.setItem('netra_playground_prompt', prompt); } catch (e) {}
  }, [prompt]);

  useEffect(() => {
    try { sessionStorage.setItem('netra_playground_sysprompt', systemPrompt); } catch (e) {}
  }, [systemPrompt]);

  useEffect(() => {
    try {
      if (responseContent) {
        sessionStorage.setItem('netra_playground_response', responseContent);
      } else {
        sessionStorage.removeItem('netra_playground_response');
      }
    } catch (e) {}
  }, [responseContent]);

  useEffect(() => {
    try {
      if (telemetry) {
        sessionStorage.setItem('netra_playground_telemetry', JSON.stringify(telemetry));
      } else {
        sessionStorage.removeItem('netra_playground_telemetry');
      }
    } catch (e) {}
  }, [telemetry]);

  useEffect(() => {
    try {
      if (chunkCount > 0) {
        sessionStorage.setItem('netra_playground_chunk_count', String(chunkCount));
      } else {
        sessionStorage.removeItem('netra_playground_chunk_count');
      }
    } catch (e) {}
  }, [chunkCount]);

  const copyResponseToClipboard = () => {
    if (!responseContent) return;
    navigator.clipboard.writeText(responseContent);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleClearOutput = () => {
    setResponseContent('');
    setTelemetry(null);
    setErrorInfo(null);
    setChunkCount(0);
    try {
      sessionStorage.removeItem('netra_playground_response');
      sessionStorage.removeItem('netra_playground_telemetry');
      sessionStorage.removeItem('netra_playground_chunk_count');
    } catch (e) {}
  };

  // Dynamic profiles from live database or pre-seeded fallbacks
  const presets = tenantKeys.length > 0
    ? tenantKeys.slice(0, 4).map(k => ({
        label: k.team || 'Tenant',
        key: k.virtual_key,
        model: (k.model_allowlist && k.model_allowlist.length > 0) ? k.model_allowlist[0] : 'fast',
        desc: `RPM: ${k.rpm_limit}, Cache: ${k.semantic_cache_enabled ? `\u2265 ${k.similarity_threshold}` : 'Off'}`
      }))
    : [
        { label: 'Search Team', key: 'netra-sk-search-1a2b3c', model: 'fast', desc: 'Cache threshold: 0.92, RPM: 60' },
        { label: 'Research Team', key: 'netra-sk-research-4d5e6f', model: 'auto', desc: 'Auto router, cache: disabled' },
        { label: 'Free Tier', key: 'netra-sk-free-7g8h9i', model: 'fast', desc: 'RPM: 10, cache threshold: 0.85' },
        { label: 'Budget Demo', key: 'netra-sk-budget-demo-0j1k2l', model: 'fast', desc: 'Strict monthly limit demonstration ($0.00001 cap)' },
      ];

  // Grouped Benchmark Scenarios with explicit Pair A, Pair B, Guardrails, and Dynamic Routing proofs
  const promptTemplates = [
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

  const activeTemplate = promptTemplates.find(t => t.text === prompt);
  const isCustomPrompt = !activeTemplate && prompt.trim().length > 0;

  // Real-time transaction pricing resolver matching active catalog rates
  const resolveModelPricing = (modelKey, providerTarget) => {
    if (!catalog) return { inputRate: 0.14, outputRate: 0.28 };

    // 1. Check explicit alias config in catalog
    if (modelKey === 'fast' && catalog.aliases?.fast) {
      const a = catalog.aliases.fast;
      const input = a.input_per_1m ?? a.inputPer1m ?? 0.14;
      const output = a.output_per_1m ?? a.outputPer1m ?? (input * 2);
      return { inputRate: input, outputRate: output };
    }
    if (modelKey === 'smart' && catalog.aliases?.smart) {
      const a = catalog.aliases.smart;
      const input = a.input_per_1m ?? a.inputPer1m ?? 0.75;
      const output = a.output_per_1m ?? a.outputPer1m ?? (input * 2);
      return { inputRate: input, outputRate: output };
    }

    // 2. Target from providerTarget (e.g. openrouter/deepseek-chat or openrouter/google/gemini-3.6-flash)
    const targetKey = (providerTarget || modelKey || '').toLowerCase();
    if (catalog.models && Array.isArray(catalog.models)) {
      const match = catalog.models.find(m => {
        const mn = (m.model || '').toLowerCase();
        return mn === targetKey || targetKey.endsWith('/' + mn) || mn.endsWith('/' + targetKey) || targetKey.includes(mn);
      });
      if (match) {
        const input = match.input_per_1m ?? match.inputPer1m ?? 0.14;
        const output = match.output_per_1m ?? match.outputPer1m ?? (input * 2);
        return { inputRate: input, outputRate: output };
      }
    }

    // 3. Fallback based on tier heuristics
    if (targetKey.includes('gemini') || targetKey.includes('flash') || targetKey.includes('deepseek') || targetKey.includes('small')) {
      return { inputRate: 0.14, outputRate: 0.28 };
    }
    if (targetKey.includes('claude') || targetKey.includes('gpt-4') || targetKey.includes('sonnet') || targetKey.includes('large') || targetKey.includes('smart')) {
      return { inputRate: 0.75, outputRate: 1.50 };
    }

    return { inputRate: 0.14, outputRate: 0.28 };
  };

  const computeInferenceCost = (modelKey, providerTarget, pTokens, cTokens) => {
    const { inputRate, outputRate } = resolveModelPricing(modelKey, providerTarget);
    const pCost = (pTokens * inputRate) / 1000000;
    const cCost = (cTokens * outputRate) / 1000000;
    return pCost + cCost;
  };

  const handleSend = async () => {
    if (!prompt.trim() || executing) return;

    setExecuting(true);
    setResponseContent('');
    setTelemetry(null);
    setErrorInfo(null);
    setChunkCount(0);

    const startTime = performance.now();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const payload = {
      model,
      stream,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ]
    };

    try {
      const response = await fetch(getApiUrl('/v1/chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${virtualKey}`,
        },
        body: JSON.stringify(payload),
        signal: abortController.signal
      });

      const latencyMs = Math.round(performance.now() - startTime);

      // Parse telemetry headers
      const tele = {
        provider: response.headers.get('x-netra-provider') || 'n/a',
        cache: response.headers.get('x-netra-cache') || 'miss',
        fallback: response.headers.get('x-netra-fallback') === 'true',
        costUsd: response.headers.get('x-netra-cost-usd') || '0.000000',
        routeReason: response.headers.get('x-netra-route-reason') || 'direct',
        retries: response.headers.get('x-netra-retries') || '0',
        latencyMs,
        status: response.status,
        promptTokens: 0,
        completionTokens: 0,
        isFinalized: false
      };
      setTelemetry(tele);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        setErrorInfo(errorBody.error || { message: `Request failed with HTTP ${response.status}` });
        setExecuting(false);
        return;
      }

      if (stream) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulated = '';
        let chunks = 0;
        let streamBuffer = '';
        let hasStreamError = false;
        let streamUsage = { prompt_tokens: 0, completion_tokens: 0 };

        while (!hasStreamError) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n');
          // Preserve trailing incomplete chunk across TCP/SSE boundaries
          streamBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                setErrorInfo(typeof parsed.error === 'string' ? { message: parsed.error } : parsed.error);
                setTelemetry(prev => ({ ...prev, status: 502 }));
                hasStreamError = true;
                break;
              }
              if (parsed.usage) {
                if (parsed.usage.prompt_tokens) streamUsage.prompt_tokens = parsed.usage.prompt_tokens;
                if (parsed.usage.completion_tokens) streamUsage.completion_tokens = parsed.usage.completion_tokens;
              }
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                accumulated += delta;
                setResponseContent(accumulated);
                chunks++;
                setChunkCount(chunks);
              }
            } catch (err) {
              // ignore malformed partial SSE line
            }
          }
        }

        if (hasStreamError) {
          reader.cancel().catch(() => {});
        } else if (streamBuffer.trim().startsWith('data: ')) {
          try {
            const dataStr = streamBuffer.trim().slice(6);
            if (dataStr !== '[DONE]') {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                setErrorInfo(parsed.error);
                setTelemetry(prev => ({ ...prev, status: 502 }));
              } else {
                if (parsed.usage) {
                  if (parsed.usage.prompt_tokens) streamUsage.prompt_tokens = parsed.usage.prompt_tokens;
                  if (parsed.usage.completion_tokens) streamUsage.completion_tokens = parsed.usage.completion_tokens;
                }
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  accumulated += delta;
                  setResponseContent(accumulated);
                  chunks++;
                  setChunkCount(chunks);
                }
              }
            }
          } catch (err) {
            // ignore malformed trailing fragment
          }
        }

        // Finalize streaming metrics & dynamic cost calculation
        const promptText = (prompt || '') + ' ' + (systemPrompt || '');
        const pTokens = streamUsage.prompt_tokens > 0
          ? streamUsage.prompt_tokens
          : Math.max(1, Math.round(promptText.trim().split(/\s+/).length * 1.3));
        const cTokens = streamUsage.completion_tokens > 0
          ? streamUsage.completion_tokens
          : Math.max(1, Math.round(accumulated.trim().split(/\s+/).length * 1.3));

        let finalCost = 0;
        if (tele.cache !== 'hit') {
          finalCost = computeInferenceCost(model, tele.provider, pTokens, cTokens);
        }

        setTelemetry(prev => ({
          ...prev,
          latencyMs: Math.round(performance.now() - startTime),
          promptTokens: pTokens,
          completionTokens: cTokens,
          costUsd: finalCost.toFixed(6),
          isFinalized: true
        }));
      } else {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content || JSON.stringify(json, null, 2);
        setResponseContent(content);

        const promptText = (prompt || '') + ' ' + (systemPrompt || '');
        const pTokens = json.usage?.prompt_tokens ?? Math.max(1, Math.round(promptText.trim().split(/\s+/).length * 1.3));
        const cTokens = json.usage?.completion_tokens ?? Math.max(1, Math.round((content || '').trim().split(/\s+/).length * 1.3));

        let finalCost = 0;
        if (tele.cache !== 'hit') {
          if (tele.costUsd && Number(tele.costUsd) > 0) {
            finalCost = Number(tele.costUsd);
          } else {
            finalCost = computeInferenceCost(model, tele.provider, pTokens, cTokens);
          }
        }

        setTelemetry(prev => ({
          ...prev,
          latencyMs: Math.round(performance.now() - startTime),
          promptTokens: pTokens,
          completionTokens: cTokens,
          costUsd: finalCost.toFixed(6),
          isFinalized: true
        }));
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorInfo({ message: err.message || 'Network error communicating with NETRA' });
      }
    } finally {
      setExecuting(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setExecuting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Compact Header & Integrated Profile Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            Prompt Playground &amp; Execution Sandbox
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: '0.15rem 0 0 0' }}>
            Interactive inference proxy with real-time SSE streaming, semantic caching, and automated router failover.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginRight: '0.15rem' }}>
            Profile:
          </span>
          {presets.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setVirtualKey(p.key);
                setModel(p.model);
              }}
              className={`btn btn-sm ${virtualKey === p.key ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', height: 26, gap: '0.25rem' }}
              title={`${p.label} (${p.desc})`}
            >
              <Zap size={11} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Form & Response Layout (Strict Viewport Bounded & Zero Window Scrollbar) */}
      <div 
        className="playground-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(330px, 440px) 1fr',
          gap: '1.25rem',
          alignItems: 'stretch'
        }}
      >
        {/* Controls Column (Pinned Dispatch Action & Scrollable Settings) */}
        <div 
          className="card" 
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 170px)',
            minHeight: 480,
            padding: '1.1rem',
            overflow: 'hidden'
          }}
        >
          {/* Scrollable Upper Configuration Section */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
            
            {/* API Key */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  TENANT VIRTUAL KEY (INFERENCE)
                </label>
                <span className="badge badge-neutral font-mono" style={{ fontSize: '0.625rem' }}>Bearer Auth</span>
              </div>
              <input
                type="text"
                className="input-text font-mono"
                value={virtualKey}
                onChange={e => setVirtualKey(e.target.value)}
                placeholder="netra-sk-..."
                style={{ fontSize: '0.78rem', height: 32 }}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
              />
            </div>

            {/* Model & Streaming Toggle */}
            {(() => {
              const fastTargetModel = catalog?.aliases?.fast?.primary ? catalog.aliases.fast.primary.replace(/^[a-zA-Z0-9_-]+:/, '').trim() : null;
              const smartTargetModel = catalog?.aliases?.smart?.primary ? catalog.aliases.smart.primary.replace(/^[a-zA-Z0-9_-]+:/, '').trim() : null;
              
              // Dynamic models from database catalog (split on commas in case composite entries exist)
              const catalogModels = (catalog?.models || [])
                .map(m => m.model)
                .flatMap(s => (typeof s === 'string' ? s.split(',') : [s]))
                .map(s => String(s).trim().replace(/^[a-zA-Z0-9_-]+:/, ''))
                .filter(Boolean);

              // Fallback models from alias config (properly split comma-delimited strings from env vars)
              const aliasFallbackModels = [
                ...(catalog?.aliases?.fast?.fallbacks || []),
                ...(catalog?.aliases?.smart?.fallbacks || [])
              ]
                .flatMap(s => (typeof s === 'string' ? s.split(',') : [s]))
                .map(s => String(s).trim().replace(/^[a-zA-Z0-9_-]+:/, ''))
                .filter(Boolean);

              const availableConcreteModels = Array.from(new Set([
                ...(fastTargetModel ? [fastTargetModel] : []),
                ...(smartTargetModel ? [smartTargetModel] : []),
                ...catalogModels,
                ...aliasFallbackModels
              ])).filter(m => !['fast', 'smart', 'auto'].includes(m));

              const currentKeyObj = tenantKeys.find(k => k.virtual_key === virtualKey);
              const keyAllowlist = currentKeyObj?.model_allowlist || [];
              const isAllowed = keyAllowlist.length === 0 || keyAllowlist.includes(model);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {/* Row 1: Router Classification Badges + Stream / JSON Slider */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '0.65rem', alignItems: 'flex-start' }}>
                    {/* Dynamic Router Badges */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                        ROUTER CLASSIFICATION
                      </label>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {[
                          { id: 'fast', label: 'fast', icon: Zap, color: 'var(--accent-cyan)', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.35)', title: 'Fast (Latency Optimized: DeepSeek / Nemotron)' },
                          { id: 'smart', label: 'smart', icon: Sparkles, color: 'var(--accent-lime)', bg: 'rgba(163, 230, 53, 0.12)', border: 'rgba(163, 230, 53, 0.35)', title: 'Smart (Reasoning Frontier: Gemini / Claude / GPT)' },
                          { id: 'auto', label: 'auto', icon: Cpu, color: 'var(--accent-emerald)', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', title: 'Auto (Syntactic Intent Classifier)' }
                        ].map(tier => {
                          const IconComponent = tier.icon;
                          const isActive = model === tier.id;
                          return (
                            <button
                              key={tier.id}
                              type="button"
                              onClick={() => setModel(tier.id)}
                              style={{
                                flex: 1,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                fontSize: '0.75rem',
                                fontWeight: isActive ? 700 : 500,
                                fontFamily: 'var(--font-mono)',
                                borderRadius: 6,
                                border: `1px solid ${isActive ? tier.border : 'var(--border-subtle)'}`,
                                background: isActive ? tier.bg : 'var(--bg-card)',
                                color: isActive ? tier.color : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: isActive ? `0 0 10px ${tier.bg}` : 'none'
                              }}
                              title={tier.title}
                            >
                              <IconComponent size={12} style={{ color: isActive ? tier.color : 'var(--text-muted)' }} />
                              <span>{tier.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Stream / JSON Slider */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                        STREAMING MODE
                      </label>
                      <div style={{
                        display: 'flex',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        padding: 2,
                        height: 32
                      }}>
                        <button
                          type="button"
                          onClick={() => setStream(true)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            fontSize: '0.72rem',
                            fontWeight: stream ? 700 : 500,
                            borderRadius: 4,
                            border: 'none',
                            background: stream ? 'var(--accent-lime)' : 'transparent',
                            color: stream ? '#000000' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Zap size={11} style={{ fill: stream ? '#000000' : 'none' }} />
                          <span>Stream</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStream(false)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            fontSize: '0.72rem',
                            fontWeight: !stream ? 700 : 500,
                            borderRadius: 4,
                            border: 'none',
                            background: !stream ? 'var(--accent-lime)' : 'transparent',
                            color: !stream ? '#000000' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Terminal size={11} />
                          <span>JSON</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Concrete Model Dropdown (for testing specific models directly) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        DIRECT MODEL OVERRIDE
                      </label>
                      {!['fast', 'smart', 'auto'].includes(model) && (
                        <span className="badge font-mono" style={{ fontSize: '0.625rem', padding: '0.1rem 0.35rem', background: 'rgba(6, 182, 212, 0.12)', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                          Direct Upstream Active
                        </span>
                      )}
                    </div>
                    <select
                      className="select-input font-mono"
                      value={['fast', 'smart', 'auto'].includes(model) ? '' : model}
                      onChange={e => {
                        if (e.target.value) setModel(e.target.value);
                      }}
                      style={{
                        fontSize: '0.78rem',
                        height: 38,
                        lineHeight: '1.4',
                        padding: '0.4rem 0.65rem',
                        boxSizing: 'border-box',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        borderColor: !['fast', 'smart', 'auto'].includes(model) ? 'var(--accent-cyan)' : 'var(--border-subtle)'
                      }}
                    >
                      <option value="">— Use Router Alias Above ({model}) —</option>
                      {availableConcreteModels.length > 0 ? (
                        <>
                          {keyAllowlist.length > 0 && availableConcreteModels.some(m => keyAllowlist.includes(m)) && (
                            <optgroup label="Allowed for Current Key">
                              {availableConcreteModels.filter(m => keyAllowlist.includes(m)).map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label={keyAllowlist.length > 0 ? "All Configured Upstream Models" : "Available Models"}>
                            {availableConcreteModels.filter(m => !keyAllowlist.includes(m)).map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </optgroup>
                        </>
                      ) : (
                        <>
                          <optgroup label="Upstream Production Models">
                            <option value="deepseek/deepseek-chat">deepseek/deepseek-chat</option>
                            <option value="nvidia/nemotron-3.5-lightning">nvidia/nemotron-3.5-lightning</option>
                            <option value="openai/gpt-3.5-turbo-0613">openai/gpt-3.5-turbo-0613</option>
                            <option value="google/gemini-3.6-flash">google/gemini-3.6-flash</option>
                            <option value="google/gemini-3.8-flash">google/gemini-3.8-flash</option>
                            <option value="anthropic/claude-sonnet-4.6">anthropic/claude-sonnet-4.6</option>
                          </optgroup>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              );
            })()}

            {/* Benchmark Test Scenarios Dropdown */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                BENCHMARK TEST SCENARIOS
              </label>

              <select
                className="select-input font-mono"
                style={{ 
                  fontSize: '0.78rem', 
                  height: 38, 
                  lineHeight: '1.4',
                  padding: '0.4rem 0.65rem',
                  boxSizing: 'border-box',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  borderColor: isCustomPrompt ? 'rgba(245, 158, 11, 0.35)' : 'var(--border-subtle)',
                  background: isCustomPrompt ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                  color: isCustomPrompt ? 'var(--text-primary)' : 'inherit',
                  transition: 'all 0.15s ease'
                }}
                value={activeTemplate ? activeTemplate.label : (isCustomPrompt ? '__custom__' : '')}
                onChange={e => {
                  if (e.target.value === '__custom__') return;
                  const found = promptTemplates.find(t => t.label === e.target.value);
                  if (found) {
                    setPrompt(found.text);
                    setModel(found.model);
                  }
                }}
              >
                {isCustomPrompt ? (
                  <option value="__custom__">✍️ Custom Prompt (Active)</option>
                ) : (
                  <option value="" disabled>Select a benchmark scenario...</option>
                )}
                <optgroup label="Semantic Vector Cache — Pair A (Distributed Web Systems)">
                  <option value={promptTemplates[0].label}>Pair A · Step 1 (Seed Cache): What is a load balancer?</option>
                  <option value={promptTemplates[1].label}>Pair A · Step 2 (Semantic Hit): Explain what load balancers do</option>
                </optgroup>
                <optgroup label="Semantic Vector Cache — Pair B (Commercial SaaS Policy)">
                  <option value={promptTemplates[2].label}>Pair B · Step 1 (Seed Cache): What is the refund policy?</option>
                  <option value={promptTemplates[3].label}>Pair B · Step 2 (Semantic Hit): If I bought annual tier, full refund?</option>
                </optgroup>
                <optgroup label="Cache Boundary &amp; Threshold Guardrails">
                  <option value={promptTemplates[4].label}>Near-Miss Guard (Rejection): 2FA configuration on Linux</option>
                </optgroup>
                <optgroup label="Dynamic Adaptive Router Intent Proofs">
                  <option value={promptTemplates[5].label}>Auto → Fast Tier (Low Complexity): Capital of France</option>
                  <option value={promptTemplates[6].label}>Auto → Smart Tier (High Complexity): Distributed rate limiter</option>
                </optgroup>
                <optgroup label="Direct Upstream Frontier">
                  <option value={promptTemplates[7].label}>Frontier Direct: Quantum computing in 2 sentences</option>
                </optgroup>
              </select>
            </div>

            {/* System Prompt */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                SYSTEM PROMPT (OPTIONAL)
              </label>
              <input
                type="text"
                className="input-text"
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                style={{ fontSize: '0.78rem', height: 32 }}
                placeholder="You are NETRA, an enterprise AI assistant."
              />
            </div>

            {/* User Prompt */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 85 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                  USER PROMPT
                </label>
                {prompt && (
                  <button
                    type="button"
                    onClick={() => setPrompt('')}
                    className="btn btn-outline btn-sm font-mono"
                    style={{ 
                      padding: '0.1rem 0.45rem', 
                      fontSize: '0.68rem', 
                      height: 20, 
                      border: '1px solid var(--border-subtle)', 
                      color: 'var(--text-muted)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                    title="Clear prompt text"
                  >
                    <RotateCcw size={10} />
                    <span>Clear</span>
                  </button>
                )}
              </div>
              <textarea
                className="textarea-input"
                rows={3}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Enter prompt to execute across smart router..."
                style={{ resize: 'vertical', fontSize: '0.8125rem', flex: 1, minHeight: 70, maxHeight: 120 }}
              />
            </div>
          </div>

          {/* Pinned Bottom Submit Action Bar (Always Visible, Never Pushed Offscreen) */}
          <div style={{
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '0.5rem',
            marginTop: 'auto',
            background: 'var(--bg-card)'
          }}>
            <button
              onClick={handleSend}
              disabled={executing || !prompt.trim()}
              className="btn btn-primary"
              style={{
                flex: 1,
                height: 38,
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem'
              }}
            >
              <Send size={15} />
              <span>{executing ? 'Streaming Response...' : 'Dispatch Request'}</span>
            </button>
            {executing && (
              <button 
                onClick={handleStop} 
                className="btn btn-secondary"
                style={{ height: 38, padding: '0 1rem', fontWeight: 600 }}
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Response & Telemetry Column (ChatGPT-Style Scrolling Container) */}
        <div 
          className="card" 
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            height: 'calc(100vh - 170px)',
            minHeight: 480,
            padding: '1.1rem',
            overflow: 'hidden'
          }}
        >
          {/* Sleek Enterprise Execution Header Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, letterSpacing: '-0.01em' }}>Response</span>
                {executing && (
                  <span className="pulse-indicator" style={{ width: 7, height: 7 }} />
                )}
              </div>

              {telemetry && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span 
                    className="font-mono" 
                    style={{ 
                      fontSize: '0.7rem', 
                      padding: '0.15rem 0.5rem', 
                      borderRadius: 4, 
                      fontWeight: 700, 
                      background: telemetry.status === 200 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                      color: telemetry.status === 200 ? 'var(--accent-emerald)' : 'var(--accent-rose)' 
                    }}
                  >
                    {telemetry.status === 200 ? '200 OK' : `HTTP ${telemetry.status}`}
                  </span>

                  <span 
                    className="font-mono" 
                    style={{ 
                      fontSize: '0.7rem', 
                      padding: '0.15rem 0.5rem', 
                      borderRadius: 4, 
                      fontWeight: 600, 
                      background: 'rgba(255, 255, 255, 0.04)', 
                      color: 'var(--text-secondary)', 
                      border: '1px solid var(--border-subtle)', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.3rem' 
                    }}
                    title="Upstream Execution Provider"
                  >
                    <Cpu size={11} />
                    <span>{telemetry.provider}</span>
                  </span>

                  <span 
                    className="font-mono" 
                    style={{ 
                      fontSize: '0.7rem', 
                      padding: '0.15rem 0.5rem', 
                      borderRadius: 4, 
                      fontWeight: 700, 
                      background: telemetry.cache === 'hit' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)', 
                      color: telemetry.cache === 'hit' ? 'var(--accent-emerald)' : 'var(--text-secondary)', 
                      border: `1px solid ${telemetry.cache === 'hit' ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-subtle)'}`, 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.3rem' 
                    }}
                    title="Semantic Vector Cache Resolution"
                  >
                    <Database size={11} />
                    <span>{telemetry.cache === 'hit' ? 'CACHE HIT' : 'CACHE MISS'}</span>
                  </span>

                  <span 
                    className="font-mono" 
                    style={{ 
                      fontSize: '0.7rem', 
                      padding: '0.15rem 0.5rem', 
                      borderRadius: 4, 
                      fontWeight: 600, 
                      background: 'rgba(255, 255, 255, 0.04)', 
                      color: 'var(--text-secondary)', 
                      border: '1px solid var(--border-subtle)', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.3rem' 
                    }}
                    title="Total E2E Gateway Latency"
                  >
                    <Clock size={11} />
                    <span>{telemetry.latencyMs}ms</span>
                  </span>

                  <span 
                    className="font-mono" 
                    style={{ 
                      fontSize: '0.7rem', 
                      padding: '0.15rem 0.5rem', 
                      borderRadius: 4, 
                      fontWeight: 600, 
                      background: 'rgba(255, 255, 255, 0.04)', 
                      color: 'var(--text-secondary)', 
                      border: '1px solid var(--border-subtle)', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.3rem' 
                    }}
                    title={
                      telemetry.cache === 'hit'
                        ? 'Cached Response — $0.00 Incurred (Upstream token cost eliminated)'
                        : `Total Transaction Cost: ${formatCurrency(telemetry.costUsd)} (${telemetry.promptTokens || 0} prompt + ${telemetry.completionTokens || 0} completion tokens)`
                    }
                  >
                    <Coins size={11} style={{ color: telemetry.cache === 'hit' ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
                    {executing && !telemetry.isFinalized ? (
                      <span style={{ color: 'var(--accent-cyan)' }}>Streaming...</span>
                    ) : (
                      <span>
                        {formatCurrency(telemetry.costUsd)}
                        {telemetry.cache === 'hit' && (
                          <span style={{ fontSize: '0.625rem', color: 'var(--accent-emerald)', marginLeft: '0.25rem', fontWeight: 700 }}>
                            (Cached)
                          </span>
                        )}
                      </span>
                    )}
                  </span>

                  {telemetry.fallback && (
                    <span 
                      className="font-mono" 
                      style={{ 
                        fontSize: '0.7rem', 
                        padding: '0.15rem 0.5rem', 
                        borderRadius: 4, 
                        fontWeight: 700, 
                        background: 'rgba(245, 158, 11, 0.12)', 
                        color: 'var(--accent-amber)', 
                        border: '1px solid rgba(245, 158, 11, 0.25)', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.3rem' 
                      }}
                      title="Request Recovered via Automated Fast-Failover Fallback"
                    >
                      <AlertTriangle size={11} />
                      <span>FAILOVER</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick Output Actions: Copy & Clear */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {responseContent && (
                <>
                  <button
                    type="button"
                    onClick={copyResponseToClipboard}
                    className="btn btn-outline btn-sm font-mono"
                    style={{
                      padding: '0.25rem 0.55rem',
                      height: 26,
                      fontSize: '0.72rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      color: copiedResponse ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                      borderColor: copiedResponse ? 'var(--accent-emerald)' : 'var(--border-subtle)',
                      background: copiedResponse ? 'rgba(16, 185, 129, 0.08)' : 'transparent'
                    }}
                    title="Copy response markdown to clipboard"
                  >
                    {copiedResponse ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedResponse ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearOutput}
                    className="btn btn-outline btn-sm"
                    style={{ padding: '0.25rem 0.45rem', height: 26, color: 'var(--text-muted)' }}
                    title="Clear response output"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Unified Enterprise Route & Decision Banner */}
          {telemetry?.routeReason && (
            <div style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '0.45rem 0.75rem',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <Zap size={13} style={{ color: 'var(--accent-lime)', flexShrink: 0 }} />
                <span style={{ 
                  fontWeight: 700, 
                  color: 'var(--text-secondary)', 
                  letterSpacing: '0.02em', 
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase'
                }}>
                  Gateway Routing:
                </span>
                <span className="font-mono" style={{ color: 'var(--text-code)' }}>{telemetry.routeReason}</span>
              </div>
              {telemetry.retries > 0 && (
                <span className="font-mono" style={{ color: 'var(--accent-amber)', fontWeight: 600, fontSize: '0.6875rem' }}>
                  ({telemetry.retries} retries absorbed)
                </span>
              )}
            </div>
          )}

          {/* Response Body Area (Scrollable Inner Container, Exactly Like ChatGPT) */}
          <div 
            ref={responseContainerRef}
            style={{
              flex: 1,
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '1.25rem',
              fontFamily: stream ? 'inherit' : 'var(--font-mono)',
              fontSize: '0.875rem',
              lineHeight: 1.65,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              position: 'relative'
            }}
          >
            {errorInfo ? (
              <div style={{ color: 'var(--accent-rose)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                  <XCircle size={18} />
                  <span>{errorInfo.type || 'Inference Error'}</span>
                </div>
                <div style={{ fontSize: '0.8125rem' }}>{errorInfo.message}</div>
                {errorInfo.code && <div className="font-mono" style={{ fontSize: '0.75rem' }}>Code: {errorInfo.code}</div>}
              </div>
            ) : responseContent ? (
              <div>
                {responseContent}
                {executing && (
                  <span style={{
                    display: 'inline-block',
                    width: 7,
                    height: 15,
                    backgroundColor: 'var(--accent-primary)',
                    marginLeft: 4,
                    verticalAlign: 'middle',
                    animation: 'pulse 1s infinite'
                  }} />
                )}
              </div>
            ) : executing ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="pulse-indicator" />
                <span>Awaiting first token from upstream inference provider...</span>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <Terminal size={32} style={{ opacity: 0.3 }} />
                <div style={{ maxWidth: 360, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  Select a test preset or type a prompt on the left, then click <strong>Dispatch Request</strong> to test streaming completions and dynamic model routing.
                </div>
              </div>
            )}
          </div>

          {/* Bottom Stream Status */}
          {stream && chunkCount > 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.2rem' }}>
              <span className="font-mono">SSE Tokens Received: {chunkCount}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="pulse-indicator" style={{ width: 6, height: 6 }} />
                <span className="font-mono">text/event-stream</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

