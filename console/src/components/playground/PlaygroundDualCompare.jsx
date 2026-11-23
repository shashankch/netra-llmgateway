import React, { useState, useRef, useEffect } from 'react';
import { 
  Zap, Sparkles, Cpu, Send, Radio, RotateCcw, 
  Clock, Coins, Database, Check, Copy, Trash2, 
  AlertTriangle, ArrowRight, TrendingUp, BarChart2,
  Terminal, ShieldCheck, ChevronDown, CheckCircle2,
  Layers, Sliders, Play, Square, Activity
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { getApiUrl, formatLatencyMs } from '../../config/api';
import { BENCHMARK_PROMPT_TEMPLATES } from '../../constants/benchmarkScenarios';

/**
 * Production-grade Dual-Model A/B Benchmark & Evaluation Workbench.
 * 
 * Features:
 * - Concurrent dual SSE streaming to compare two models head-to-head.
 * - Real-time TTFT (Time to First Token), latency, throughput (tok/s), cost, and cache tracking.
 * - Comprehensive Delta Benchmark summary card with speedup factor and cost savings.
 * - Full KaTeX mathematical rendering, markdown typography, and code-block syntax highlighting.
 * - Responsive side-by-side terminal grid with dedicated scrollable containers.
 */
export default function PlaygroundDualCompare({
  virtualKey,
  catalog,
  formatCurrency,
  isOnline,
  onNavigate
}) {
  const [modelA, setModelA] = useState('fast');
  const [modelB, setModelB] = useState('smart');
  const [prompt, setPrompt] = useState('What is a load balancer and why is it needed?');
  const [systemPrompt, setSystemPrompt] = useState('You are NETRA, an enterprise AI assistant.');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [stream, setStream] = useState(true);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);

  // Execution state for Model A
  const [executingA, setExecutingA] = useState(false);
  const [responseA, setResponseA] = useState('');
  const [telemetryA, setTelemetryA] = useState(null);
  const [ttftA, setTtftA] = useState(null);
  const [errorA, setErrorA] = useState(null);
  const [completedA, setCompletedA] = useState(false);

  // Execution state for Model B
  const [executingB, setExecutingB] = useState(false);
  const [responseB, setResponseB] = useState('');
  const [telemetryB, setTelemetryB] = useState(null);
  const [ttftB, setTtftB] = useState(null);
  const [errorB, setErrorB] = useState(null);
  const [completedB, setCompletedB] = useState(false);

  // Unmount cleanup: abort in-flight requests when operator switches tabs
  useEffect(() => {
    return () => {
      abortRefA.current?.abort();
      abortRefB.current?.abort();
    };
  }, []);

  const abortRefA = useRef(null);
  const abortRefB = useRef(null);
  const scrollRefA = useRef(null);
  const scrollRefB = useRef(null);
  const presetMenuRef = useRef(null);

  const isExecuting = executingA || executingB;

  // Close preset popover on click outside or Escape
  useEffect(() => {
    if (!presetMenuOpen) return;
    function handleClickOutside(e) {
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target)) {
        setPresetMenuOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setPresetMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [presetMenuOpen]);

  // Find active preset scenario if prompt matches
  const activeScenario = BENCHMARK_PROMPT_TEMPLATES.find(
    t => t.text.trim().toLowerCase() === prompt.trim().toLowerCase()
  );

  // Group benchmark templates by category
  const groupedScenarios = React.useMemo(() => {
    return BENCHMARK_PROMPT_TEMPLATES.reduce((acc, t) => {
      const grp = t.group || 'General Benchmarks';
      if (!acc[grp]) acc[grp] = [];
      acc[grp].push(t);
      return acc;
    }, {});
  }, []);

  // Auto-scroll response terminals when streaming tokens arrive
  useEffect(() => {
    if (executingA && scrollRefA.current) {
      scrollRefA.current.scrollTop = scrollRefA.current.scrollHeight;
    }
  }, [responseA, executingA]);

  useEffect(() => {
    if (executingB && scrollRefB.current) {
      scrollRefB.current.scrollTop = scrollRefB.current.scrollHeight;
    }
  }, [responseB, executingB]);

  // Available models from catalog
  const fastTargetModel = catalog?.aliases?.fast?.primary ? catalog.aliases.fast.primary.trim() : null;
  const smartTargetModel = catalog?.aliases?.smart?.primary ? catalog.aliases.smart.primary.trim() : null;
  const concreteModels = (catalog?.models || [])
    .map(m => m.model)
    .flatMap(s => (typeof s === 'string' ? s.split(',') : [s]))
    .map(s => String(s).trim())
    .filter(Boolean);

  const formatModelDisplay = (m) => (m && m.includes(':') && !['fast', 'smart', 'auto'].includes(m) ? m.replace(/^[a-zA-Z0-9_-]+:/, '') : m);

  const allModelOptions = Array.from(new Set([
    'fast', 'smart', 'auto',
    ...(fastTargetModel ? [fastTargetModel] : []),
    ...(smartTargetModel ? [smartTargetModel] : []),
    ...concreteModels
  ]));

  const handleStop = () => {
    if (abortRefA.current) abortRefA.current.abort();
    if (abortRefB.current) abortRefB.current.abort();
    setExecutingA(false);
    setExecutingB(false);
    setCompletedA(false);
    setCompletedB(false);
  };

  const handleClear = () => {
    handleStop();
    setResponseA('');
    setResponseB('');
    setTelemetryA(null);
    setTelemetryB(null);
    setTtftA(null);
    setTtftB(null);
    setErrorA(null);
    setErrorB(null);
    setCompletedA(false);
    setCompletedB(false);
  };

  const computeStreamCost = (targetModel, provider, pTokens, cTokens, cachedTokens = 0) => {
    const key = (provider || targetModel || '').toLowerCase();
    const isSmart = key.includes('smart') || key.includes('claude') || key.includes('gpt-4') || key.includes('large');
    const inputRate = isSmart ? 0.75 : 0.14;
    const outputRate = isSmart ? 1.50 : 0.28;
    const billablePrompt = Math.max(0, pTokens - cachedTokens);
    const pCost = ((billablePrompt * inputRate) + (cachedTokens * inputRate * 0.5)) / 1000000;
    const cCost = (cTokens * outputRate) / 1000000;
    return (pCost + cCost).toFixed(6);
  };

  const dispatchSingleStream = async (targetModel, setExecuting, setResponse, setTelemetry, setTtft, setError, setCompleted, abortRef) => {
    setExecuting(true);
    setCompleted(false);
    setResponse('');
    setTelemetry(null);
    setTtft(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const startTime = performance.now();
    let firstTokenTime = null;

    try {
      const messages = [];
      if (systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt.trim() });
      }
      messages.push({ role: 'user', content: prompt.trim() });

      const targetUrl = getApiUrl('/v1/chat/completions');
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${virtualKey}`,
          'Accept': stream ? 'text/event-stream' : 'application/json'
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          stream
        }),
        signal: controller.signal
      });

      const initialLatency = Math.round(performance.now() - startTime);
      const tele = {
        status: res.status,
        provider: res.headers.get('x-netra-provider') || 'n/a',
        cache: res.headers.get('x-netra-cache') || 'miss',
        costUsd: res.headers.get('x-netra-cost-usd') || '0.000000',
        routeReason: res.headers.get('x-netra-route-reason') || 'direct',
        cachedTokens: res.headers.get('x-netra-cached-tokens') || '0',
        latencyMs: initialLatency,
        promptTokens: 0,
        completionTokens: 0
      };
      setTelemetry(tele);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
        setError(errJson.error || { message: `Request failed with HTTP ${res.status}` });
        setExecuting(false);
        return;
      }

      if (stream) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulated = '';
        let streamBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.usage) {
                tele.promptTokens = parsed.usage.prompt_tokens || 0;
                tele.completionTokens = parsed.usage.completion_tokens || 0;
                if (parsed.usage.prompt_tokens_details?.cached_tokens) {
                  tele.cachedTokens = String(parsed.usage.prompt_tokens_details.cached_tokens);
                }
              }
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                if (firstTokenTime === null) {
                  firstTokenTime = Math.round(performance.now() - startTime);
                  setTtft(firstTokenTime);
                }
                accumulated += delta;
                setResponse(accumulated);
              }
            } catch (ignored) {}
          }
        }

        const promptText = (prompt || '') + ' ' + (systemPrompt || '');
        const pTokens = tele.promptTokens > 0
          ? tele.promptTokens
          : Math.max(1, Math.round(promptText.trim().split(/\s+/).length * 1.3));
        const cTokens = tele.completionTokens > 0
          ? tele.completionTokens
          : Math.max(1, Math.round(accumulated.trim().split(/\s+/).length * 1.3));

        let finalCostUsd = tele.costUsd;
        if (tele.cache === 'hit') {
          finalCostUsd = '0.000000';
        } else if (!finalCostUsd || finalCostUsd === '0.000000') {
          finalCostUsd = computeStreamCost(targetModel, tele.provider, pTokens, cTokens, Number(tele.cachedTokens) || 0);
        }

        const totalLatency = Math.round(performance.now() - startTime);
        setTelemetry(prev => ({
          ...prev,
          latencyMs: totalLatency,
          promptTokens: pTokens,
          completionTokens: cTokens,
          costUsd: finalCostUsd
        }));
        if (accumulated.trim().length > 0) {
          setCompleted(true);
        }
      } else {
        const json = await res.json();
        const totalTime = Math.round(performance.now() - startTime);
        setTtft(totalTime);
        const text = json.choices?.[0]?.message?.content || '';
        setResponse(text);
        const promptText = (prompt || '') + ' ' + (systemPrompt || '');
        const pTokens = json.usage?.prompt_tokens || Math.max(1, Math.round(promptText.trim().split(/\s+/).length * 1.3));
        const cTokens = json.usage?.completion_tokens || Math.max(1, Math.round(text.trim().split(/\s+/).length * 1.3));
        let finalCostUsd = tele.costUsd;
        if (tele.cache === 'hit') {
          finalCostUsd = '0.000000';
        } else if (!finalCostUsd || finalCostUsd === '0.000000') {
          finalCostUsd = computeStreamCost(targetModel, tele.provider, pTokens, cTokens, Number(tele.cachedTokens) || 0);
        }
        setTelemetry(prev => ({
          ...prev,
          latencyMs: totalTime,
          promptTokens: pTokens,
          completionTokens: cTokens,
          costUsd: finalCostUsd
        }));
        if (text.trim().length > 0) {
          setCompleted(true);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError({ message: err.message || 'Network error executing completion' });
      }
    } finally {
      setExecuting(false);
    }
  };

  const handleDualSend = () => {
    if (!prompt.trim() || isExecuting) return;
    dispatchSingleStream(modelA, setExecutingA, setResponseA, setTelemetryA, setTtftA, setErrorA, setCompletedA, abortRefA);
    dispatchSingleStream(modelB, setExecutingB, setResponseB, setTelemetryB, setTtftB, setErrorB, setCompletedB, abortRefB);
  };

  // Delta metrics computation
  const bothFinished = !isExecuting && completedA && completedB && telemetryA && telemetryB && telemetryA.status === 200 && telemetryB.status === 200;
  let latencyDiff = null;
  let fasterModel = null;
  let speedupFactor = null;
  let costSavingsDiff = null;
  let cheaperModel = null;
  let savingsPercent = null;

  if (bothFinished) {
    const latA = telemetryA.latencyMs || 1;
    const latB = telemetryB.latencyMs || 1;
    if (latA < latB) {
      fasterModel = 'Model A';
      latencyDiff = latB - latA;
      speedupFactor = (latB / latA).toFixed(1);
    } else if (latB < latA) {
      fasterModel = 'Model B';
      latencyDiff = latA - latB;
      speedupFactor = (latA / latB).toFixed(1);
    }

    const costA = parseFloat(telemetryA.costUsd) || 0;
    const costB = parseFloat(telemetryB.costUsd) || 0;
    if (costA < costB) {
      cheaperModel = 'Model A';
      costSavingsDiff = costB - costA;
      savingsPercent = costB > 0 ? (((costB - costA) / costB) * 100).toFixed(1) : 0;
    } else if (costB < costA) {
      cheaperModel = 'Model B';
      costSavingsDiff = costA - costB;
      savingsPercent = costA > 0 ? (((costA - costB) / costA) * 100).toFixed(1) : 0;
    }
  }

  const promptWordCount = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
  const estimatedPromptTokens = Math.max(1, Math.round(promptWordCount * 1.3));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Top Prompt & Dual Workbench Control Card */}
      <div 
        className="card" 
        style={{ 
          padding: '1rem 1.25rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.85rem',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)'
        }}
      >
        {/* Row 1: Header (Left) and Utility Controls Toolbar (Right) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Left: Workbench Identifier */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <BarChart2 size={13} style={{ color: 'var(--accent-primary)' }} />
              A/B Dual Benchmark
            </span>
            <span className="badge font-mono" style={{ fontSize: '0.65rem', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}>
              KEY: {virtualKey}
            </span>
          </div>

          {/* Right: Unified Controls Cluster (Pinned Right, Non-wrapping) */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginLeft: 'auto',
              flexWrap: 'nowrap',
              flexShrink: 0
            }}
          >
            {/* 1. Custom Scenario Preset Popover */}
            <div ref={presetMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setPresetMenuOpen(p => !p)}
                disabled={isExecuting}
                className="btn btn-sm font-mono"
                style={{
                  height: 28,
                  padding: '0 0.65rem',
                  fontSize: '0.72rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'var(--bg-canvas)',
                  border: `1px solid ${presetMenuOpen ? 'var(--accent-primary)' : activeScenario ? 'rgba(198, 241, 53, 0.4)' : 'var(--border-subtle)'}`,
                  color: activeScenario ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderRadius: 6,
                  cursor: isExecuting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Standard evaluation scenarios for semantic caching, routing proofs, and latency comparisons"
              >
                <Sparkles size={11} style={{ color: activeScenario ? 'var(--accent-primary)' : 'var(--accent-amber)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginRight: '0.15rem' }}>Scenario:</span>
                <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {activeScenario ? activeScenario.label.split(':')[0] : 'Standard Scenarios'}
                </span>
                <ChevronDown size={11} style={{ transform: presetMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', opacity: 0.7 }} />
              </button>

              {/* Popover Card */}
              {presetMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: 380,
                    maxWidth: 'calc(100vw - 32px)',
                    maxHeight: 380,
                    overflowY: 'auto',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.06)',
                    zIndex: 100,
                    padding: '0.35rem 0',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem 0.35rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                      Standard Benchmark Scenarios
                    </span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {BENCHMARK_PROMPT_TEMPLATES.length} presets
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {Object.entries(groupedScenarios).map(([groupName, templates], gIdx) => (
                      <div key={groupName} style={{ borderTop: gIdx > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <div style={{ padding: '0.45rem 0.75rem 0.2rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          {groupName}
                        </div>
                        {templates.map(t => {
                          const isSelected = prompt.trim().toLowerCase() === t.text.trim().toLowerCase();
                          const [shortTitle, ...rest] = t.label.split(':');
                          const promptQuote = rest.join(':').replace(/^\s*"/, '').replace(/"\s*$/, '').trim() || t.text;
                          return (
                            <button
                              key={t.label}
                              type="button"
                              onClick={() => {
                                setPrompt(t.text);
                                setPresetMenuOpen(false);
                              }}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.45rem 0.75rem',
                                background: isSelected ? 'rgba(198, 241, 53, 0.08)' : 'transparent',
                                border: 'none',
                                borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                                cursor: 'pointer',
                                transition: 'background 0.12s ease',
                                gap: '0.15rem'
                              }}
                              onMouseEnter={e => {
                                if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)';
                              }}
                              onMouseLeave={e => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                  {shortTitle.trim()}
                                </span>
                                {isSelected && <Check size={12} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
                              </div>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                                &ldquo;{promptQuote}&rdquo;
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {prompt && (
                    <div style={{ padding: '0.35rem 0.75rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-canvas)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setPrompt('');
                          setPresetMenuOpen(false);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          cursor: 'pointer',
                          padding: '0.2rem 0'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-rose)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <RotateCcw size={10} />
                        <span>Clear Prompt (Type Custom)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. System Prompt Drawer Toggle */}
            <button
              type="button"
              onClick={() => setShowSystemPrompt(p => !p)}
              className="btn btn-sm font-mono"
              style={{ 
                height: 28, 
                padding: '0 0.65rem', 
                fontSize: '0.72rem', 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: showSystemPrompt ? 'rgba(198, 241, 53, 0.1)' : 'var(--bg-canvas)',
                border: `1px solid ${showSystemPrompt ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                color: showSystemPrompt ? 'var(--accent-primary)' : (systemPrompt.trim() ? 'var(--text-primary)' : 'var(--text-secondary)'),
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Toggle system instructions for both models"
            >
              <Sliders size={11} style={{ color: showSystemPrompt ? 'var(--accent-primary)' : (systemPrompt.trim() ? 'var(--accent-primary)' : 'var(--text-muted)') }} />
              <span>{showSystemPrompt ? 'Hide System' : 'System Prompt'}</span>
              {systemPrompt.trim() && !showSystemPrompt && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
              )}
            </button>

            {/* 3. SSE Streaming Pill Toggle */}
            <button
              type="button"
              onClick={() => setStream(p => !p)}
              disabled={isExecuting}
              className="btn btn-sm font-mono"
              style={{ 
                height: 28, 
                padding: '0 0.65rem', 
                fontSize: '0.72rem', 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: stream ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                border: `1px solid ${stream ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                color: stream ? 'var(--accent-primary-text)' : 'var(--text-secondary)',
                fontWeight: stream ? 700 : 500,
                borderRadius: 6,
                cursor: isExecuting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              title={stream ? "Real-time SSE token streaming enabled" : "Non-streaming JSON response"}
            >
              <Radio size={11} style={{ color: stream ? 'currentColor' : 'var(--text-muted)' }} />
              <span>{stream ? 'Stream ON' : 'Stream OFF'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible System Prompt Drawer */}
        {showSystemPrompt && (
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.35rem', 
              padding: '0.65rem 0.85rem', 
              background: 'var(--bg-canvas)', 
              border: '1px solid var(--border-subtle)', 
              borderRadius: 6 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Shared System Instructions (Model A &amp; Model B)
              </span>
              {systemPrompt && (
                <button
                  type="button"
                  onClick={() => setSystemPrompt('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.65rem',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-rose)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  Clear Instructions
                </button>
              )}
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are NETRA, an enterprise AI assistant. Answer concisely and accurately."
              disabled={isExecuting}
              rows={2}
              className="input font-mono"
              style={{ 
                fontSize: '0.75rem', 
                padding: '0.45rem 0.65rem', 
                background: 'var(--bg-surface)', 
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                resize: 'vertical',
                lineHeight: 1.4
              }}
            />
          </div>
        )}

        {/* Prompt Input Textarea */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Evaluation Prompt
              </span>
              {activeScenario ? (
                <span 
                  className="badge font-mono" 
                  style={{ 
                    fontSize: '0.62rem', 
                    padding: '0.1rem 0.45rem', 
                    background: 'rgba(198, 241, 53, 0.08)', 
                    color: 'var(--accent-primary)', 
                    border: '1px solid rgba(198, 241, 53, 0.25)' 
                  }}
                  title="Standard benchmark evaluation scenario loaded"
                >
                  Standard Benchmark: {activeScenario.label.split(':')[0]}
                </span>
              ) : (
                <span 
                  className="badge font-mono" 
                  style={{ 
                    fontSize: '0.62rem', 
                    padding: '0.1rem 0.45rem', 
                    background: 'rgba(245, 158, 11, 0.08)', 
                    color: 'var(--accent-amber)', 
                    border: '1px solid rgba(245, 158, 11, 0.25)' 
                  }}
                >
                  Custom Prompt
                </span>
              )}
            </div>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {prompt.length} chars · ~{estimatedPromptTokens} tokens
            </span>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type a benchmark prompt to evaluate across Model A and Model B simultaneously..."
            disabled={isExecuting}
            rows={3}
            className="input"
            style={{ 
              fontSize: '0.8125rem', 
              resize: 'vertical', 
              minHeight: 70,
              lineHeight: 1.55,
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              padding: '0.65rem 0.85rem'
            }}
          />
        </div>

        {/* Row 3: Model A Select, VS, Model B Select, Clear & Dispatch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.25rem' }}>
          {/* Dual Model Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {/* Model A Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span 
                className="badge font-mono" 
                style={{ 
                  background: 'rgba(16, 185, 129, 0.15)', 
                  color: 'var(--accent-emerald)', 
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.5rem',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                MODEL A
              </span>
              <select
                value={modelA}
                onChange={(e) => setModelA(e.target.value)}
                disabled={isExecuting}
                className="input font-mono"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 30, minWidth: 140, background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
              >
                {allModelOptions.map(m => (
                  <option key={`a-${m}`} value={m}>{formatModelDisplay(m)}</option>
                ))}
              </select>
            </div>

            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', padding: '0 0.15rem' }}>VS</span>

            {/* Model B Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span 
                className="badge font-mono" 
                style={{ 
                  background: 'rgba(56, 189, 248, 0.15)', 
                  color: 'var(--accent-cyan)', 
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.5rem',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}
              >
                MODEL B
              </span>
              <select
                value={modelB}
                onChange={(e) => setModelB(e.target.value)}
                disabled={isExecuting}
                className="input font-mono"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 30, minWidth: 140, background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
              >
                {allModelOptions.map(m => (
                  <option key={`b-${m}`} value={m}>{formatModelDisplay(m)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons: Clear & Run */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {(responseA || responseB || telemetryA || telemetryB) && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isExecuting}
                className="btn btn-outline btn-sm font-mono"
                style={{ height: 30, padding: '0.25rem 0.65rem', fontSize: '0.75rem', gap: '0.35rem' }}
              >
                <Trash2 size={12} />
                <span>Clear Outputs</span>
              </button>
            )}

            {isExecuting ? (
              <button
                type="button"
                onClick={handleStop}
                className="btn btn-danger btn-sm font-mono"
                style={{ height: 30, padding: '0.25rem 0.95rem', fontSize: '0.75rem', gap: '0.4rem' }}
              >
                <span className="pulse-indicator" style={{ width: 8, height: 8 }} />
                <span>Stop Streaming</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDualSend}
                disabled={!prompt.trim() || !isOnline}
                className="btn btn-primary btn-sm font-mono"
                style={{ height: 30, padding: '0.25rem 1rem', fontSize: '0.75rem', gap: '0.4rem' }}
              >
                <Play size={12} fill="currentColor" />
                <span>Run Dual Benchmark</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delta Performance Comparison Banner */}
      {bothFinished && (
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '0.75rem',
            padding: '0.85rem 1.15rem',
            borderRadius: '10px',
            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(56, 189, 248, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <TrendingUp size={18} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>LATENCY COMPARISON</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {fasterModel ? (
                  <>
                    <span style={{ color: fasterModel === 'Model A' ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>{fasterModel}</span> was {speedupFactor}x faster ({latencyDiff} ms saved)
                  </>
                ) : (
                  'Identical latency'
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Coins size={18} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>COST SAVINGS</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {cheaperModel && costSavingsDiff > 0 ? (
                  <>
                    <span style={{ color: cheaperModel === 'Model A' ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>{cheaperModel}</span> saved {savingsPercent}% ({formatCurrency(costSavingsDiff)})
                  </>
                ) : (
                  'Equivalent cost'
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Clock size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>TIME TO FIRST TOKEN (TTFT)</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                A: {ttftA != null ? `${ttftA} ms` : '—'} vs B: {ttftB != null ? `${ttftB} ms` : '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Database size={18} style={{ color: 'var(--accent-lime)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>CACHE CONVERGENCE</div>
              <div className="font-mono" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                A: <span style={{ color: telemetryA.cache === 'hit' ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>{telemetryA.cache.toUpperCase()}</span> | B: <span style={{ color: telemetryB.cache === 'hit' ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>{telemetryB.cache.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Response Panes Grid */}
      <div className="dual-compare-grid">
        {/* Model A Terminal Pane */}
        <DualPaneTerminal
          paneLabel="MODEL A"
          modelName={modelA}
          executing={executingA}
          telemetry={telemetryA}
          ttft={ttftA}
          responseContent={responseA}
          errorInfo={errorA}
          themeColor="var(--accent-emerald)"
          formatCurrency={formatCurrency}
          scrollRef={scrollRefA}
        />

        {/* Model B Terminal Pane */}
        <DualPaneTerminal
          paneLabel="MODEL B"
          modelName={modelB}
          executing={executingB}
          telemetry={telemetryB}
          ttft={ttftB}
          responseContent={responseB}
          errorInfo={errorB}
          themeColor="var(--accent-cyan)"
          formatCurrency={formatCurrency}
          scrollRef={scrollRefB}
        />
      </div>
    </div>
  );
}

function DualPaneTerminal({
  paneLabel,
  modelName,
  executing,
  telemetry,
  ttft,
  responseContent,
  errorInfo,
  themeColor,
  formatCurrency,
  scrollRef
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!responseContent) return;
    navigator.clipboard.writeText(responseContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = responseContent ? responseContent.trim().split(/\s+/).filter(Boolean).length : 0;
  const tokensPerSec = telemetry && telemetry.latencyMs > 0 && telemetry.completionTokens > 0
    ? ((telemetry.completionTokens / (telemetry.latencyMs / 1000))).toFixed(1)
    : null;

  return (
    <div 
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: '0.85rem 1rem',
        borderTop: `3px solid ${themeColor}`,
        overflow: 'hidden',
        background: 'var(--bg-surface)'
      }}
    >
      {/* Pane Header */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.65rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '0.65rem',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span 
            className="badge font-mono" 
            style={{ 
              background: `color-mix(in srgb, ${themeColor} 15%, transparent)`, 
              color: themeColor, 
              fontWeight: 800,
              fontSize: '0.72rem',
              padding: '0.15rem 0.5rem',
              border: `1px solid color-mix(in srgb, ${themeColor} 40%, transparent)`
            }}
          >
            {paneLabel}: {modelName}
          </span>
          {executing && (
            <span className="pulse-indicator" style={{ width: 8, height: 8 }} />
          )}
          {telemetry && (
            <>
              <span 
                className="font-mono" 
                style={{ 
                  fontSize: '0.68rem', 
                  padding: '0.1rem 0.4rem', 
                  borderRadius: 4, 
                  fontWeight: 700,
                  background: telemetry.status === 200 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: telemetry.status === 200 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  border: telemetry.status === 200 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
                }}
              >
                {telemetry.status === 200 ? '200 OK' : `HTTP ${telemetry.status}`}
              </span>
              <span 
                className="font-mono" 
                style={{ 
                  fontSize: '0.68rem', 
                  padding: '0.1rem 0.4rem', 
                  borderRadius: 4, 
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {telemetry.provider}
              </span>
            </>
          )}
        </div>

        {responseContent && (
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-outline btn-sm font-mono"
            style={{ padding: '0.15rem 0.5rem', height: 24, fontSize: '0.7rem', gap: '0.25rem' }}
          >
            {copied ? <Check size={11} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        )}
      </div>

      {/* Pane Telemetry Chips */}
      {telemetry && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.65rem', fontSize: '0.68rem', flexShrink: 0 }}>
          <span 
            className="badge font-mono" 
            style={{ 
              padding: '0.15rem 0.45rem', 
              color: telemetry.cache === 'hit' ? 'var(--accent-emerald)' : 'var(--text-muted)',
              background: telemetry.cache === 'hit' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <Database size={10} style={{ marginRight: 4 }} />
            {telemetry.cache === 'hit' ? 'CACHE HIT (Sub-5ms)' : 'CACHE MISS'}
          </span>
          <span className="badge font-mono" style={{ padding: '0.15rem 0.45rem', color: 'var(--text-secondary)', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}>
            <Clock size={10} style={{ marginRight: 4 }} />
            {formatLatencyMs(telemetry.latencyMs)} {ttft != null && `· TTFT ${formatLatencyMs(ttft)}`}
          </span>
          <span className="badge font-mono" style={{ padding: '0.15rem 0.45rem', color: 'var(--accent-amber)', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}>
            <Coins size={10} style={{ marginRight: 4 }} />
            {formatCurrency(telemetry.costUsd)}
          </span>
          {tokensPerSec && (
            <span className="badge font-mono" style={{ padding: '0.15rem 0.45rem', color: 'var(--accent-cyan)', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}>
              <Activity size={10} style={{ marginRight: 4 }} />
              {tokensPerSec} tok/s
            </span>
          )}
          {telemetry.completionTokens > 0 && (
            <span className="badge font-mono" style={{ padding: '0.15rem 0.45rem', color: 'var(--text-primary)', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}>
              {telemetry.completionTokens} tokens
            </span>
          )}
        </div>
      )}

      {/* Response Scroll Body */}
      <div 
        ref={scrollRef}
        className="response-output-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '1rem',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          overflowY: 'auto'
        }}
      >
        {errorInfo ? (
          <div style={{ color: 'var(--accent-rose)', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
              <AlertTriangle size={16} />
              <span>{errorInfo.type || 'Inference Error'}</span>
            </div>
            <div style={{ fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.08)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {errorInfo.message}
            </div>
          </div>
        ) : responseContent ? (
          <MarkdownRenderer content={responseContent} />
        ) : executing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            <span className="pulse-indicator" style={{ width: 12, height: 12 }} />
            <span>Streaming inference tokens from <strong style={{ color: 'var(--text-primary)' }}>{modelName}</strong>...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Terminal size={18} style={{ color: themeColor, opacity: 0.7 }} />
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Ready for {paneLabel} Benchmarking
            </div>
            <div style={{ fontSize: '0.75rem', maxWidth: 300, lineHeight: 1.4 }}>
              Click &quot;Run Dual Benchmark&quot; above to dispatch prompt to {modelName} concurrently with SSE streaming.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
