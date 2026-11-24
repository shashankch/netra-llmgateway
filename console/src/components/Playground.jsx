import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getApiUrl, useGatewayHealth, reportAdminAuthFailure, reportAdminAuthSuccess, useAdminAuthStatus } from '../config/api';
import { DEFAULT_PLAYGROUND_PRESETS } from '../constants/demoFallbackData';
import PlaygroundControls from './playground/PlaygroundControls';
import PlaygroundResponsePane from './playground/PlaygroundResponsePane';
import PlaygroundDualCompare from './playground/PlaygroundDualCompare';
import { Zap, ChevronDown, Search, Check, Plus, X, BarChart2 } from 'lucide-react';

/**
 * Interactive prompt execution and model evaluation sandbox.
 * Designed with a fixed-height workbench layout matching production LLM developer consoles.
 */
export default function Playground({ adminToken = 'netra-admin-demo', onNavigate, onOpenAdminModal }) {
  const { formatCurrency } = useTheme();
  const { isOnline } = useGatewayHealth();
  const globalAuthStatus = useAdminAuthStatus();
  const isDemoToken = !adminToken || adminToken === 'netra-admin-demo';
  const isMintDisabled = isDemoToken || globalAuthStatus.isUnauthorized || !isOnline;
  const [authError, setAuthError] = useState(false);
  const [playgroundMode, setPlaygroundMode] = useState('single'); // 'single' | 'compare'

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

  const [errorInfo, setErrorInfo] = useState(() => {
    try {
      const stored = sessionStorage.getItem('netra_playground_error');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [hoveredProfileKey, setHoveredProfileKey] = useState(null);
  const [chunkCount, setChunkCount] = useState(() => {
    try {
      const stored = sessionStorage.getItem('netra_playground_chunk_count');
      return stored ? Number(stored) : 0;
    } catch {
      return 0;
    }
  });

  const [copiedResponse, setCopiedResponse] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const profileDropdownRef = useRef(null);

  // Close profile dropdown on outside click or Escape key
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setIsProfileDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsProfileDropdownOpen(false);
      }
    };
    if (isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleGlobalClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileDropdownOpen]);

  // Dynamic Gateway Catalog & Virtual Key Configuration with localStorage caching
  const [catalog, setCatalog] = useState(() => {
    try {
      const cached = localStorage.getItem('netra_pricing_catalog');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [tenantKeys, setTenantKeys] = useState(() => {
    try {
      const cached = sessionStorage.getItem(`netra_tenant_keys_${adminToken || 'demo'}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [keysLoaded, setKeysLoaded] = useState(() => {
    try {
      return !!sessionStorage.getItem(`netra_tenant_keys_loaded_${adminToken || 'demo'}`);
    } catch {
      return false;
    }
  });

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
            reportAdminAuthSuccess();
            if (isMounted) setAuthError(false);
            const keysJson = await keysRes.value.json();
            if (isMounted) {
              setKeysLoaded(true);
              if (Array.isArray(keysJson)) {
                setTenantKeys(keysJson);
                try {
                  sessionStorage.setItem(`netra_tenant_keys_${adminToken || 'demo'}`, JSON.stringify(keysJson));
                  sessionStorage.setItem(`netra_tenant_keys_loaded_${adminToken || 'demo'}`, 'true');
                } catch {}
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
          } else {
            if (keysRes.value.status === 401 || keysRes.value.status === 403) {
              if (!isDemoToken) {
                reportAdminAuthFailure(keysRes.value.status);
                if (isMounted) setAuthError(true);
              }
            }
            if (isMounted) {
              setKeysLoaded(true);
              try {
                sessionStorage.setItem(`netra_tenant_keys_loaded_${adminToken || 'demo'}`, 'true');
              } catch {}
            }
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

  useEffect(() => {
    try {
      if (errorInfo) {
        sessionStorage.setItem('netra_playground_error', JSON.stringify(errorInfo));
      } else {
        sessionStorage.removeItem('netra_playground_error');
      }
    } catch (e) {}
  }, [errorInfo]);

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
      sessionStorage.removeItem('netra_playground_error');
    } catch (e) {}
  };

  // Only consider keys "unseeded" in a genuine production deployment:
  // Gateway must be online, not in demo token mode, keys loaded without auth failure, and database returned 0 keys
  const hasAuthError = !isDemoToken && (authError || globalAuthStatus.isUnauthorized);
  const isProductionUnseeded = isOnline && !isDemoToken && keysLoaded && !hasAuthError && tenantKeys.length === 0;

  // Dynamic profiles from live database or pre-seeded fallbacks (scalable to 100+ keys)
  const allPresets = tenantKeys.length > 0
    ? tenantKeys.map(k => {
        const isActive = k.status === 'ACTIVE';
        return {
          label: k.team || 'Tenant',
          key: k.virtual_key,
          model: (k.model_allowlist && k.model_allowlist.length > 0) ? k.model_allowlist[0] : 'fast',
          desc: `RPM: ${k.rpm_limit}, Cache: ${k.semantic_cache_enabled ? `\u2265 ${k.similarity_threshold}` : 'Off'}`,
          rpm: `${k.rpm_limit || 60} RPM`,
          cache: k.semantic_cache_enabled ? `Active (\u2265 ${k.similarity_threshold})` : 'Bypassed',
          role: k.semantic_cache_enabled 
            ? `Production profile with semantic vector caching enabled (threshold \u2265 ${k.similarity_threshold}).`
            : `Production profile with direct upstream pass-through and admission control.`,
          disabled: !isActive,
          status: k.status || 'ACTIVE'
        };
      })
    : DEFAULT_PLAYGROUND_PRESETS.map(p => ({
        ...p,
        disabled: isProductionUnseeded,
        status: isProductionUnseeded ? 'UNSEEDED' : 'DEMO'
      }));

  // Determine top quick-access pills vs full fleet
  // At scale (4+ profiles), display at most 3 quick-access pills with dynamic active-key promotion,
  // delegating the remaining fleet to the searchable '+N more ▾' dropdown.
  const visiblePills = React.useMemo(() => {
    const MAX_VISIBLE_PILLS = 3;
    if (allPresets.length <= MAX_VISIBLE_PILLS) return allPresets;

    const topTwo = allPresets.slice(0, 2);
    const activeInTopTwo = topTwo.some(p => p.key === virtualKey);
    if (activeInTopTwo) {
      return allPresets.slice(0, MAX_VISIBLE_PILLS);
    }
    const currentActivePreset = allPresets.find(p => p.key === virtualKey);
    return currentActivePreset ? [...topTwo, currentActivePreset] : allPresets.slice(0, MAX_VISIBLE_PILLS);
  }, [allPresets, virtualKey]);

  // Filtered presets inside the dropdown
  const filteredDropdownPresets = React.useMemo(() => {
    if (!profileSearchQuery.trim()) return allPresets;
    const q = profileSearchQuery.toLowerCase().trim();
    return allPresets.filter(p =>
      (p.label && p.label.toLowerCase().includes(q)) ||
      (p.key && p.key.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q))
    );
  }, [allPresets, profileSearchQuery]);

  // Backward compatibility alias
  const presets = visiblePills;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Prompt Playground &amp; Execution Sandbox
            </h1>
            {/* Mode Switcher: Single Model vs Dual A/B Compare */}
            <div 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                background: 'var(--bg-canvas, #06070a)', 
                border: '1px solid var(--border-subtle, #18202f)', 
                borderRadius: 6, 
                padding: '0.15rem' 
              }}
            >
              <button
                type="button"
                onClick={() => setPlaygroundMode('single')}
                className="font-mono"
                style={{
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: playgroundMode === 'single' ? 'var(--bg-card-hover, rgba(255,255,255,0.08))' : 'transparent',
                  color: playgroundMode === 'single' ? 'var(--accent-primary, #10b981)' : 'var(--text-muted, #9ca3af)'
                }}
                title="Single model interactive workbench"
              >
                <Zap size={11} />
                <span>Single</span>
              </button>
              <button
                type="button"
                onClick={() => setPlaygroundMode('compare')}
                className="font-mono"
                style={{
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: playgroundMode === 'compare' ? 'var(--bg-card-hover, rgba(255,255,255,0.08))' : 'transparent',
                  color: playgroundMode === 'compare' ? 'var(--accent-primary, #10b981)' : 'var(--text-muted, #9ca3af)'
                }}
                title="Dual model side-by-side comparison"
              >
                <BarChart2 size={11} />
                <span>A/B Compare</span>
              </button>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Interactive inference proxy with real-time SSE streaming, semantic caching, and automated router failover.
          </p>
        </div>

        {/* Profile Preset Selector (Right-Aligned) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginRight: '0.15rem' }}>
            Profile:
          </span>
          {presets.map(p => (
            <div 
              key={p.key} 
              style={{ position: 'relative', display: 'inline-block' }}
              onMouseEnter={() => setHoveredProfileKey(p.key)}
              onMouseLeave={() => setHoveredProfileKey(null)}
            >
              <button
                type="button"
                disabled={p.disabled}
                onClick={() => {
                  if (p.disabled) return;
                  setVirtualKey(p.key);
                  setModel(p.model);
                  if (telemetry?.status >= 400 || errorInfo) {
                    setTelemetry(null);
                    setErrorInfo(null);
                    try {
                      sessionStorage.removeItem('netra_playground_telemetry');
                      sessionStorage.removeItem('netra_playground_error');
                    } catch (e) {}
                  }
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
              >
                <Zap size={11} style={{ opacity: p.disabled ? 0.5 : 1, flexShrink: 0 }} />
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                {p.disabled && (
                  <span style={{ fontSize: '0.58rem', textTransform: 'uppercase', padding: '0 0.25rem', borderRadius: 3, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-rose, #f43f5e)', marginLeft: '0.15rem', flexShrink: 0 }}>
                    {p.status === 'UNSEEDED' ? 'unseeded' : 'disabled'}
                  </span>
                )}
              </button>

              {/* Clean Professional Profile Hover Micro-Card */}
              {hoveredProfileKey === p.key && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100,
                    width: '240px',
                    background: 'var(--bg-card, #111827)',
                    border: '1px solid var(--border-default, #1f2937)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.75rem',
                    boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.5), 0 4px 12px -2px rgba(0, 0, 0, 0.3)',
                    pointerEvents: 'none',
                    textAlign: 'left',
                    lineHeight: 1.4
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {p.label}
                    </span>
                    <span 
                      className="badge font-mono" 
                      style={{ 
                        fontSize: '0.58rem', 
                        padding: '0.05rem 0.3rem',
                        background: p.disabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: p.disabled ? 'var(--accent-rose)' : 'var(--accent-emerald)'
                      }}
                    >
                      {p.status}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0 0 0.45rem', lineHeight: 1.35 }}>
                    {p.role}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))', fontSize: '0.65rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Target Tier</span>
                      <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{p.model}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Rate Limit</span>
                      <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.rpm}</span>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Semantic Cache</span>
                      <span className="font-mono" style={{ fontWeight: 500, color: 'var(--accent-lime)' }}>{p.cache}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Scalable Fleet Dropdown for 4+ Profiles / Large Fleets */}
          {allPresets.length > visiblePills.length && (
            <div style={{ position: 'relative' }} ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setIsProfileDropdownOpen(prev => !prev)}
                className={`btn btn-sm ${isProfileDropdownOpen ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.5rem',
                  height: 24,
                  gap: '0.25rem',
                  cursor: 'pointer'
                }}
                title={`View all ${allPresets.length} available profiles and keys`}
              >
                <span>+{allPresets.length - visiblePills.length} more</span>
                <ChevronDown size={11} style={{ transform: isProfileDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
              </button>

              {isProfileDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 1000,
                    width: '300px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '10px',
                    boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.4), 0 4px 16px -2px rgba(0, 0, 0, 0.2)',
                    padding: '0.65rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      All Profiles &amp; Keys ({allPresets.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsProfileDropdownOpen(false)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* Filter Input */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={12} style={{ position: 'absolute', left: '0.55rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Search profiles or keys..."
                      value={profileSearchQuery}
                      onChange={(e) => setProfileSearchQuery(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '0.35rem 1.6rem 0.35rem 1.75rem',
                        fontSize: '0.75rem',
                        background: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                    {profileSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setProfileSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '0.45rem',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 2
                        }}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Scrollable Profiles List */}
                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {filteredDropdownPresets.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        No matching profiles found
                      </div>
                    ) : (
                      filteredDropdownPresets.map(p => {
                        const isSelected = virtualKey === p.key;
                        return (
                          <div
                            key={p.key}
                            onClick={() => {
                              if (p.disabled) return;
                              setVirtualKey(p.key);
                              setModel(p.model);
                              if (telemetry?.status >= 400 || errorInfo) {
                                setTelemetry(null);
                                setErrorInfo(null);
                                try {
                                  sessionStorage.removeItem('netra_playground_telemetry');
                                  sessionStorage.removeItem('netra_playground_error');
                                } catch (e) {}
                              }
                              setIsProfileDropdownOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.4rem 0.55rem',
                              borderRadius: '6px',
                              cursor: p.disabled ? 'not-allowed' : 'pointer',
                              background: isSelected ? 'var(--bg-card-hover)' : 'transparent',
                              border: isSelected ? '1px solid var(--border-strong)' : '1px solid transparent',
                              opacity: p.disabled ? 0.45 : 1
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Zap size={11} style={{ color: isSelected ? 'var(--accent-lime)' : 'var(--text-muted)' }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {p.label}
                                </span>
                                {p.disabled && (
                                  <span style={{ fontSize: '0.58rem', padding: '0 0.25rem', borderRadius: 3, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-rose)' }}>
                                    {p.status}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                {p.key} · {p.rpm}
                              </div>
                            </div>
                            {isSelected && (
                              <Check size={14} style={{ color: 'var(--accent-emerald)', flexShrink: 0, marginLeft: '0.5rem' }} />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {onNavigate && (
                    <div style={{ paddingTop: '0.35rem', borderTop: '1px solid var(--border-subtle)' }}>
                      <button
                        type="button"
                        disabled={isMintDisabled}
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          onNavigate('keys');
                        }}
                        className="btn btn-sm btn-outline font-mono"
                        style={{
                          width: '100%',
                          fontSize: '0.72rem',
                          padding: '0.3rem',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          color: isMintDisabled ? 'var(--text-muted)' : 'var(--accent-primary)',
                          cursor: isMintDisabled ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Plus size={12} />
                        <span>Mint New Virtual Key</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('keys')}
              disabled={isMintDisabled}
              className="btn btn-sm btn-outline"
              style={{ 
                fontSize: '0.72rem', 
                padding: '0.15rem 0.5rem', 
                height: 24, 
                gap: '0.25rem', 
                borderColor: isMintDisabled ? 'var(--border-subtle)' : 'var(--accent-primary)', 
                color: isMintDisabled ? 'var(--text-muted)' : 'var(--accent-primary)',
                opacity: isMintDisabled ? 0.5 : 1,
                cursor: isMintDisabled ? 'not-allowed' : 'pointer'
              }}
              title={isDemoToken ? "Admin token required to mint virtual keys" : globalAuthStatus.isUnauthorized ? "Admin token rejected - key creation disabled" : !isOnline ? "Gateway offline - key creation disabled" : "Mint a virtual key in Virtual Keys manager"}
            >
              + Mint Key
            </button>
          )}
        </div>
      </div>

      {/* Main Workbench View: Dual Compare vs Single Model */}
      {playgroundMode === 'compare' ? (
        <PlaygroundDualCompare
          virtualKey={virtualKey}
          catalog={catalog}
          formatCurrency={formatCurrency}
          isOnline={isOnline}
          onNavigate={onNavigate}
        />
      ) : (
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
            onOpenAdminModal={onOpenAdminModal}
            hasAuthError={hasAuthError}
            isMintDisabled={isMintDisabled}
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
      )}
    </div>
  );
}
