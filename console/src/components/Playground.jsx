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

  // Selected virtual key
  const [virtualKey, setVirtualKey] = useState('netra-sk-search-1a2b3c');
  const [model, setModel] = useState('fast');
  const [stream, setStream] = useState(true);
  const [prompt, setPrompt] = useState('What is a load balancer and why is it needed?');
  const [systemPrompt, setSystemPrompt] = useState('You are NETRA, an enterprise AI assistant.');

  // Execution state
  const [executing, setExecuting] = useState(false);
  const [responseContent, setResponseContent] = useState('');
  const [telemetry, setTelemetry] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [copiedResponse, setCopiedResponse] = useState(false);

  // Dynamic Gateway Catalog & Virtual Key Configuration
  const [catalog, setCatalog] = useState(null);
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
          if (isMounted) setCatalog(pricingJson);
        }
        if (keysRes.status === 'fulfilled' && keysRes.value.ok) {
          const keysJson = await keysRes.value.json();
          if (isMounted && Array.isArray(keysJson) && keysJson.length > 0) {
            setTenantKeys(keysJson);
            // If current key is default demo, auto-select first active real key
            if (keysJson.some(k => k.status === 'ACTIVE')) {
              const firstActive = keysJson.find(k => k.status === 'ACTIVE');
              if (firstActive && virtualKey === 'netra-sk-search-1a2b3c') {
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

  // Quick prompt templates
  const promptTemplates = [
    {
      label: 'Paraphrase Pair A (Original)',
      text: 'What is a load balancer and why is it needed?',
      model: 'fast'
    },
    {
      label: 'Paraphrase Pair A (Paraphrase)',
      text: 'Explain what load balancers do in distributed web systems.',
      model: 'fast'
    },
    {
      label: 'Paraphrase Pair B (Original)',
      text: 'What is the refund policy for annual subscription plans?',
      model: 'fast'
    },
    {
      label: 'Paraphrase Pair B (Paraphrase)',
      text: 'If I bought an annual tier, can I request a full refund?',
      model: 'fast'
    },
    {
      label: 'Near-Miss Prompt (Rejection)',
      text: 'What are the configuration steps for two-factor authentication on Linux?',
      model: 'fast'
    },
    {
      label: 'Complex Auto Router',
      text: 'Design a distributed rate limiter for 10M RPS and prove its correctness with mathematical bounds.',
      model: 'auto'
    },
    {
      label: 'Simple Auto Router',
      text: 'What is the capital of France?',
      model: 'auto'
    },
    {
      label: 'OpenRouter Upstream (GPT-4o Mini)',
      text: 'Explain quantum computing in 2 concise sentences.',
      model: 'openai/gpt-4o-mini'
    }
  ];

  const activeTemplate = promptTemplates.find(t => t.text === prompt);
  const isCustomPrompt = !activeTemplate && prompt.trim().length > 0;

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
        status: response.status
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
      } else {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content || JSON.stringify(json, null, 2);
        setResponseContent(content);
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
              const fastTargetModel = catalog?.aliases?.fast?.primary ? catalog.aliases.fast.primary.replace(/^[a-zA-Z0-9_-]+:/, '') : null;
              const smartTargetModel = catalog?.aliases?.smart?.primary ? catalog.aliases.smart.primary.replace(/^[a-zA-Z0-9_-]+:/, '') : null;
              const catalogModels = (catalog?.models || []).map(m => m.model).filter(Boolean);
              const aliasFallbackModels = [
                ...(catalog?.aliases?.fast?.fallbacks || []),
                ...(catalog?.aliases?.smart?.fallbacks || [])
              ].map(s => s.replace(/^[a-zA-Z0-9_-]+:/, '')).filter(Boolean);

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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        ROUTER / MODEL
                      </label>
                      {keyAllowlist.length > 0 && (
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: isAllowed ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                          {isAllowed ? 'Permitted' : 'Outside List'}
                        </span>
                      )}
                    </div>
                    <select
                      className="select-input"
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      style={{
                        fontSize: '0.78rem',
                        height: 32,
                        borderColor: (!isAllowed && keyAllowlist.length > 0) ? 'var(--accent-amber)' : undefined
                      }}
                    >
                      <optgroup label="Gateway Virtual Aliases">
                        <option value="fast">fast {fastTargetModel ? `(${fastTargetModel})` : '(Latency Optimized)'}</option>
                        <option value="smart">smart {smartTargetModel ? `(${smartTargetModel})` : '(Reasoning Frontier)'}</option>
                        <option value="auto">auto (Syntactic Classifier)</option>
                      </optgroup>

                      {availableConcreteModels.length > 0 ? (
                        <optgroup label="Configured Upstream Models">
                          {availableConcreteModels.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </optgroup>
                      ) : (
                        <optgroup label="Upstream Frontier Models">
                          <option value="deepseek/deepseek-chat">deepseek/deepseek-chat</option>
                          <option value="nvidia/nemotron-3.5-lightning">nvidia/nemotron-3.5-lightning</option>
                          <option value="openai/gpt-3.5-turbo-0613">openai/gpt-3.5-turbo-0613</option>
                          <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                          <option value="openai/gpt-4o">openai/gpt-4o</option>
                          <option value="google/gemini-2.0-flash-001">google/gemini-2.0-flash-001</option>
                          <option value="google/gemini-2.5-flash-lite">google/gemini-2.5-flash-lite</option>
                          <option value="google/gemini-3.6-flash">google/gemini-3.6-flash</option>
                          <option value="google/gemini-3.8-flash">google/gemini-3.8-flash</option>
                          <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
                          <option value="anthropic/claude-sonnet-4.6">anthropic/claude-sonnet-4.6</option>
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                      STREAMING MODE
                    </label>
                    <div style={{ display: 'flex', gap: '0.25rem', height: 32 }}>
                      <button
                        type="button"
                        onClick={() => setStream(true)}
                        className={`btn btn-sm ${stream ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, padding: '0.2rem', fontSize: '0.72rem' }}
                      >
                        SSE Stream
                      </button>
                      <button
                        type="button"
                        onClick={() => setStream(false)}
                        className={`btn btn-sm ${!stream ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, padding: '0.2rem', fontSize: '0.72rem' }}
                      >
                        JSON
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Benchmark Test Presets (Spacious Scenario Blocks & Dropdown) */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                BENCHMARK TEST PRESETS
              </label>

              {/* 4 Spacious Scenario Blocks */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem', marginBottom: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const t = promptTemplates[0];
                    setPrompt(t.text);
                    setModel(t.model);
                  }}
                  className={`btn btn-sm font-mono ${prompt === promptTemplates[0].text ? 'btn-secondary' : 'btn-outline'}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.4rem 0.55rem',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    height: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderRadius: 6,
                    borderColor: prompt === promptTemplates[0].text ? 'var(--accent-emerald)' : 'var(--border-subtle)',
                    background: prompt === promptTemplates[0].text ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                    color: prompt === promptTemplates[0].text ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Load semantic cache original prompt (Pair A)"
                >
                  <Sparkles size={12} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
                  <span style={{ fontWeight: prompt === promptTemplates[0].text ? 700 : 500 }}>Cache Hit (Pair A)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const t = promptTemplates[1];
                    setPrompt(t.text);
                    setModel(t.model);
                  }}
                  className={`btn btn-sm font-mono ${prompt === promptTemplates[1].text ? 'btn-secondary' : 'btn-outline'}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.4rem 0.55rem',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    height: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderRadius: 6,
                    borderColor: prompt === promptTemplates[1].text ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                    background: prompt === promptTemplates[1].text ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                    color: prompt === promptTemplates[1].text ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Load semantic paraphrase query to verify cache hit without token spend"
                >
                  <Database size={12} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                  <span style={{ fontWeight: prompt === promptTemplates[1].text ? 700 : 500 }}>Paraphrase Hit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const t = promptTemplates[4];
                    setPrompt(t.text);
                    setModel(t.model);
                  }}
                  className={`btn btn-sm font-mono ${prompt === promptTemplates[4].text ? 'btn-secondary' : 'btn-outline'}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.4rem 0.55rem',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    height: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderRadius: 6,
                    borderColor: prompt === promptTemplates[4].text ? 'var(--accent-rose)' : 'var(--border-subtle)',
                    background: prompt === promptTemplates[4].text ? 'rgba(244, 63, 94, 0.12)' : 'transparent',
                    color: prompt === promptTemplates[4].text ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Test strict similarity threshold rejection (<0.900) to defend cache against drift"
                >
                  <ShieldAlert size={12} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                  <span style={{ fontWeight: prompt === promptTemplates[4].text ? 700 : 500 }}>Near-Miss Guard</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const t = promptTemplates[5];
                    setPrompt(t.text);
                    setModel(t.model);
                  }}
                  className={`btn btn-sm font-mono ${prompt === promptTemplates[5].text ? 'btn-secondary' : 'btn-outline'}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.4rem 0.55rem',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    height: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderRadius: 6,
                    borderColor: prompt === promptTemplates[5].text ? 'var(--accent-amber)' : 'var(--border-subtle)',
                    background: prompt === promptTemplates[5].text ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                    color: prompt === promptTemplates[5].text ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Complex query routed to frontier smart tier via syntactic classifier"
                >
                  <Cpu size={12} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                  <span style={{ fontWeight: prompt === promptTemplates[5].text ? 700 : 500 }}>Auto Classifier</span>
                </button>
              </div>

              {/* Benchmark Template Dropdown */}
              <select
                className="select-input font-mono"
                style={{ 
                  fontSize: '0.75rem', 
                  height: 32, 
                  padding: '0 0.5rem',
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
                  <option value="" disabled>Select a benchmark template...</option>
                )}
                <optgroup label={isCustomPrompt ? "— Load a Benchmark Template —" : "Semantic Vector Cache Scenarios"}>
                  <option value="Paraphrase Pair A (Original)">Pair A (Original): What is a load balancer?</option>
                  <option value="Paraphrase Pair A (Paraphrase)">Pair A (Paraphrase): Explain what load balancers do</option>
                  <option value="Paraphrase Pair B (Original)">Pair B (Original): What is the refund policy?</option>
                  <option value="Paraphrase Pair B (Paraphrase)">Pair B (Paraphrase): If I bought annual tier, full refund?</option>
                  <option value="Near-Miss Prompt (Rejection)">Near-Miss Rejection: 2FA configuration on Linux</option>
                </optgroup>
                <optgroup label="Dynamic Router Classification">
                  <option value="Complex Auto Router">Complex Auto: Distributed rate limiter proof</option>
                  <option value="Simple Auto Router">Simple Auto: Capital of France</option>
                  <option value="OpenRouter Upstream (GPT-4o Mini)">Frontier Direct: Quantum computing in 2 sentences</option>
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
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  USER PROMPT
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  {activeTemplate ? (
                    <span 
                      className="badge font-mono" 
                      style={{ 
                        fontSize: '0.625rem', 
                        padding: '0.1rem 0.4rem',
                        background: 'rgba(14, 165, 233, 0.12)',
                        color: 'var(--accent-cyan)',
                        border: '1px solid rgba(14, 165, 233, 0.25)'
                      }}
                      title={`Active preset: ${activeTemplate.label}`}
                    >
                      PRESET: {activeTemplate.label.split(':')[0].replace('Paraphrase ', '')}
                    </span>
                  ) : prompt.trim() ? (
                    <span 
                      className="badge font-mono" 
                      style={{ 
                        fontSize: '0.625rem', 
                        padding: '0.1rem 0.4rem',
                        background: 'rgba(245, 158, 11, 0.12)',
                        color: '#d97706',
                        border: '1px solid rgba(245, 158, 11, 0.25)'
                      }}
                    >
                      CUSTOM ({prompt.length} chars)
                    </span>
                  ) : null}

                  {prompt && (
                    <button
                      type="button"
                      onClick={() => setPrompt('')}
                      className="btn btn-outline btn-sm font-mono"
                      style={{ 
                        padding: '0.1rem 0.35rem', 
                        fontSize: '0.65rem', 
                        height: 18, 
                        border: 'none', 
                        color: 'var(--text-muted)',
                        cursor: 'pointer' 
                      }}
                      title="Clear prompt text"
                    >
                      Clear
                    </button>
                  )}
                </div>
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
                    title="Accounting Cost for Transaction"
                  >
                    <Coins size={11} />
                    <span>{formatCurrency(telemetry.costUsd)}</span>
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

