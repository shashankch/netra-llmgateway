import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getApiUrl, useGatewayHealth } from '../config/api';
import PlaygroundControls from './playground/PlaygroundControls';
import PlaygroundResponsePane from './playground/PlaygroundResponsePane';
import { Zap } from 'lucide-react';

/**
 * Interactive prompt execution and model evaluation sandbox.
 * Designed with a fixed-height workbench layout matching production LLM developer consoles.
 */
export default function Playground({ adminToken = 'netra-admin-demo', onNavigate }) {
  const { formatCurrency } = useTheme();
  const { isOnline } = useGatewayHealth();
  const isDemoToken = !adminToken || adminToken === 'netra-admin-demo';

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
  const [keysLoaded, setKeysLoaded] = useState(false);

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
        if (keysRes.status === 'fulfilled') {
          if (keysRes.value.ok) {
            const keysJson = await keysRes.value.json();
            if (isMounted) {
              setKeysLoaded(true);
              if (Array.isArray(keysJson)) {
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
          } else if (isMounted) {
            setKeysLoaded(true);
          }
        }
      } catch (err) {
        console.warn('Could not load dynamic pricing or keys in Playground:', err);
        if (isMounted) setKeysLoaded(true);
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

  // Only consider keys "unseeded" in a genuine production deployment:
  // Gateway must be online, not in demo token mode, and database returned 0 keys
  const isProductionUnseeded = isOnline && !isDemoToken && keysLoaded && tenantKeys.length === 0;

  // Dynamic profiles from live database or pre-seeded fallbacks
  const presets = tenantKeys.length > 0
    ? tenantKeys.slice(0, 4).map(k => {
        const isActive = k.status === 'ACTIVE';
        return {
          label: k.team || 'Tenant',
          key: k.virtual_key,
          model: (k.model_allowlist && k.model_allowlist.length > 0) ? k.model_allowlist[0] : 'fast',
          desc: `RPM: ${k.rpm_limit}, Cache: ${k.semantic_cache_enabled ? `\u2265 ${k.similarity_threshold}` : 'Off'}`,
          disabled: !isActive,
          status: k.status || 'ACTIVE'
        };
      })
    : [
        { 
          label: 'Search Team', 
          key: 'netra-sk-search-1a2b3c', 
          model: 'fast', 
          desc: 'Cache threshold: 0.92, RPM: 60', 
          disabled: isProductionUnseeded, 
          status: isProductionUnseeded ? 'UNSEEDED' : 'DEMO' 
        },
        { 
          label: 'Research Team', 
          key: 'netra-sk-research-4d5e6f', 
          model: 'auto', 
          desc: 'Auto router, cache: disabled', 
          disabled: isProductionUnseeded, 
          status: isProductionUnseeded ? 'UNSEEDED' : 'DEMO' 
        },
        { 
          label: 'Free Tier', 
          key: 'netra-sk-free-7g8h9i', 
          model: 'fast', 
          desc: 'RPM: 10, cache threshold: 0.85', 
          disabled: isProductionUnseeded, 
          status: isProductionUnseeded ? 'UNSEEDED' : 'DEMO' 
        },
        { 
          label: 'Budget Demo', 
          key: 'netra-sk-budget-demo-0j1k2l', 
          model: 'fast', 
          desc: 'Strict monthly limit demonstration ($0.00001 cap)', 
          disabled: isProductionUnseeded, 
          status: isProductionUnseeded ? 'UNSEEDED' : 'DEMO' 
        },
      ];

  const currentKeyObj = tenantKeys.find(k => k.virtual_key === virtualKey);
  const isSelectedKeyDisabled = (currentKeyObj && currentKeyObj.status !== 'ACTIVE') ||
    (isProductionUnseeded && virtualKey.startsWith('netra-sk-'));

  // Real-time transaction pricing resolver matching active catalog rates
  const resolveModelPricing = (modelKey, providerTarget) => {
    if (!catalog) return { inputRate: 0.14, outputRate: 0.28 };

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
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      width: '100%',
      gap: '1.25rem'
    }}>
      {/* Top Banner / Actions */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: '1rem',
        flexShrink: 0
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            Prompt Playground &amp; Execution Sandbox
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Interactive inference proxy with real-time SSE streaming, semantic caching, and automated router failover.
          </p>
        </div>

        {/* Profile Preset Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginRight: '0.15rem' }}>
            Profile:
          </span>
          {presets.map(p => (
            <button
              key={p.key}
              type="button"
              disabled={p.disabled}
              onClick={() => {
                if (p.disabled) return;
                setVirtualKey(p.key);
                setModel(p.model);
              }}
              className={`btn btn-sm ${virtualKey === p.key ? 'btn-primary' : 'btn-outline'}`}
              style={{ 
                fontSize: '0.72rem', 
                padding: '0.15rem 0.5rem', 
                height: 24, 
                gap: '0.25rem',
                opacity: p.disabled ? 0.45 : 1,
                cursor: p.disabled ? 'not-allowed' : 'pointer'
              }}
              title={p.disabled ? `${p.label} (${p.status}: Disabled in production deployment)` : `${p.label} (${p.desc})`}
            >
              <Zap size={11} style={{ opacity: p.disabled ? 0.5 : 1 }} />
              <span>{p.label}</span>
              {p.disabled && (
                <span style={{ fontSize: '0.58rem', textTransform: 'uppercase', padding: '0 0.25rem', borderRadius: 3, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-rose, #f43f5e)', marginLeft: '0.15rem' }}>
                  {p.status === 'UNSEEDED' ? 'unseeded' : 'disabled'}
                </span>
              )}
            </button>
          ))}
          {keysLoaded && tenantKeys.length === 0 && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('keys')}
              className="btn btn-sm btn-outline"
              style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', height: 24, gap: '0.25rem', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
              title="Mint a virtual key in Virtual Keys manager"
            >
              + Mint Key
            </button>
          )}
        </div>
      </div>

      {/* Main Workbench Grid (Left: Controls, Right: Live Stream) */}
      <div className="playground-grid">
        <PlaygroundControls
          virtualKey={virtualKey}
          setVirtualKey={setVirtualKey}
          model={model}
          setModel={setModel}
          stream={stream}
          setStream={setStream}
          prompt={prompt}
          setPrompt={setPrompt}
          systemPrompt={systemPrompt}
          setSystemPrompt={setSystemPrompt}
          catalog={catalog}
          tenantKeys={tenantKeys}
          isSelectedKeyDisabled={isSelectedKeyDisabled}
          currentKeyObj={currentKeyObj}
          executing={executing}
          handleSend={handleSend}
          handleStop={handleStop}
          onNavigate={onNavigate}
        />

        <PlaygroundResponsePane
          executing={executing}
          telemetry={telemetry}
          responseContent={responseContent}
          errorInfo={errorInfo}
          stream={stream}
          chunkCount={chunkCount}
          copiedResponse={copiedResponse}
          copyResponseToClipboard={copyResponseToClipboard}
          handleClearOutput={handleClearOutput}
          responseContainerRef={responseContainerRef}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
}
