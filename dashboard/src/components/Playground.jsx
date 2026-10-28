import React, { useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  Send, Sparkles, Database, ShieldAlert, Cpu, 
  Terminal, Zap, CheckCircle2, AlertTriangle, XCircle 
} from 'lucide-react';

export default function Playground() {
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

  const abortControllerRef = useRef(null);

  // Pre-seeded evaluator demo presets
  const presets = [
    { label: 'Search Team', key: 'netra-sk-search-1a2b3c', model: 'fast', desc: 'Cache threshold: 0.92, RPM: 60' },
    { label: 'Research Team', key: 'netra-sk-research-4d5e6f', model: 'auto', desc: 'Auto router, cache: disabled' },
    { label: 'Free Tier', key: 'netra-sk-free-7g8h9i', model: 'fast', desc: 'RPM: 10, cache threshold: 0.85' },
    { label: 'Budget Demo', key: 'netra-sk-budget-demo-0j1k2l', model: 'fast', desc: '$0.00001 cap (Drill 402)' },
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
    }
  ];

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
      const response = await fetch('/v1/chat/completions', {
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
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
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Interactive Evaluator Sandbox & Prompt Playground
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Test unbuffered SSE streaming typewriter, in-JVM semantic cache hits, auto-router classification, and provider failover live.
        </p>
      </div>

      {/* 1-Click Evaluator Presets Bar */}
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          1-Click Evaluator Demo Accounts:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {presets.map(p => (
            <button
              key={p.key}
              onClick={() => {
                setVirtualKey(p.key);
                setModel(p.model);
              }}
              className={`btn btn-sm ${virtualKey === p.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            >
              <Zap size={12} />
              <span>{p.label}</span>
              <span className="font-mono" style={{ opacity: 0.7, fontSize: '0.65rem' }}>({p.key.split('-')[2]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Form & Response Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '1.5rem' }}>
        {/* Controls Column */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Virtual API Key */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Virtual API Key:
            </label>
            <input
              type="text"
              className="input-text font-mono"
              value={virtualKey}
              onChange={e => setVirtualKey(e.target.value)}
              placeholder="netra-sk-..."
            />
          </div>

          {/* Model Alias & Streaming Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Model Alias:
              </label>
              <select
                className="select-input"
                value={model}
                onChange={e => setModel(e.target.value)}
              >
                <option value="fast">fast (Alpha-Small)</option>
                <option value="smart">smart (Alpha-Large)</option>
                <option value="auto">auto (Intelligent)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Mode:
              </label>
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                <button
                  type="button"
                  onClick={() => setStream(true)}
                  className={`btn btn-sm ${stream ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '0.45rem' }}
                >
                  SSE Stream
                </button>
                <button
                  type="button"
                  onClick={() => setStream(false)}
                  className={`btn btn-sm ${!stream ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '0.45rem' }}
                >
                  JSON
                </button>
              </div>
            </div>
          </div>

          {/* Prompt Templates */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Evaluation Test Presets:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {promptTemplates.map(t => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setPrompt(t.text);
                    setModel(t.model);
                  }}
                  className="btn btn-outline btn-sm"
                  style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '0.75rem' }}
                >
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              System Prompt (Optional):
            </label>
            <input
              type="text"
              className="input-text"
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
            />
          </div>

          {/* User Prompt */}
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              User Prompt:
            </label>
            <textarea
              className="textarea-input"
              rows={4}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Enter your prompt here..."
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
            <button
              onClick={handleSend}
              disabled={executing || !prompt.trim()}
              className="btn btn-primary"
              style={{ flex: 1, padding: '0.65rem' }}
            >
              <Send size={16} />
              <span>{executing ? 'Streaming Response...' : 'Dispatch Request'}</span>
            </button>
            {executing && (
              <button onClick={handleStop} className="btn btn-secondary">
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Response & Telemetry Column */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 450 }}>
          {/* Telemetry Header Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Telemetry Badges</span>
              {telemetry && (
                <span className={`badge ${telemetry.status === 200 ? 'badge-success' : 'badge-danger'}`}>
                  HTTP {telemetry.status}
                </span>
              )}
            </div>

            {telemetry && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                {/* Cache Badge */}
                <span className={`badge ${telemetry.cache === 'hit' ? 'badge-success' : 'badge-neutral'}`}>
                  <Database size={11} />
                  <span>Cache: {telemetry.cache.toUpperCase()}</span>
                </span>

                {/* Provider Badge */}
                <span className="badge badge-primary font-mono">
                  <Cpu size={11} />
                  <span>{telemetry.provider}</span>
                </span>

                {/* Fallback Warning */}
                {telemetry.fallback && (
                  <span className="badge badge-warning">
                    <AlertTriangle size={11} />
                    <span>Failover</span>
                  </span>
                )}

                {/* Cost Badge */}
                <span className="badge badge-neutral font-mono">
                  {formatCurrency(telemetry.costUsd)}
                </span>

                {/* Latency Badge */}
                <span className="badge badge-neutral font-mono">
                  {telemetry.latencyMs}ms
                </span>
              </div>
            )}
          </div>

          {/* Route Reason Callout */}
          {telemetry?.routeReason && (
            <div style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '0.4rem 0.75rem',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Route Reason:</span>
              <span className="font-mono" style={{ color: 'var(--text-code)' }}>{telemetry.routeReason}</span>
              {telemetry.retries > 0 && (
                <span style={{ marginLeft: 'auto', color: 'var(--accent-amber)', fontWeight: 600 }}>
                  ({telemetry.retries} retries absorbed)
                </span>
              )}
            </div>
          )}

          {/* Response Body Area */}
          <div style={{
            flex: 1,
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '1rem',
            fontFamily: stream ? 'inherit' : 'var(--font-mono)',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            overflowY: 'auto',
            minHeight: 250,
            whiteSpace: 'pre-wrap',
            position: 'relative'
          }}>
            {errorInfo ? (
              <div style={{ color: 'var(--accent-rose)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                  <XCircle size={18} />
                  <span>{errorInfo.type || 'Error'}</span>
                </div>
                <div>{errorInfo.message}</div>
                {errorInfo.code && <div className="font-mono" style={{ fontSize: '0.75rem' }}>Code: {errorInfo.code}</div>}
              </div>
            ) : responseContent ? (
              <div>
                {responseContent}
                {executing && (
                  <span style={{
                    display: 'inline-block',
                    width: 8,
                    height: 16,
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
                <span>Awaiting first token from upstream provider...</span>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '4rem' }}>
                Choose an evaluator preset or type a prompt, then click <strong>Dispatch Request</strong> to view response and live telemetry.
              </div>
            )}
          </div>

          {/* Bottom Stream Status */}
          {stream && chunkCount > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>SSE Tokens Received: {chunkCount}</span>
              <span>Wire Format: text/event-stream</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
