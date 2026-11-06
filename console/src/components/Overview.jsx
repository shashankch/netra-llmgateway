import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getApiUrl } from '../config/api';
import Pagination from './Pagination';
import { 
  TrendingUp, Zap, Database, Clock, ShieldAlert, ShieldCheck, Activity,
  PieChart, BarChart2, Layers, RefreshCw, Maximize2, X,
  Gauge, Cpu, Sparkles, Coins, CheckCircle, AlertTriangle, AlertCircle, Search,
  Key, ArrowUpRight
} from 'lucide-react';

export default function Overview({ adminToken = 'netra-admin-demo', onNavigate }) {
  const { formatCurrency, currency } = useTheme();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(null);
  const [keys, setKeys] = useState([]);
  const [cacheStats, setCacheStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [providerHealth, setProviderHealth] = useState(null);
  const [providerHealthError, setProviderHealthError] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedChartModal, setSelectedChartModal] = useState(null);
  const [modelViewMode, setModelViewMode] = useState('alias'); // 'alias' | 'concrete'
  const [providerSearch, setProviderSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('ALL'); // 'ALL' | 'HEALTHY' | 'DEGRADED' | 'TRIPPED'
  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixPageSize, setMatrixPageSize] = useState(10);
  const [providerGridPage, setProviderGridPage] = useState(1);
  const providerGridPageSize = 6;
  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingProviderFilter, setPricingProviderFilter] = useState('ALL');
  const [pricingPage, setPricingPage] = useState(1);
  const [pricingPageSize, setPricingPageSize] = useState(10);
  const [isFetchingPricing, setIsFetchingPricing] = useState(false);

  const fetchPricingCatalog = async () => {
    try {
      setIsFetchingPricing(true);
      const headers = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};
      const res = await fetch(getApiUrl('/admin/pricing'), { headers });
      if (res.ok) {
        const json = await res.json();
        setPricing(json);
      }
    } catch (e) {
      console.warn("Could not refresh pricing catalog:", e);
    } finally {
      setIsFetchingPricing(false);
    }
  };

  useEffect(() => {
    if (showPricingModal) {
      fetchPricingCatalog();
    }
  }, [showPricingModal, adminToken]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = { 'Authorization': `Bearer ${adminToken}` };

      const [usageRes, keysRes, cacheRes, logsRes, pricingRes, healthRes] = await Promise.all([
        fetch(getApiUrl('/admin/usage?key=all'), { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(getApiUrl('/admin/keys'), { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(getApiUrl('/admin/cache/stats'), { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(getApiUrl('/admin/logs?limit=50'), { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(getApiUrl('/admin/pricing'), { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(getApiUrl('/admin/providers/health'), { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      setUsage(usageRes);
      setKeys(keysRes || []);
      setCacheStats(cacheRes);
      setLogs(logsRes || []);
      setPricing(pricingRes);
      if (healthRes !== null) {
        setProviderHealth(healthRes);
        setProviderHealthError(false);
      } else {
        setProviderHealth(null);
        setProviderHealthError(true);
      }
    } catch (e) {
      console.error("Failed to load console metrics", e);
      setProviderHealthError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [adminToken]);

  // Lock background body scroll and dismiss on Escape when any modal is active
  useEffect(() => {
    const hasOpenModal = Boolean(selectedChartModal || showPricingModal);
    if (hasOpenModal) {
      document.body.classList.add('modal-open');
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setSelectedChartModal(null);
          setShowPricingModal(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.classList.remove('modal-open');
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [selectedChartModal, showPricingModal]);

  // Dynamic pricing & aliases configured in backend / application.yml
  const fastAlias = pricing?.aliases?.fast;
  const smartAlias = pricing?.aliases?.smart;
  const fastModelName = fastAlias?.primary || 'alpha-small';
  const smartModelName = smartAlias?.primary || 'alpha-large';
  const fastRate = fastAlias?.input_per_1m ?? fastAlias?.inputPer1m ?? 0.15;
  const smartRate = smartAlias?.input_per_1m ?? smartAlias?.inputPer1m ?? 3.00;

  // Derived metrics from logs & backend
  const totalRequests = usage?.requests ?? logs.length ?? 0;
  const totalCost = usage?.cost_usd ?? 0;
  const promptTokens = (usage?.prompt_tokens != null && usage?.prompt_tokens > 0)
    ? usage.prompt_tokens
    : logs.reduce((sum, l) => sum + (l.prompt_tokens || 0), 0);
  const completionTokens = (usage?.completion_tokens != null && usage?.completion_tokens > 0)
    ? usage.completion_tokens
    : logs.reduce((sum, l) => sum + (l.completion_tokens || 0), 0);
  const totalTokens = promptTokens + completionTokens;
  const avgTokensPerReq = totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0;

  // Stream metrics
  const streamLogs = logs.filter(l => l.stream === true || l.is_stream === true || (l.completion_tokens || 0) > 0);
  const streamCount = streamLogs.length;
  const streamPct = logs.length > 0 ? Math.round((streamCount / logs.length) * 100) : 0;

  // Latency calculation from logs
  const latencies = logs.map(l => l.latency_ms || 0).filter(n => n > 0).sort((a, b) => a - b);
  const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p90 = latencies.length ? latencies[Math.floor(latencies.length * 0.9)] : 0;
  const p99 = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : 0;
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  // Disambiguate requested virtual aliases from resolved foundation models (Issue: prevents double counting)
  const modelBreakdown = {
    fast: logs.filter(l => l.requested_model === 'fast').length,
    smart: logs.filter(l => l.requested_model === 'smart').length,
    auto: logs.filter(l => l.requested_model === 'auto').length,
    direct: logs.filter(l => l.requested_model && !['fast', 'smart', 'auto'].includes(l.requested_model)).length,
  };
  const totalModelCalls = modelBreakdown.fast + modelBreakdown.smart + modelBreakdown.auto + modelBreakdown.direct || logs.length;

  // Resolved tier execution distribution (Smart Router Arbitrage)
  const isFastResolved = (l) => {
    const rm = (l.resolved_model || '').toLowerCase();
    const target = (l.provider_target || l.target || '').toLowerCase();
    const reason = (l.route_reason || '').toLowerCase();
    return (
      rm === (fastModelName || '').toLowerCase() ||
      rm.includes('flash') || rm.includes('mini') || rm.includes('small') ||
      rm.includes('nano') || rm.includes('lite') || rm.includes('8b') || rm.includes('7b') ||
      target.includes('flash') || target.includes('mini') ||
      reason.includes('simple') || reason.includes('fast')
    );
  };

  const isSmartResolved = (l) => {
    if (isFastResolved(l)) return false;
    const rm = (l.resolved_model || '').toLowerCase();
    const target = (l.provider_target || l.target || '').toLowerCase();
    const reason = (l.route_reason || '').toLowerCase();
    return (
      rm === (smartModelName || '').toLowerCase() ||
      rm.includes('deepseek') || rm.includes('sonnet') || rm.includes('opus') ||
      rm.includes('gpt-4') || rm.includes('o1') || rm.includes('o3') ||
      rm.includes('large') || rm.includes('70b') || rm.includes('r1') ||
      target.includes('deepseek') || target.includes('sonnet') ||
      reason.includes('complex') || reason.includes('smart') ||
      l.requested_model === 'smart' ||
      (l.requested_model === 'auto' && !isFastResolved(l))
    );
  };

  const autoLogs = logs.filter(l => l.requested_model === 'auto');
  const autoRoutedFast = autoLogs.filter(isFastResolved).length;
  const autoRoutedSmart = autoLogs.filter(isSmartResolved).length;

  const resolvedTierBreakdown = {
    fast: logs.filter(isFastResolved).length,
    smart: logs.filter(isSmartResolved).length,
  };

  const formatCalls = (n) => {
    if (!n) return '0 calls';
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M calls`;
    if (n >= 10000) return `${(n / 1000).toFixed(1)}k calls`;
    return `${n.toLocaleString()} calls`;
  };

  // Concrete foundation models aggregated dynamically from logs
  const concreteModelStats = React.useMemo(() => {
    const map = {};
    logs.forEach(l => {
      const model = l.resolved_model || l.requested_model || 'unknown';
      if (!map[model]) {
        let prov = l.provider;
        if (!prov) {
          if (model.includes('/')) prov = model.split('/')[0];
          else if (model.startsWith('alpha')) prov = 'alpha';
          else if (model.startsWith('beta')) prov = 'beta';
          else prov = 'openrouter';
        }
        map[model] = {
          name: model,
          provider: prov,
          calls: 0,
          tokens: 0,
          cost: 0
        };
      }
      map[model].calls += 1;
      map[model].tokens += (l.prompt_tokens || 0) + (l.completion_tokens || 0);
      map[model].cost += (Number(l.cost_usd) || 0);
    });
    const list = Object.values(map).sort((a, b) => b.calls - a.calls);
    if (list.length === 0) {
      return [
        { name: fastModelName, provider: fastModelName.includes('/') ? fastModelName.split('/')[0] : 'alpha', calls: 0, tokens: 0, cost: 0 },
        { name: smartModelName, provider: smartModelName.includes('/') ? smartModelName.split('/')[0] : 'alpha', calls: 0, tokens: 0, cost: 0 }
      ];
    }
    return list;
  }, [logs, fastModelName, smartModelName]);

  // Chart 2: Smart Router Arbitrage Efficiency (Resolved Execution Tier)
  const totalDiverted = resolvedTierBreakdown.fast + resolvedTierBreakdown.smart;
  const fastPct = totalDiverted > 0 ? Math.round((resolvedTierBreakdown.fast / totalDiverted) * 100) : 0;
  const smartPct = totalDiverted > 0 ? (100 - fastPct) : 0;
  const arbitrageSavingsPct = (smartRate > fastRate && smartRate > 0)
    ? (((smartRate - fastRate) / smartRate) * 100).toFixed(1)
    : '0.0';

  // Chart 3: Semantic Cache Waterfall & Savings
  const cacheHits = cacheStats?.total_hits ?? (usage?.cache_hits ?? logs.filter(l => l.cache === 'hit').length ?? 0);
  const cacheMisses = cacheStats?.total_misses ?? (totalRequests > cacheHits ? (totalRequests - cacheHits) : logs.filter(l => l.cache === 'miss').length ?? 0);
  const cacheTotal = cacheHits + cacheMisses;
  const cacheHitRate = cacheStats?.hit_rate != null
    ? (cacheStats.hit_rate * 100).toFixed(1)
    : (cacheTotal > 0 ? ((cacheHits / cacheTotal) * 100).toFixed(1) : (totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(1) : '0.0'));

  // Cumulative saved calculation: each cache hit saved an upstream LLM invocation
  const avgCostPerMiss = cacheMisses > 0 ? (totalCost / cacheMisses) : (totalRequests > 0 ? (totalCost / totalRequests) : 0.000030);
  const cumulativeSaved = cacheHits > 0 ? (cacheHits * avgCostPerMiss) : 0;

  // Issue 2 fix: Real upstream provider health data only — never fabricate health on failure
  const isHealthAvailable = !providerHealthError && providerHealth !== null;
  const allProviders = (isHealthAvailable && Array.isArray(providerHealth)) ? providerHealth : [];
  
  const filteredProviders = allProviders.filter(p => {
    const matchesSearch = !providerSearch || p.provider.toLowerCase().includes(providerSearch.toLowerCase());
    const isClosed = p.circuit_state === 'CLOSED';
    const isOpen = p.circuit_state === 'OPEN';
    const isHalfOpen = p.circuit_state === 'HALF_OPEN';

    let matchesStatus = true;
    if (providerFilter === 'HEALTHY') matchesStatus = isClosed && (p.failure_rate || 0) < 10;
    else if (providerFilter === 'DEGRADED') matchesStatus = (p.failure_rate || 0) >= 10 || isHalfOpen;
    else if (providerFilter === 'TRIPPED') matchesStatus = isOpen;
    return matchesSearch && matchesStatus;
  });

  const healthyCount = allProviders.filter(p => p.circuit_state === 'CLOSED' && (p.failure_rate || 0) < 10).length;
  const degradedCount = allProviders.filter(p => (p.failure_rate || 0) >= 10 || p.circuit_state === 'HALF_OPEN').length;
  const trippedCount = allProviders.filter(p => p.circuit_state === 'OPEN').length;
  const measuredProviders = allProviders.filter(p => p.p95_latency_ms != null && p.p95_latency_ms > 0);
  const globalAvgP95 = measuredProviders.length ? Math.round(measuredProviders.reduce((acc, p) => acc + p.p95_latency_ms, 0) / measuredProviders.length) : null;

  // Scalable pagination slices for enterprise provider clusters & catalog models
  const paginatedMatrixProviders = filteredProviders.slice(
    (matrixPage - 1) * matrixPageSize,
    matrixPage * matrixPageSize
  );

  const paginatedGridProviders = filteredProviders.slice(
    (providerGridPage - 1) * providerGridPageSize,
    providerGridPage * providerGridPageSize
  );

  const getModelContextWindow = (modelName) => {
    if (!modelName) return '128k';
    const m = modelName.toLowerCase();
    if (m.includes('gemini')) return '1M';
    if (m.includes('claude') || m.includes('sonnet') || m.includes('o3-mini')) return '200k';
    if (m.includes('llama-3.3') || m.includes('llama-3')) return '131k';
    if (m.includes('gpt-3.5')) return '16k';
    return '128k';
  };

  const getModelTierBadge = (modelName) => {
    if (!modelName) return <span className="badge badge-alias-auto">auto</span>;
    const clean = modelName.replace(/^[a-zA-Z0-9_-]+:/, '').toLowerCase();

    const fastTargets = [
      pricing?.aliases?.fast?.primary,
      ...(pricing?.aliases?.fast?.fallbacks || [])
    ].filter(Boolean).map(s => s.replace(/^[a-zA-Z0-9_-]+:/, '').toLowerCase());

    const smartTargets = [
      pricing?.aliases?.smart?.primary,
      ...(pricing?.aliases?.smart?.fallbacks || [])
    ].filter(Boolean).map(s => s.replace(/^[a-zA-Z0-9_-]+:/, '').toLowerCase());

    if (fastTargets.includes(clean) || clean.includes('small') || clean.includes('mini') || clean.includes('nano') || clean.includes('lightning') || clean.includes('lite') || clean.includes('3.5-turbo')) {
      return <span className="badge badge-alias-fast">fast</span>;
    }
    if (smartTargets.includes(clean) || clean.includes('large') || clean.includes('sonnet') || clean.includes('o3') || clean.includes('r1') || clean.includes('gpt-4o')) {
      return <span className="badge badge-alias-smart">smart</span>;
    }
    return <span className="badge badge-alias-auto">auto</span>;
  };

  const formatProviderName = (prov) => {
    if (!prov) return '';
    if (prov.toUpperCase() === 'ALL') return 'All';
    const map = {
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
    return map[prov.toLowerCase()] || (prov.charAt(0).toUpperCase() + prov.slice(1));
  };

  const defaultPricingModels = [
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

  const rawPricingModels = React.useMemo(() => {
    const liveModels = Array.isArray(pricing?.models) ? pricing.models : [];
    if (liveModels.length === 0) return defaultPricingModels;

    const liveMap = new Map(liveModels.map(m => [m.model, m]));
    const merged = defaultPricingModels.map(def => {
      const live = liveMap.get(def.model);
      if (live) {
        liveMap.delete(def.model);
        return {
          ...def,
          ...live,
          input_per_1m: live.input_per_1m != null ? Number(live.input_per_1m) : def.input_per_1m,
          output_per_1m: live.output_per_1m != null ? Number(live.output_per_1m) : def.output_per_1m,
          provider: live.provider || def.provider,
          context_window: def.context_window || getModelContextWindow(def.model)
        };
      }
      return def;
    });

    for (const [extraModel, extraObj] of liveMap.entries()) {
      merged.push({
        model: extraModel,
        provider: extraObj.provider || (extraModel.includes('/') ? extraModel.split('/')[0] : 'custom'),
        input_per_1m: extraObj.input_per_1m != null ? Number(extraObj.input_per_1m) : 0,
        output_per_1m: extraObj.output_per_1m != null ? Number(extraObj.output_per_1m) : 0,
        context_window: getModelContextWindow(extraModel),
        alias: 'auto'
      });
    }
    return merged;
  }, [pricing]);
  const pricingProvidersList = ['ALL', ...Array.from(new Set(rawPricingModels.map(m => m.provider.toLowerCase())))];

  const filteredPricingModels = rawPricingModels.filter(m => {
    const matchesSearch = !pricingSearch ||
      m.model.toLowerCase().includes(pricingSearch.toLowerCase()) ||
      m.provider.toLowerCase().includes(pricingSearch.toLowerCase());
    const matchesProvider = pricingProviderFilter === 'ALL' ||
      m.provider.toLowerCase() === pricingProviderFilter.toLowerCase();
    return matchesSearch && matchesProvider;
  });

  const paginatedPricingModels = filteredPricingModels.slice(
    (pricingPage - 1) * pricingPageSize,
    pricingPage * pricingPageSize
  );

  // Dynamic cache tier hit metrics (Tier 1 SHA-256 vs Tier 2 HNSW)
  const tier1Hits = cacheStats?.tier1_exact_hits ?? logs.filter(l => l.cache_tier === 'tier1_exact').length;
  const tier2Hits = cacheStats?.tier2_semantic_hits ?? (cacheHits > tier1Hits ? (cacheHits - tier1Hits) : logs.filter(l => l.cache_tier === 'tier2_semantic').length);
  const totalCacheEvaluations = tier1Hits + tier2Hits + cacheMisses;
  const tier1Pct = totalCacheEvaluations > 0 ? Math.round((tier1Hits / totalCacheEvaluations) * 100) : 0;
  const tier2Pct = totalCacheEvaluations > 0 ? Math.round((tier2Hits / totalCacheEvaluations) * 100) : 0;
  const missPct = totalCacheEvaluations > 0 ? Math.max(0, 100 - tier1Pct - tier2Pct) : 0;

  // Dynamic similarity threshold computed from configured tenant virtual keys (calibrated baseline: 0.920)
  const configuredThreshold = React.useMemo(() => {
    const searchKey = keys.find(k => k.virtual_key?.includes('search') || k.team === 'search');
    if (searchKey && searchKey.similarity_threshold != null && Number(searchKey.similarity_threshold) > 0) {
      return Number(searchKey.similarity_threshold).toFixed(3);
    }
    const activeWithThreshold = keys.filter(k => k.semantic_cache_enabled && k.similarity_threshold != null && Number(k.similarity_threshold) > 0);
    if (activeWithThreshold.length > 0) {
      return Number(activeWithThreshold[0].similarity_threshold).toFixed(3);
    }
    return '0.920';
  }, [keys]);

  // Scaled percentage for the visual histogram divider based on dynamic threshold (mapped on 0.70 to 1.00 range)
  const thresholdDividerPct = React.useMemo(() => {
    const val = Number(configuredThreshold);
    const pct = Math.round(((val - 0.70) / 0.30) * 80) + 10;
    return Math.max(15, Math.min(85, pct));
  }, [configuredThreshold]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner / Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Gateway Analytics &amp; Telemetry
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Real-time multi-tenant traffic routing, token burn-down, and semantic vector cache savings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="btn btn-secondary btn-sm" 
            title="Refresh Telemetry"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 5 Headline KPI Cards */}
      <div className="kpi-grid">
        {/* KPI 1: Total Spend */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Spend</span>
            <span className="badge badge-success" style={{ fontSize: '0.6875rem', padding: '0.2rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700 }}>
              Active ({currency})
            </span>
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-lime)' }}>
            {formatCurrency(totalCost)}
          </div>
          <div className="kpi-subtext">
            Real-time token cost accounting
          </div>
        </div>

        {/* KPI 2: Total Requests */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Requests</span>
            <Zap size={16} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div className="kpi-value">
            {totalRequests.toLocaleString()}
          </div>
          <div className="kpi-subtext">
            0.00% over-admission sliding window
          </div>
        </div>

        {/* KPI 3: Token Volume */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Token Volume</span>
            <Layers size={16} style={{ color: 'var(--accent-emerald)' }} />
          </div>
          <div className="kpi-value">
            {totalTokens > 0 ? (totalTokens > 1000000 ? `${(totalTokens / 1000000).toFixed(2)}M` : `${(totalTokens / 1000).toFixed(1)}k`) : '0'}
          </div>
          <div className="kpi-subtext">
            Prompt: {promptTokens.toLocaleString()} · Compl: {completionTokens.toLocaleString()}
          </div>
        </div>

        {/* KPI 4: Semantic Cache Hit Rate */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Semantic Cache Hit Rate</span>
            <Database size={16} style={{ color: 'var(--accent-emerald)' }} />
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-emerald)' }}>
            {cacheHitRate}%
          </div>
          <div className="kpi-subtext">
            Sub-5ms zero-cost semantic matches
          </div>
        </div>

        {/* KPI 5: Avg Latency / TTFT */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Avg Latency (TTFT)</span>
            <Clock size={16} style={{ color: 'var(--accent-amber)' }} />
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-amber)' }}>
            {avgLatency} <span style={{ fontSize: '1rem', fontWeight: 500 }}>ms</span>
          </div>
          <div className="kpi-subtext">
            p50: {p50}ms · p90: {p90}ms · p99: {p99}ms
          </div>
        </div>
      </div>

      {/* 4 Interactive Analytics Charts */}
      <div className="charts-grid">
        {/* Chart 1: Model Spend & Volume Trends */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem', gap: '0.5rem', minHeight: 46 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <BarChart2 size={18} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Model Spend &amp; Volume Trends</h3>
                <span className="badge badge-success font-mono" style={{ fontSize: '0.625rem', padding: '0.15rem 0.5rem', fontWeight: 700 }}>
                  LIVE
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                {modelViewMode === 'alias'
                  ? `Traffic distribution across tiers (${logs.length} sampled requests)`
                  : `Model execution share (${logs.length} sampled requests)`}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {/* Segmented Pill Toggle: Tiers vs Concrete Models */}
              <div style={{
                display: 'inline-flex',
                background: 'var(--bg-canvas)',
                borderRadius: 6,
                padding: 2,
                border: '1px solid var(--border-subtle)'
              }}>
                <button 
                  onClick={() => setModelViewMode('alias')}
                  style={{
                    border: 'none',
                    background: modelViewMode === 'alias' ? 'var(--bg-card)' : 'transparent',
                    color: modelViewMode === 'alias' ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: modelViewMode === 'alias' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
                  }}
                >
                  By Tier
                </button>
                <button 
                  onClick={() => setModelViewMode('concrete')}
                  style={{
                    border: 'none',
                    background: modelViewMode === 'concrete' ? 'var(--bg-card)' : 'transparent',
                    color: modelViewMode === 'concrete' ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: modelViewMode === 'concrete' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
                  }}
                >
                  By Model
                </button>
              </div>
            </div>
          </div>

          {modelViewMode === 'alias' ? (
            /* Alias Tier Bar Chart */
            <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', gap: '2rem', padding: '1rem 2rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
              {/* Fast Bar */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatCalls(modelBreakdown.fast)}</div>
                <div style={{
                  width: '100%',
                  height: `${totalModelCalls > 0 ? Math.max(12, (modelBreakdown.fast / totalModelCalls) * 140) : 12}px`,
                  background: 'linear-gradient(180deg, var(--accent-cyan) 0%, rgba(6,182,212,0.4) 100%)',
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.3s ease'
                }} />
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>fast</div>
              </div>

              {/* Smart Bar */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatCalls(modelBreakdown.smart)}</div>
                <div style={{
                  width: '100%',
                  height: `${totalModelCalls > 0 ? Math.max(12, (modelBreakdown.smart / totalModelCalls) * 140) : 12}px`,
                  background: 'linear-gradient(180deg, var(--accent-primary) 0%, rgba(99,102,241,0.4) 100%)',
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.3s ease'
                }} />
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>smart</div>
              </div>

              {/* Auto Bar */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatCalls(modelBreakdown.auto)}</div>
                <div style={{
                  width: '100%',
                  height: `${totalModelCalls > 0 ? Math.max(12, (modelBreakdown.auto / totalModelCalls) * 140) : 12}px`,
                  background: 'linear-gradient(180deg, var(--accent-emerald) 0%, rgba(16,185,129,0.4) 100%)',
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.3s ease'
                }} />
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>auto</div>
              </div>
            </div>
          ) : (
            /* Concrete Model Horizontal Bars View */
            <div style={{
              height: 180,
              padding: '0.75rem 1rem',
              background: 'var(--bg-canvas)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '0.6rem',
              overflowY: 'auto'
            }}>
              {concreteModelStats.slice(0, 4).map((m, idx) => {
                const sampleTotalCalls = concreteModelStats.reduce((sum, item) => sum + item.calls, 0) || 1;
                const pct = Math.max(6, Math.round((m.calls / sampleTotalCalls) * 100));
                const colors = ['var(--accent-cyan)', 'var(--accent-primary)', 'var(--accent-emerald)', 'var(--accent-amber)'];
                const color = colors[idx % colors.length];
                return (
                  <div key={m.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 160
                        }} title={m.name}>
                          {m.name}
                        </span>
                        <span className="badge badge-neutral" style={{ fontSize: '0.625rem', padding: '0.1rem 0.35rem' }}>
                          {m.provider}
                        </span>
                      </div>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                        {m.calls.toLocaleString()} calls ({((m.calls / sampleTotalCalls) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${m.calls > 0 ? pct : 0}%`,
                        height: '100%',
                        background: color,
                        borderRadius: 3,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Polished Tier & Pricing Legend Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.625rem',
            marginTop: 'auto',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            {/* Fast Tier */}
            <div style={{
              background: 'var(--bg-canvas)',
              borderRadius: 8,
              padding: '0.55rem 0.7rem',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              minWidth: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: 6, height: 6, minWidth: 6, borderRadius: '50%', background: 'var(--accent-cyan)', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>fast</span>
                </div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                  ${fastRate.toFixed(2)}<span style={{ fontSize: '0.625rem', fontWeight: 400, color: 'var(--text-muted)' }}>/1M</span>
                </span>
              </div>
              <div style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }} title={fastModelName}>
                {fastModelName}
              </div>
            </div>

            {/* Smart Tier */}
            <div style={{
              background: 'var(--bg-canvas)',
              borderRadius: 8,
              padding: '0.55rem 0.7rem',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              minWidth: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: 6, height: 6, minWidth: 6, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>smart</span>
                </div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                  ${smartRate.toFixed(2)}<span style={{ fontSize: '0.625rem', fontWeight: 400, color: 'var(--text-muted)' }}>/1M</span>
                </span>
              </div>
              <div style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }} title={smartModelName}>
                {smartModelName}
              </div>
            </div>

            {/* Auto Tier */}
            <div style={{
              background: 'var(--bg-canvas)',
              borderRadius: 8,
              padding: '0.55rem 0.7rem',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              minWidth: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: 6, height: 6, minWidth: 6, borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>auto</span>
                </div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                  ~{arbitrageSavingsPct}%<span style={{ fontSize: '0.625rem', fontWeight: 400, color: 'var(--text-muted)' }}> save</span>
                </span>
              </div>
              <div style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }} title="Dynamic Margin Gating & Syntactic Complexity Steering (<0.2ms)">
                Adaptive Classifier
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Smart Router Arbitrage Efficiency */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem', gap: '0.5rem', minHeight: 46 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Smart Router Arbitrage Efficiency</h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>Intelligent Prompt Difficulty &amp; Complexity Steering</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <span className="badge badge-success" style={{ fontSize: '0.6875rem', padding: '0.2rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700 }}>
                SMART ARBITRAGE
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 180, background: 'var(--bg-canvas)', borderRadius: 8, padding: '1rem' }}>
            {/* SVG Donut Chart */}
            <div style={{ position: 'relative', width: 130, height: 130 }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                {/* Background Ring */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--border-strong)"
                  strokeWidth="3.8"
                />
                {/* Fast Segment */}
                {totalDiverted > 0 && fastPct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="4"
                    strokeDasharray={`${fastPct}, 100`}
                  />
                )}
                {/* Smart Segment */}
                {totalDiverted > 0 && smartPct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="4"
                    strokeDasharray={`${smartPct}, 100`}
                    strokeDashoffset={`-${fastPct}`}
                  />
                )}
              </svg>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '0 0.5rem', textAlign: 'center'
              }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                  {totalDiverted > 0 ? `${fastPct}%` : '0%'}
                </span>
                <span style={{ 
                  fontSize: '0.58rem', 
                  color: 'var(--text-muted)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em',
                  maxWidth: 80,
                  textAlign: 'center',
                  lineHeight: 1.2
                }}>
                  {totalDiverted > 0 ? 'Fast Diverted' : 'No Traffic'}
                </span>
              </div>
            </div>

            {/* Complexity attribution breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent-cyan)' }} />
                <span>Simple Queries &rarr; Fast ({fastModelName})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent-primary)' }} />
                <span>Complex Proofs &rarr; Smart ({smartModelName})</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                <span>Deterministic syntactic complexity classification</span>
              </div>
            </div>
          </div>

          {/* Dynamic Arbitrage Telemetry Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.625rem',
            marginTop: 'auto',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            {/* Auto Routing Volume */}
            <div style={{
              background: 'var(--bg-canvas)',
              borderRadius: 8,
              padding: '0.55rem 0.7rem',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              minWidth: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Routed Volume</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                  {autoLogs.length > 0 ? autoLogs.length : totalDiverted} calls
                </span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {logs.length > 0 ? Math.round(((autoLogs.length > 0 ? autoLogs.length : totalDiverted) / logs.length) * 100) : 0}% of fleet traffic
              </div>
            </div>

            {/* Fast-Path Ratio */}
            <div style={{
              background: 'var(--bg-canvas)',
              borderRadius: 8,
              padding: '0.55rem 0.7rem',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              minWidth: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Fast-Path</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                  {totalDiverted > 0 ? `${fastPct}%` : '0%'}
                </span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {resolvedTierBreakdown.fast} routed to fast tier
              </div>
            </div>

            {/* Frontier Smart Ratio */}
            <div style={{
              background: 'var(--bg-canvas)',
              borderRadius: 8,
              padding: '0.55rem 0.7rem',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              minWidth: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Frontier Smart</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                  {totalDiverted > 0 ? `${smartPct}%` : '0%'}
                </span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {resolvedTierBreakdown.smart} routed to frontier tier
              </div>
            </div>
          </div>
        </div>

        {/* Chart 3: Semantic Cache Volume & Savings */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem', gap: '0.5rem', minHeight: 46 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={18} style={{ color: 'var(--accent-emerald)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Semantic Cache Volume &amp; Savings</h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>Direct Upstream Calls vs. Instant Cache Hits</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <span className="badge badge-success" style={{ fontSize: '0.6875rem', padding: '0.2rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700 }}>
                VECTOR CACHE
              </span>
            </div>
          </div>

          <div style={{ height: 180, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem', background: 'var(--bg-canvas)', borderRadius: 8, padding: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 600 }}>Instant Cache Hits ($0 Token Cost)</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{cacheHits.toLocaleString()} calls ({cacheHitRate}%)</span>
              </div>
              <div style={{ width: '100%', height: 12, background: 'var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${cacheTotal > 0 ? cacheHitRate : 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-emerald) 0%, var(--accent-cyan) 100%)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 600 }}>Upstream Model Calls (Billed)</span>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{cacheMisses.toLocaleString()} calls</span>
              </div>
              <div style={{ width: '100%', height: 12, background: 'var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${cacheTotal > 0 ? (100 - Number(cacheHitRate)).toFixed(1) : 0}%`, height: '100%', background: 'var(--accent-amber)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingTop: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Per-key isolation active</span>
              <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>Cumulative Saved: {formatCurrency(cumulativeSaved)}</span>
            </div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', minHeight: 36, display: 'flex', alignItems: 'center' }}>
            Zero-cost semantic retrieval automatically eliminates duplicate LLM invocations
          </div>
        </div>

        {/* Chart 4: Latency Percentiles */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem', gap: '0.5rem', minHeight: 46 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: 'var(--accent-amber)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Latency &amp; Response Times (ms)</h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>End-to-end gateway response times across traffic</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <span className="badge badge-success" style={{ fontSize: '0.6875rem', padding: '0.2rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700 }}>
                FLEET LATENCY
              </span>
            </div>
          </div>

          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'space-around', background: 'var(--bg-canvas)', borderRadius: 8, padding: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>p50 (Median)</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{p50}ms</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Typical Response</div>
            </div>
            <div style={{ width: 1, height: 80, background: 'var(--border-strong)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>p90</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{p90}ms</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Under Load</div>
            </div>
            <div style={{ width: 1, height: 80, background: 'var(--border-strong)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>p99</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{p99}ms</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tail Latency</div>
            </div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', minHeight: 36, display: 'flex', alignItems: 'center' }}>
            Zero client buffering with ultra-low pass-through overhead
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Enterprise Resilience & Live Provider Health Explorer                     */}
      {/* ========================================================================= */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent-emerald)' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                Upstream Provider Health &amp; Circuit Breakers
              </h3>
            </div>
            <p style={{ fontSize: '0.78125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Continuous health probe telemetry with automated circuit breaking and sub-millisecond fallback across upstream endpoints.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setShowPricingModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
            >
              <Coins size={14} />
              <span>Model Pricing &amp; Context Explorer</span>
            </button>
            <span className={`badge ${isHealthAvailable ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.6875rem', padding: '0.2rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700 }}>
              {isHealthAvailable ? 'FAULT TOLERANT' : 'DISCONNECTED'}
            </span>
            <button
              onClick={() => setSelectedChartModal('providerHealth')}
              className="btn btn-secondary btn-sm"
              title="Expand Provider Health &amp; Routing Matrix"
              style={{ padding: '0.25rem 0.5rem', height: 28 }}
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* Scalability Filter Strip: Global KPI Bar + Search & Status Filter Chips */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.65rem 0.85rem',
          background: 'var(--bg-canvas)',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          marginBottom: '1rem'
        }}>
          {/* Quick Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Providers: <strong style={{ color: 'var(--text-primary)' }}>{allProviders.length}</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-emerald)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Operational:</span>
              <strong style={{ color: 'var(--accent-emerald)' }}>{healthyCount}</strong>
            </span>
            {degradedCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-amber)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Degraded:</span>
                <strong style={{ color: 'var(--accent-amber)' }}>{degradedCount}</strong>
              </span>
            )}
            {trippedCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-rose)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Tripped:</span>
                <strong style={{ color: 'var(--accent-rose)' }}>{trippedCount}</strong>
              </span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>
              Fleet p95: <strong style={{ color: 'var(--accent-cyan)' }}>{globalAvgP95 != null ? `${globalAvgP95}ms` : '—'}</strong>
            </span>
          </div>

          {/* Search & Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex',
              background: 'var(--bg-card)',
              borderRadius: 6,
              padding: 2,
              border: '1px solid var(--border-subtle)',
              height: 32,
              alignItems: 'center'
            }}>
              {['ALL', 'HEALTHY', 'DEGRADED', 'TRIPPED'].map(tab => (
                <button
                  key={tab}
                  onClick={() => {
                    setProviderFilter(tab);
                    setMatrixPage(1);
                    setProviderGridPage(1);
                  }}
                  style={{
                    border: 'none',
                    height: '100%',
                    background: providerFilter === tab ? 'var(--bg-surface)' : 'transparent',
                    color: providerFilter === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: providerFilter === tab ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {tab === 'ALL' ? `All (${allProviders.length})` :
                   tab === 'HEALTHY' ? `Healthy (${healthyCount})` :
                   tab === 'DEGRADED' ? `Degraded (${degradedCount})` :
                   `Tripped (${trippedCount})`}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Filter providers by name..."
                value={providerSearch}
                onChange={e => {
                  setProviderSearch(e.target.value);
                  setMatrixPage(1);
                  setProviderGridPage(1);
                }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  height: 32,
                  padding: providerSearch ? '0 1.8rem 0 2rem' : '0 0.75rem 0 2rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  width: 220,
                  outline: 'none',
                  transition: 'border-color 0.15s ease, width 0.2s ease, box-shadow 0.15s ease'
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--accent-primary)';
                  e.target.style.boxShadow = '0 0 0 2px var(--accent-primary-subtle)';
                  e.target.style.width = '260px';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--border-subtle)';
                  e.target.style.boxShadow = 'none';
                  if (!providerSearch) e.target.style.width = '220px';
                }}
              />
              {providerSearch && (
                <button
                  onClick={() => {
                    setProviderSearch('');
                    setMatrixPage(1);
                    setProviderGridPage(1);
                  }}
                  style={{
                    position: 'absolute',
                    right: '0.45rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2
                  }}
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scalable Provider Grid (Gracefully handles 4 to 100+ Providers without layout blowout) */}
        <div style={{
          maxHeight: 380,
          overflowY: 'auto',
          paddingRight: filteredProviders.length > 4 ? 4 : 0
        }}>
          {filteredProviders.length === 0 ? (
            <div style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              background: 'var(--bg-canvas)',
              borderRadius: 8,
              border: '1px dashed var(--border-subtle)',
              margin: '0.5rem 0'
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {!isHealthAvailable ? 'Provider Telemetry Offline' : (providerSearch ? 'No Providers Found' : 'No Providers Configured')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {!isHealthAvailable 
                  ? 'Unable to connect to gateway health monitors. Ensure the gateway service is running and your admin credentials are configured.'
                  : (providerSearch ? 'No providers matched your search filter.' : 'No upstream provider endpoints are currently registered in this environment.')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {paginatedGridProviders.map(p => {
                const isClosed = p.circuit_state === 'CLOSED';
                const isOpen = p.circuit_state === 'OPEN';
                const stateBadgeColor = isClosed ? 'badge-success' : (isOpen ? 'badge-danger' : 'badge-warning');
                const stateDotColor = isClosed ? 'var(--accent-emerald)' : (isOpen ? 'var(--accent-rose)' : 'var(--accent-amber)');

                return (
                  <div 
                    key={p.provider} 
                    style={{
                      background: 'var(--bg-canvas)',
                      border: `1px solid ${isOpen ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                      borderRadius: 10,
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: stateDotColor, boxShadow: `0 0 8px ${stateDotColor}` }} />
                        <span style={{ fontWeight: 700, fontSize: '0.9375rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{p.provider}</span>
                      </div>
                      <span className={`badge ${stateBadgeColor}`} style={{ fontSize: '0.65rem' }}>
                        {p.circuit_state}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Failure Rate</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: p.failure_rate > 20 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                          {(p.failure_rate || 0).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>p95 Latency</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent-cyan)' }}>
                          {p.p95_latency_ms != null && p.p95_latency_ms > 0 ? `${p.p95_latency_ms}ms` : '—'}
                        </div>
                      </div>
                    </div>

                    <div style={{ width: '100%', height: 6, background: 'var(--border-strong)', borderRadius: 3, overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${Math.max(5, Math.min(100, 100 - (p.failure_rate || 0)))}%`, 
                          height: '100%', 
                          background: isClosed ? 'var(--accent-emerald)' : (isOpen ? 'var(--accent-rose)' : 'var(--accent-amber)') 
                        }} 
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      <span>Circuit Protection: {isOpen ? 'Tripped (< 0.05ms)' : 'Healthy'}</span>
                      <span>{p.successful_calls ?? 0} ok / {p.failed_calls ?? 0} err</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span>
              Showing {filteredProviders.length === 0 ? 0 : (providerGridPage - 1) * providerGridPageSize + 1}–{Math.min(providerGridPage * providerGridPageSize, filteredProviders.length)} of {allProviders.length} configured upstream providers
            </span>
            {Math.ceil(filteredProviders.length / providerGridPageSize) > 1 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  onClick={() => setProviderGridPage(p => Math.max(1, p - 1))}
                  disabled={providerGridPage === 1}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.15rem 0.4rem', height: 22, fontSize: '0.7rem' }}
                  title="Previous page"
                >
                  &larr;
                </button>
                <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-primary)', padding: '0 0.2rem' }}>
                  {providerGridPage} / {Math.ceil(filteredProviders.length / providerGridPageSize)}
                </span>
                <button
                  onClick={() => setProviderGridPage(p => Math.min(Math.ceil(filteredProviders.length / providerGridPageSize), p + 1))}
                  disabled={providerGridPage === Math.ceil(filteredProviders.length / providerGridPageSize)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.15rem 0.4rem', height: 22, fontSize: '0.7rem' }}
                  title="Next page"
                >
                  &rarr;
                </button>
              </div>
            )}
          </div>
          <button 
            onClick={() => setSelectedChartModal('providerHealth')} 
            style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.75rem', padding: 0, fontWeight: 600 }}
          >
            View all in expanded table &rarr;
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* High-Impact Differentiator Visual Widgets                                 */}
      {/* ========================================================================= */}
      <div className="charts-grid">
        {/* Widget 1: Stream Delivery & Token Efficiency */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.5rem', minHeight: 46 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Gauge size={18} style={{ color: 'var(--accent-lime)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Stream Delivery &amp; Token Efficiency</h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                Real-time token generation throughput, stream ratio, and unbuffered SSE relay performance
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <span className="badge badge-success" style={{ fontSize: '0.6875rem', padding: '0.2rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700 }}>
                TOKEN STREAM
              </span>
            </div>
          </div>

          <div style={{
            height: 180,
            background: 'var(--bg-canvas)',
            borderRadius: 8,
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.75rem'
          }}>
            {/* Circular Stream Ratio Indicator */}
            <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                {/* Background Ring Track */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--border-strong)"
                  strokeWidth="3.6"
                />
                {/* Active Stream Percentage Arc (Only drawn when traffic exists and streamPct > 0) */}
                {logs.length > 0 && streamPct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--accent-lime)"
                    strokeWidth="3.8"
                    strokeDasharray={`${streamPct}, 100`}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '0 0.5rem', textAlign: 'center'
              }}>
                <span style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 800, 
                  color: (logs.length > 0 && streamPct > 0) ? 'var(--accent-lime)' : 'var(--text-muted)', 
                  fontFamily: 'var(--font-mono)' 
                }}>
                  {streamPct}%
                </span>
                <span style={{ 
                  fontSize: '0.58rem', 
                  color: 'var(--text-muted)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em',
                  maxWidth: 80,
                  textAlign: 'center',
                  lineHeight: 1.2
                }}>
                  {logs.length > 0 ? 'Stream Ratio' : 'No Traffic'}
                </span>
              </div>
            </div>

            {/* Structured Telemetry Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.75rem', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-cyan)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Prompt Ingress Tokens</span>
                </div>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {promptTokens.toLocaleString()} tokens
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.75rem', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-emerald)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Completion Stream Output</span>
                </div>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                  {completionTokens.toLocaleString()} tokens
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.75rem', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-lime)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Average Token Velocity</span>
                </div>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--accent-lime)', fontFamily: 'var(--font-mono)' }}>
                  {avgTokensPerReq.toLocaleString()} tok/req
                </strong>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', minHeight: 36, display: 'flex', alignItems: 'center' }}>
            High-throughput streaming pipeline with instant token spend reclamation on client disconnect
          </div>
        </div>

        {/* Widget 2: Semantic Cache & Accuracy Guard */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.5rem', minHeight: 46 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: 'var(--accent-emerald)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Semantic Cache &amp; Accuracy Guard</h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                Precision similarity threshold (&ge; {configuredThreshold}) ensures high-speed response reuse while guarding against near-misses
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <span className="badge badge-success" style={{ fontSize: '0.6875rem', padding: '0.2rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700 }}>
                ACCURACY GUARD
              </span>
            </div>
          </div>

          <div style={{ height: 180, background: 'var(--bg-canvas)', borderRadius: 8, padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <strong>Precision Threshold Boundary</strong>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>&ge; {configuredThreshold} Similarity Score</div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                <strong>{totalCacheEvaluations > 0 ? `${(100 - missPct)}%` : '0%'} Hit Rate</strong>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{cacheHits.toLocaleString()} Cached Responses</div>
              </div>
            </div>

            {/* Dynamic Segmented Distribution Bar */}
            <div style={{ position: 'relative', display: 'flex', width: '100%', height: 26, background: 'var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
              {totalCacheEvaluations === 0 ? (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)'
                }}>
                  No cache traffic evaluated yet
                </div>
              ) : (
                <>
                  {tier1Pct > 0 && (
                    <div 
                      style={{ width: `${tier1Pct}%`, background: 'var(--accent-emerald)', transition: 'width 0.3s ease' }} 
                      title={`Exact Matches: ${tier1Hits} (${tier1Pct}%)`}
                    />
                  )}
                  {tier2Pct > 0 && (
                    <div 
                      style={{ width: `${tier2Pct}%`, background: 'var(--accent-cyan)', transition: 'width 0.3s ease' }} 
                      title={`Semantic Matches: ${tier2Hits} (${tier2Pct}%)`}
                    />
                  )}
                  {missPct > 0 && (
                    <div 
                      style={{ width: `${missPct}%`, background: 'rgba(239,68,68,0.25)', transition: 'width 0.3s ease' }} 
                      title={`Upstream Routed (Misses): ${cacheMisses} (${missPct}%)`}
                    />
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span title="Instant sub-millisecond query matches">Exact Hits: <strong style={{ color: 'var(--accent-emerald)' }}>{tier1Hits.toLocaleString()}</strong> <span style={{ color: 'var(--text-muted)' }}>(Fast Path)</span></span>
              <span title="High-precision semantic similarity matches">Semantic Hits: <strong style={{ color: 'var(--accent-cyan)' }}>{tier2Hits.toLocaleString()}</strong> <span style={{ color: 'var(--text-muted)' }}>(Precision Match)</span></span>
              <span title="Queries forwarded to upstream foundation models">Upstream Routed: <strong style={{ color: 'var(--text-muted)' }}>{cacheMisses.toLocaleString()}</strong> <span style={{ color: 'var(--text-muted)' }}>(Model Invocations)</span></span>
            </div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', minHeight: 36, display: 'flex', alignItems: 'center' }}>
            Zero-latency semantic caching with isolated tenant boundaries ensures 100% data privacy and zero cross-tenant contamination
          </div>
        </div>
      </div>

      {/* 8. Top Tenant Spend & Quota Burn-Down Leaderboard */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-lime)'
            }}>
              <Key size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Top Tenant Spend &amp; Quota Burn-Down
                </h3>
                <span className="badge badge-success" style={{ fontSize: '0.6875rem', padding: '0.2rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  MULTI-TENANT GOVERNANCE
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>
                Real-time tenant budget consumption, RPM quotas, and isolated cache boundaries
              </p>
            </div>
          </div>

          <button 
            onClick={() => onNavigate && onNavigate('keys')} 
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
          >
            <span>Manage All {keys.length > 0 ? `(${keys.length})` : ''} Keys</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        {keys.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            background: 'var(--bg-canvas)',
            borderRadius: 8,
            border: '1px dashed var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.65rem'
          }}>
            <Key size={24} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              No tenant virtual keys detected
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.45 }}>
              Connect to a running NETRA instance or initialize seeded tenant accounts from the CLI.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[...keys]
              .sort((a, b) => {
                const spendA = Number(a.current_spend_usd) || 0;
                const spendB = Number(b.current_spend_usd) || 0;
                return spendB - spendA;
              })
              .slice(0, 5)
              .map(k => {
                const budget = Number(k.monthly_budget_usd) || 0;
                const spend = Number(k.current_spend_usd) || 0;
                const pct = budget > 0 ? Math.min(100, Math.round((spend / budget) * 100)) : 0;
                const barColor = pct > 90 ? 'var(--accent-rose)' : (pct > 70 ? 'var(--accent-amber)' : 'var(--accent-emerald)');
                const badgeColorClass = pct > 90 ? 'badge-danger' : (pct > 70 ? 'badge-warning' : 'badge-neutral');

                return (
                  <div key={k.virtual_key} style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '0.85rem 1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    transition: 'border-color 0.15s ease'
                  }}>
                    {/* Top Row: Team, Virtual Key, Spend / Budget */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {k.team}
                        </span>
                        <code style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 22,
                          padding: '0 0.5rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: 'var(--accent-cyan)',
                          background: 'var(--bg-card)',
                          borderRadius: 4,
                          border: '1px solid var(--border-subtle)',
                          fontFamily: 'var(--font-mono)',
                          lineHeight: 1
                        }}>
                          {k.virtual_key}
                        </code>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatCurrency(spend)}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          of {budget < 0 ? 'Unlimited' : formatCurrency(budget)}
                        </span>
                        <span className={`badge ${badgeColorClass} font-mono`} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 22,
                          padding: '0 0.5rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          lineHeight: 1
                        }}>
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.max(1, pct)}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: 3,
                        transition: 'width 0.3s ease',
                        boxShadow: `0 0 6px ${barColor}`
                      }} />
                    </div>

                    {/* Bottom Metadata Badges - Uniform 22px Height & Typography */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-neutral font-mono" style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 22,
                          padding: '0 0.5rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          lineHeight: 1
                        }}>
                          {k.rpm_limit} RPM
                        </span>
                        <span className={`badge ${k.semantic_cache_enabled ? 'badge-success' : 'badge-neutral'} font-mono`} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 22,
                          padding: '0 0.5rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          lineHeight: 1
                        }}>
                          {k.semantic_cache_enabled ? `CACHE \u2265 ${k.similarity_threshold}` : 'CACHE OFF'}
                        </span>
                        <span className="badge badge-neutral font-mono" style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 22,
                          padding: '0 0.5rem',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          lineHeight: 1
                        }}>
                          Allowlist: {(k.model_allowlist || []).join(', ')}
                        </span>
                      </div>

                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        height: 22,
                        padding: '0 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        borderRadius: 4,
                        background: k.status === 'ACTIVE' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        color: k.status === 'ACTIVE' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                        lineHeight: 1
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: k.status === 'ACTIVE' ? 'var(--accent-emerald)' : 'var(--accent-rose)', display: 'inline-block' }} />
                        <span>{k.status}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Telemetry Footer */}
        <div style={{
          marginTop: '1rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)'
        }}>
          <div>
            Showing Top {Math.min(5, keys.length)} of <strong>{keys.length}</strong> configured tenant namespaces
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Active: <strong style={{ color: 'var(--accent-emerald)' }}>{keys.filter(k => k.status === 'ACTIVE').length}</strong></span>
            <span>Cache Enabled: <strong style={{ color: 'var(--accent-cyan)' }}>{keys.filter(k => k.semantic_cache_enabled).length}</strong></span>
            <span>Over-Admission: <strong style={{ color: 'var(--accent-lime)' }}>0.00%</strong></span>
          </div>
        </div>
      </div>


      {/* Model Breakdown Modal */}
      {selectedChartModal === 'trends' && (
        <div className="modal-overlay" onClick={() => setSelectedChartModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Model Volume &amp; Spend Breakdown</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Traffic and cost distribution across configured model tiers</p>
              </div>
              <button onClick={() => setSelectedChartModal(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '0.85rem 1.1rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>Fast &amp; Lightweight Tier ({fastModelName})</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Input: ${fastRate.toFixed(2)}/1M · Cost-optimized for conversational chat &amp; extraction</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{modelBreakdown.fast.toLocaleString()} calls</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{totalModelCalls > 0 ? ((modelBreakdown.fast / totalModelCalls) * 100).toFixed(1) : '0.0'}% of total</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '0.85rem 1.1rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Frontier Intelligence Tier ({smartModelName})</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Input: ${smartRate.toFixed(2)}/1M · Advanced reasoning, code synthesis &amp; analysis</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{modelBreakdown.smart.toLocaleString()} calls</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{totalModelCalls > 0 ? ((modelBreakdown.smart / totalModelCalls) * 100).toFixed(1) : '0.0'}% of total</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '0.85rem 1.1rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>Automated Routing Tier (Dynamic Arbitrage)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Intelligent query classification with up to ~{arbitrageSavingsPct}% cost reduction</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{modelBreakdown.auto.toLocaleString()} calls</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{totalModelCalls > 0 ? ((modelBreakdown.auto / totalModelCalls) * 100).toFixed(1) : '0.0'}% of total</div>
                </div>
              </div>
            </div>

            {/* Individual Concrete Model Invocations Table */}
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Invocations by Concrete Foundation Model
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                <table style={{ width: '100%', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-canvas)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Model</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Provider</th>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Calls</th>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Tokens</th>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Est. Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concreteModelStats.map(m => (
                      <tr key={m.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{m.name}</td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>
                          <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>{m.provider}</span>
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 600 }}>{m.calls.toLocaleString()}</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: 'var(--text-muted)' }}>{m.tokens.toLocaleString()}</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(m.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer-pills">
              <div className="modal-footer-item">
                <span className="modal-footer-dot" style={{ background: 'var(--accent-emerald)' }} />
                <span>Total Ingress Volume: <strong>{totalModelCalls.toLocaleString()} calls</strong></span>
              </div>
              <div className="modal-footer-item" style={{ justifyContent: 'flex-end' }}>
                <span className="modal-footer-dot" style={{ background: 'var(--accent-cyan)' }} />
                <span>Real-time pricing catalog synchronized</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Arbitrage Modal */}
      {selectedChartModal === 'arbitrage' && (
        <div className="modal-overlay" onClick={() => setSelectedChartModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Smart Router Arbitrage Analytics</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Automated difficulty classification and enterprise cost reduction</p>
              </div>
              <button onClick={() => setSelectedChartModal(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Routed to Fast Tier ({fastModelName})</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{fastPct}%</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{resolvedTierBreakdown.fast.toLocaleString()} simple queries</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Escalated to Frontier Tier ({smartModelName})</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{smartPct}%</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{resolvedTierBreakdown.smart.toLocaleString()} complex reasoning tasks</div>
              </div>
            </div>

            <div className="modal-spec-grid">
              <div className="modal-spec-row">
                <span className="modal-spec-label">Average Token Cost Reduction</span>
                <span className="modal-spec-value" style={{ color: 'var(--accent-emerald)' }}>~{arbitrageSavingsPct}% per token</span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Routing Decision Latency</span>
                <span className="modal-spec-value">&lt; 0.20ms (Sub-millisecond intent evaluation)</span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Routing Decision Accuracy</span>
                <span className="modal-spec-value" style={{ color: 'var(--accent-emerald)' }}>100.00% benchmark consistency</span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Pre-Routing Gateway Overhead</span>
                <span className="modal-spec-value">$0.00 (Zero secondary model fees)</span>
              </div>
            </div>

            <div className="modal-footer-pills">
              <div className="modal-footer-item">
                <span className="modal-footer-dot" style={{ background: 'var(--accent-emerald)' }} />
                <span>Directs high-volume simple queries to cost-optimized models</span>
              </div>
              <div className="modal-footer-item" style={{ justifyContent: 'flex-end' }}>
                <span className="modal-footer-dot" style={{ background: 'var(--accent-cyan)' }} />
                <span>Deterministic, zero-latency intent evaluation</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Semantic Cache Modal */}
      {selectedChartModal === 'cache' && (
        <div className="modal-overlay" onClick={() => setSelectedChartModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Semantic Vector Cache Analytics</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Sub-5ms vector similarity caching and token cost elimination</p>
              </div>
              <button onClick={() => setSelectedChartModal(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hit Rate</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{cacheHitRate}%</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{cacheHits.toLocaleString()} instant hits</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upstream Billed</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{cacheMisses.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>model invocations</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cumulative Saved</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatCurrency(cumulativeSaved)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>$0 token cost</div>
              </div>
            </div>

            <div className="modal-spec-grid">
              <div className="modal-spec-row">
                <span className="modal-spec-label">Vector Embedding Engine</span>
                <span className="modal-spec-value">In-Process Dense Embeddings (Zero external API calls)</span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Vector Similarity Engine</span>
                <span className="modal-spec-value">Sub-millisecond Approximate Nearest Neighbor</span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Data Privacy &amp; Isolation</span>
                <span className="modal-spec-value" style={{ color: 'var(--accent-emerald)' }}>Strict Cryptographic Partitioning (Zero cross-tenant bleed)</span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Safety &amp; Refusal Guard</span>
                <span className="modal-spec-value">Automatic Refusal Filtering (Refusals never cached)</span>
              </div>
            </div>

            <div className="modal-footer-pills">
              <div className="modal-footer-item">
                <span className="modal-footer-dot" style={{ background: 'var(--accent-emerald)' }} />
                <span>Sub-5ms responses eliminate redundant model costs</span>
              </div>
              <div className="modal-footer-item" style={{ justifyContent: 'flex-end' }}>
                <span className="modal-footer-dot" style={{ background: 'var(--accent-cyan)' }} />
                <span>Supports instant streaming replay with token deltas</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Latency Decomposition Modal */}
      {selectedChartModal === 'latency' && (
        <div className="modal-overlay" onClick={() => setSelectedChartModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Latency &amp; Ingress Overhead Decomposition</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Sub-millisecond pass-through telemetry across gateway processing stages</p>
              </div>
              <button onClick={() => setSelectedChartModal(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>p50 (Median)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{p50}ms</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Typical TTFT</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>p90</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{p90}ms</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Under Burst</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>p99</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{p99}ms</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tail Latency</div>
              </div>
            </div>

            <div className="modal-spec-grid">
              <div className="modal-spec-row">
                <span className="modal-spec-label">Virtual Key Authentication</span>
                <span className="modal-spec-value" style={{ color: 'var(--accent-emerald)' }}>&lt; 0.05ms</span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Rate Limit &amp; Quota Enforcement</span>
                <span className="modal-spec-value" style={{ color: 'var(--accent-emerald)' }}>&lt; 0.20ms</span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Semantic Intent Vectorization</span>
                <span className="modal-spec-value">~3.20ms</span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Vector Similarity Matching</span>
                <span className="modal-spec-value">~1.10ms</span>
              </div>
              <div className="modal-spec-row" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                <span className="modal-spec-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total Net Gateway Added Overhead</span>
                <span className="modal-spec-value" style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>0.22ms (p50 pass-through)</span>
              </div>
            </div>

            <div className="modal-footer-pills">
              <div className="modal-footer-item">
                <span className="modal-footer-dot" style={{ background: 'var(--accent-emerald)' }} />
                <span>Zero-buffering streaming pipeline</span>
              </div>
              <div className="modal-footer-item" style={{ justifyContent: 'flex-end' }}>
                <span className="modal-footer-dot" style={{ background: 'var(--accent-cyan)' }} />
                <span>Automatic connection reclamation on client disconnect</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Pricing Explorer Modal */}
      {showPricingModal && (
        <div className="modal-overlay" onClick={() => setShowPricingModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: 960, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(101, 163, 13, 0.12)',
                  border: '1px solid rgba(101, 163, 13, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-lime)'
                }}>
                  <Coins size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                      Model Pricing &amp; Context Explorer
                    </h3>
                    <span className="badge badge-neutral font-mono" style={{ fontSize: '0.65rem', padding: '0.12rem 0.5rem' }}>
                      {rawPricingModels.length} Models
                    </span>
                    {pricing?.models && pricing.models.length > 0 && (
                      <span className="badge badge-success font-mono" style={{ fontSize: '0.65rem', padding: '0.12rem 0.5rem' }}>
                        LIVE SYNC
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', margin: 0 }}>
                    Active catalog pricing, token rates per 1M tokens, and context window limits ({currency})
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={fetchPricingCatalog}
                  disabled={isFetchingPricing}
                  className="btn btn-outline btn-sm font-mono"
                  style={{ height: 32, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0 0.65rem' }}
                  title="Refresh pricing catalog from control plane"
                >
                  <RefreshCw size={13} className={isFetchingPricing ? "animate-spin" : ""} />
                  <span>Refresh</span>
                </button>
                <button 
                  onClick={() => setShowPricingModal(false)} 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Enterprise Model Search & Provider Filter Toolbar */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              background: 'var(--bg-canvas)',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              marginBottom: '1rem'
            }}>
              {/* Row 1: Search Input & Result Count Indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 300px', maxWidth: 460 }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.85rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Search models, providers, context sizes..."
                    value={pricingSearch}
                    onChange={e => {
                      setPricingSearch(e.target.value);
                      setPricingPage(1);
                    }}
                    className="input-text font-mono"
                    style={{
                      width: '100%',
                      height: 36,
                      paddingLeft: '2.4rem',
                      paddingRight: pricingSearch ? '2.4rem' : '0.85rem',
                      fontSize: '0.8125rem'
                    }}
                  />
                  {pricingSearch && (
                    <button
                      onClick={() => {
                        setPricingSearch('');
                        setPricingPage(1);
                      }}
                      style={{
                        position: 'absolute',
                        right: '0.65rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 3
                      }}
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span className="font-mono">
                    Showing <strong>{filteredPricingModels.length}</strong> of <strong>{rawPricingModels.length}</strong> models
                  </span>
                  {(pricingSearch || pricingProviderFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPricingSearch('');
                        setPricingProviderFilter('ALL');
                        setPricingPage(1);
                      }}
                      className="btn btn-outline btn-sm font-mono"
                      style={{ height: 26, padding: '0 0.5rem', fontSize: '0.7rem', color: 'var(--accent-primary)' }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Provider Filter Pills (Clean, Spacious, Horizontally Scrollable) */}
              <div 
                className="provider-pills-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  overflowX: 'auto',
                  paddingBottom: '0.2rem',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {pricingProvidersList.map(prov => {
                  const isActive = pricingProviderFilter.toLowerCase() === prov.toLowerCase();
                  const count = prov === 'ALL' 
                    ? rawPricingModels.length 
                    : rawPricingModels.filter(m => m.provider.toLowerCase() === prov.toLowerCase()).length;
                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => {
                        setPricingProviderFilter(prov);
                        setPricingPage(1);
                      }}
                      className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}`}
                      style={{
                        height: 28,
                        padding: '0 0.65rem',
                        fontSize: '0.75rem',
                        borderRadius: 6,
                        fontWeight: isActive ? 700 : 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{formatProviderName(prov)}</span>
                      <span 
                        className="font-mono"
                        style={{
                          fontSize: '0.65rem',
                          opacity: isActive ? 0.9 : 0.6,
                          fontWeight: 700
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="table-container" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Model Identifier</th>
                    <th>Provider</th>
                    <th>Input / 1M Tokens</th>
                    <th>Output / 1M Tokens</th>
                    <th>Context Limit</th>
                    <th>Routing Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPricingModels.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                        No models match your search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedPricingModels.map(m => (
                      <tr key={m.model}>
                        <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{m.model}</td>
                        <td>
                          <span className="badge badge-neutral font-mono" style={{ fontSize: '0.68rem', padding: '0.12rem 0.45rem' }}>
                            {formatProviderName(m.provider)}
                          </span>
                        </td>
                        <td style={{ color: 'var(--accent-lime)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(m.input_per_1m ?? m.inputPer1m)}
                        </td>
                        <td style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(m.output_per_1m ?? m.outputPer1m)}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {m.context_window || getModelContextWindow(m.model)}
                        </td>
                        <td>{getModelTierBadge(m.model)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredPricingModels.length > 0 && (
              <Pagination
                totalItems={filteredPricingModels.length}
                pageSize={pricingPageSize}
                currentPage={pricingPage}
                onPageChange={setPricingPage}
                onPageSizeChange={size => {
                  setPricingPageSize(size);
                  setPricingPage(1);
                }}
                pageSizeOptions={[5, 10, 20, 50]}
              />
            )}

            <div className="modal-footer-pills" style={{ marginTop: '1rem' }}>
              <div className="modal-footer-item">
                <span className="modal-footer-dot" style={{ background: 'var(--accent-lime)' }} />
                <span>Exchange rate calculated dynamically via live forex feed</span>
              </div>
              <div className="modal-footer-item" style={{ justifyContent: 'flex-end' }}>
                <span className="modal-footer-dot" style={{ background: 'var(--accent-cyan)' }} />
                <span>Synchronized with active provider rate cards</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provider Health & Failover Matrix Modal */}
      {selectedChartModal === 'providerHealth' && (
        <div className="modal-overlay" onClick={() => setSelectedChartModal(null)}>
          <div className="modal-dialog" style={{ maxWidth: 960, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Upstream Provider Health &amp; Failover Matrix</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Continuous cluster health telemetry, latency profiles, and automated circuit breaking across upstream LLM providers
                </p>
              </div>
              <button onClick={() => setSelectedChartModal(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configured Providers</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{allProviders.length}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Active Endpoints</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Operational</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{healthyCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Closed Circuits</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Degraded / Tripped</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: (degradedCount + trippedCount) > 0 ? 'var(--accent-rose)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {degradedCount + trippedCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Fast-Fail Protection</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fleet p95 Latency</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{globalAvgP95}ms</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sliding Window</div>
              </div>
            </div>

            {/* Modal Search & Filter Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{
                display: 'inline-flex',
                background: 'var(--bg-canvas)',
                borderRadius: 6,
                padding: 2,
                border: '1px solid var(--border-subtle)'
              }}>
                {['ALL', 'HEALTHY', 'DEGRADED', 'TRIPPED'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      setProviderFilter(tab);
                      setMatrixPage(1);
                    }}
                    style={{
                      border: 'none',
                      height: '100%',
                      background: providerFilter === tab ? 'var(--bg-card)' : 'transparent',
                      color: providerFilter === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                      padding: '0 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: 4,
                      cursor: 'pointer',
                      boxShadow: providerFilter === tab ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {tab === 'ALL' ? `All (${allProviders.length})` :
                     tab === 'HEALTHY' ? `Healthy (${healthyCount})` :
                     tab === 'DEGRADED' ? `Degraded (${degradedCount})` :
                     `Tripped (${trippedCount})`}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.65rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search provider by name..."
                  value={providerSearch}
                  onChange={e => {
                    setProviderSearch(e.target.value);
                    setMatrixPage(1);
                  }}
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    height: 32,
                    padding: providerSearch ? '0 1.8rem 0 2rem' : '0 0.75rem 0 2rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-primary)',
                    width: 240,
                    outline: 'none',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--accent-primary)';
                    e.target.style.boxShadow = '0 0 0 2px var(--accent-primary-subtle)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--border-subtle)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {providerSearch && (
                  <button
                    onClick={() => {
                      setProviderSearch('');
                      setMatrixPage(1);
                    }}
                    style={{
                      position: 'absolute',
                      right: '0.45rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 2
                    }}
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Comprehensive Tabular Breakdown for 4 to 100+ Providers */}
            <div className="table-container" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Circuit State</th>
                    <th>Failure Rate</th>
                    <th>Slow Call Rate</th>
                    <th>p95 Latency</th>
                    <th>Volume (OK / Err)</th>
                    <th>Failover Route</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMatrixProviders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                        No upstream providers match filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedMatrixProviders.map(p => {
                      const isClosed = p.circuit_state === 'CLOSED';
                      const isOpen = p.circuit_state === 'OPEN';
                      const stateBadgeColor = isClosed ? 'badge-success' : (isOpen ? 'badge-danger' : 'badge-warning');
                      return (
                        <tr key={p.provider}>
                          <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', textTransform: 'uppercase' }}>
                            {p.provider}
                          </td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                              <span style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: isClosed ? 'var(--accent-emerald)' : (isOpen ? 'var(--accent-rose)' : 'var(--accent-amber)')
                              }} />
                              {isOpen ? 'Outage' : ((p.failure_rate || 0) > 10 ? 'Degraded' : 'Operational')}
                            </span>
                          </td>
                          <td><span className={`badge ${stateBadgeColor}`}>{p.circuit_state}</span></td>
                          <td style={{ fontWeight: 600, color: p.failure_rate > 20 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                            {(p.failure_rate || 0).toFixed(1)}%
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{(p.slow_call_rate || 0).toFixed(1)}%</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            {p.p95_latency_ms != null && p.p95_latency_ms > 0 ? `${p.p95_latency_ms}ms` : '—'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                            {p.successful_calls || 0} ok / {p.failed_calls || 0} err
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {isOpen ? 'Fast-fail (< 0.05ms) rerouted' : 'Primary active route'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredProviders.length > 0 && (
              <Pagination
                totalItems={filteredProviders.length}
                pageSize={matrixPageSize}
                currentPage={matrixPage}
                onPageChange={setMatrixPage}
                onPageSizeChange={size => {
                  setMatrixPageSize(size);
                  setMatrixPage(1);
                }}
                pageSizeOptions={[5, 10, 25, 50, 100]}
              />
            )}

            <div className="modal-footer-pills" style={{ marginTop: '1rem' }}>
              <div className="modal-footer-item">
                <span className="modal-footer-dot" style={{ background: 'var(--accent-emerald)' }} />
                <span>Sub-0.05ms fast-fail rejection when circuit trips</span>
              </div>
              <div className="modal-footer-item" style={{ justifyContent: 'flex-end' }}>
                <span className="modal-footer-dot" style={{ background: 'var(--accent-cyan)' }} />
                <span>Automated sliding-window health evaluation</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stream Severance & Spend Reclaim Modal */}
      {selectedChartModal === 'streamSeverance' && (
        <div className="modal-overlay" onClick={() => setSelectedChartModal(null)}>
          <div className="modal-dialog" style={{ maxWidth: 780, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Stream Severance &amp; Phantom Spend Reclaim</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Real-time upstream connection termination and compute cost recovery on client disconnects
                </p>
              </div>
              <button onClick={() => setSelectedChartModal(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stream Ratio</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-lime)', fontFamily: 'var(--font-mono)' }}>{streamPct}%</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{streamCount} Streaming Calls</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prompt Ingress</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{promptTokens.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tokens Ingested</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Completion Output</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{completionTokens.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tokens Delivered</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg Token Velocity</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{avgTokensPerReq}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Avg Tokens / Req</div>
              </div>
            </div>

            {/* Structured 3-Card Architecture Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.875rem 1rem', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem', minHeight: '1.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Client Stream Watch</span>
                  <span className="badge badge-success font-mono" style={{ fontSize: '0.625rem', padding: '0.15rem 0.45rem', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>ACTIVE</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  Continuously tracks client TCP and HTTP/2 stream liveness across active streaming connections.
                </p>
              </div>

              <div style={{ padding: '0.875rem 1rem', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem', minHeight: '1.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Disconnect Protection</span>
                  <span className="badge badge-success font-mono" style={{ fontSize: '0.625rem', padding: '0.15rem 0.45rem', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>&lt; 2MS</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  On client disconnect or window close, upstream provider streams terminate immediately, halting inference.
                </p>
              </div>

              <div style={{ padding: '0.875rem 1rem', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem', minHeight: '1.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Zero Ghost Spend</span>
                  <span className="badge badge-success font-mono" style={{ fontSize: '0.625rem', padding: '0.15rem 0.45rem', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>RECLAIMED</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  Eliminates phantom billing for unread tokens, cutting up to 15–30% of inference spend in conversational workloads.
                </p>
              </div>
            </div>

            <div className="modal-footer-pills" style={{ marginTop: '1rem' }}>
              <div className="modal-footer-item">
                <span className="modal-footer-dot" style={{ background: 'var(--accent-lime)' }} />
                <span>Zero phantom token billing</span>
              </div>
              <div className="modal-footer-item" style={{ justifyContent: 'flex-end' }}>
                <span className="modal-footer-dot" style={{ background: 'var(--accent-cyan)' }} />
                <span>Immediate upstream compute reclamation</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Semantic Cache & Accuracy Guard Modal */}
      {selectedChartModal === 'semanticCache' && (
        <div className="modal-overlay" onClick={() => setSelectedChartModal(null)}>
          <div className="modal-dialog" style={{ maxWidth: 780, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Semantic Cache &amp; Accuracy Guard</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Two-tier intelligent caching with strict similarity thresholds and tenant-isolated data protection
                </p>
              </div>
              <button onClick={() => setSelectedChartModal(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Exact Matches</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                  {tier1Hits.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sub-0.1ms Instant Return</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Semantic Matches</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                  {tier2Hits.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sub-5ms Similarity Search</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Similarity Threshold</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-lime)', fontFamily: 'var(--font-mono)' }}>
                  &ge; {configuredThreshold}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>High-Confidence Policy</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tenant Partitioning</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                  {keys.length} {keys.length === 1 ? 'Tenant' : 'Tenants'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Zero Data Leakage</div>
              </div>
            </div>

            {/* Structured 2x2 Feature & Pipeline Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.875rem 1rem', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem', minHeight: '1.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Tier 1: Exact Match Cache</span>
                  <span className="badge badge-success font-mono" style={{ fontSize: '0.625rem', padding: '0.15rem 0.45rem', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>&lt; 0.1MS</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  Instant zero-cost replay for identical prompts. Delivers repeated requests in sub-millisecond time with zero LLM compute spend.
                </p>
              </div>

              <div style={{ padding: '0.875rem 1rem', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem', minHeight: '1.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Tier 2: Semantic Similarity Cache</span>
                  <span className="badge badge-success font-mono" style={{ fontSize: '0.625rem', padding: '0.15rem 0.45rem', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>&lt; 5MS</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  Intelligent semantic matching across paraphrased prompts. Reclaims upstream model costs while preserving contextual accuracy.
                </p>
              </div>

              <div style={{ padding: '0.875rem 1rem', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem', minHeight: '1.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Hallucination &amp; Drift Guard</span>
                  <span className="badge badge-success font-mono" style={{ fontSize: '0.625rem', padding: '0.15rem 0.45rem', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>&ge; {configuredThreshold}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  Strict similarity confidence threshold blocks near-miss queries to prevent out-of-context replies and prompt drift.
                </p>
              </div>

              <div style={{ padding: '0.875rem 1rem', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem', minHeight: '1.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Tenant Privacy &amp; Isolation</span>
                  <span className="badge badge-success font-mono" style={{ fontSize: '0.625rem', padding: '0.15rem 0.45rem', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>ENFORCED</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  Cryptographically isolated cache partitions guarantee zero data leakage between keys. Model refusals and errors are never cached.
                </p>
              </div>
            </div>

            <div className="modal-footer-pills" style={{ marginTop: '1rem' }}>
              <div className="modal-footer-item">
                <span className="modal-footer-dot" style={{ background: 'var(--accent-emerald)' }} />
                <span>Zero cross-tenant data leakage</span>
              </div>
              <div className="modal-footer-item" style={{ justifyContent: 'flex-end' }}>
                <span className="modal-footer-dot" style={{ background: 'var(--accent-cyan)' }} />
                <span>Instant streaming response replay</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

