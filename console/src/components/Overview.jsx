import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getApiUrl } from '../config/api';
import { RefreshCw } from 'lucide-react';

import OverviewKpis from './overview/OverviewKpis';
import OverviewCharts from './overview/OverviewCharts';
import ProviderFleetSection from './overview/ProviderFleetSection';
import DifferentiatorWidgets from './overview/DifferentiatorWidgets';
import TenantSpendLeaderboard from './overview/TenantSpendLeaderboard';
import PricingCatalogModal from './overview/PricingCatalogModal';
import ProviderFleetModal from './overview/ProviderFleetModal';
import OverviewDetailModals from './overview/OverviewDetailModals';
import SandboxNoticeBanner from './SandboxNoticeBanner';
import { DEMO_USAGE, DEMO_KEYS, DEMO_CACHE_STATS, getDemoLogs, DEMO_PROVIDER_HEALTH } from '../constants/demoFallbackData';

export default function Overview({ adminToken = 'netra-admin-demo', onNavigate, onOpenAdminModal }) {
  const { formatCurrency, currency } = useTheme();
  const isDemoToken = !adminToken || adminToken === 'netra-admin-demo';
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

      const hasLiveUsage = usageRes && ((usageRes.requests || usageRes.total_requests || 0) > 0 || (usageRes.costUsd || usageRes.cost_usd || 0) > 0);
      setUsage(hasLiveUsage ? usageRes : (isDemoToken ? DEMO_USAGE : usageRes));

      const hasLiveKeys = Array.isArray(keysRes) && keysRes.length > 0;
      setKeys(hasLiveKeys ? keysRes : (isDemoToken ? DEMO_KEYS : []));

      const hasLiveCache = cacheRes && ((cacheRes.total_entries || 0) > 0 || (cacheRes.total_hits || 0) > 0);
      setCacheStats(hasLiveCache ? cacheRes : (isDemoToken ? DEMO_CACHE_STATS : cacheRes));

      const hasLiveLogs = Array.isArray(logsRes) && logsRes.length > 0;
      setLogs(hasLiveLogs ? logsRes : (isDemoToken ? getDemoLogs() : []));

      setPricing(pricingRes);
      if (healthRes !== null && Array.isArray(healthRes) && healthRes.length > 0) {
        setProviderHealth(healthRes);
        setProviderHealthError(false);
      } else if (isDemoToken) {
        setProviderHealth(DEMO_PROVIDER_HEALTH.providers);
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
  const totalRequests = usage?.requests ?? (usage?.total_requests ?? logs.length ?? 0);
  const totalCost = usage?.cost_usd ?? (usage?.costUsd ?? (usage?.total_spend_usd ?? 0));
  const promptTokens = (usage?.prompt_tokens != null && usage?.prompt_tokens > 0)
    ? usage.prompt_tokens
    : (usage?.promptTokens != null && usage?.promptTokens > 0
      ? usage.promptTokens
      : logs.reduce((sum, l) => sum + (l.prompt_tokens || 0), 0));
  const completionTokens = (usage?.completion_tokens != null && usage?.completion_tokens > 0)
    ? usage.completion_tokens
    : (usage?.completionTokens != null && usage?.completionTokens > 0
      ? usage.completionTokens
      : logs.reduce((sum, l) => sum + (l.completion_tokens || 0), 0));
  const totalTokens = (usage?.total_tokens != null && usage?.total_tokens > 0)
    ? usage.total_tokens
    : (promptTokens + completionTokens);
  const avgTokensPerReq = totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0;

  // Stream metrics: accurately isolate true SSE stream traffic from standard JSON completions
  const streamLogs = logs.filter(l => l.stream === true || l.is_stream === true);
  const streamCount = streamLogs.length;
  const streamPct = (usage?.stream_ratio != null && usage?.stream_ratio > 0)
    ? Math.round(usage.stream_ratio * 100)
    : (logs.length > 0 ? Math.round((streamCount / logs.length) * 100) : 0);

  // Latency calculation from logs & backend aggregates
  const latencies = logs.map(l => l.latency_ms || l.total_latency_ms || 0).filter(n => n > 0).sort((a, b) => a - b);
  const p50 = usage?.p50_latency_ms ?? (latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0);
  const p90 = usage?.p90_latency_ms ?? (latencies.length ? latencies[Math.floor(latencies.length * 0.9)] : 0);
  const p99 = usage?.p99_latency_ms ?? (latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : 0);
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : (p50 || 0);

  // Disambiguate requested virtual aliases vs dynamic classifier-routed execution
  const directFast = logs.filter(l => l.requested_model === 'fast').length;
  const directSmart = logs.filter(l => l.requested_model === 'smart').length;
  const directOther = logs.filter(l => l.requested_model && !['fast', 'smart', 'auto'].includes(l.requested_model)).length;
  const autoLogs = logs.filter(l => l.requested_model === 'auto');

  // Authoritative execution tier resolver
  const getLogExecutionTier = (l) => {
    const reason = (l.route_reason || '').toLowerCase();
    if (reason.includes('-> smart') || reason.includes('to smart') || reason.includes('auto -> smart') || reason.includes('routed to smart')) {
      return 'smart';
    }
    if (reason.includes('-> fast') || reason.includes('to fast') || reason.includes('auto -> fast') || reason.includes('routed to fast')) {
      return 'fast';
    }

    const rm = (l.resolved_model || '').toLowerCase();
    const target = (l.provider_target || l.target || '').toLowerCase();
    const fastPrimary = (fastModelName || '').toLowerCase();
    const smartPrimary = (smartModelName || '').toLowerCase();

    if (smartPrimary && (rm === smartPrimary || rm.endsWith('/' + smartPrimary) || target.includes(smartPrimary))) {
      return 'smart';
    }
    if (fastPrimary && (rm === fastPrimary || rm.endsWith('/' + fastPrimary) || target.includes(fastPrimary))) {
      return 'fast';
    }

    if (l.requested_model === 'smart') return 'smart';
    if (l.requested_model === 'fast') return 'fast';

    if (rm.includes('deepseek-reasoner') || rm.includes('r1') || rm.includes('o1') || rm.includes('o3') ||
        rm.includes('sonnet') || rm.includes('opus') || rm.includes('gpt-4') || rm.includes('70b') || rm.includes('large')) {
      return 'smart';
    }
    if (rm.includes('flash') || rm.includes('mini') || rm.includes('small') || rm.includes('nano') || rm.includes('lite') || rm.includes('8b')) {
      return 'fast';
    }

    return 'fast';
  };

  const isFastResolved = (l) => getLogExecutionTier(l) === 'fast';
  const isSmartResolved = (l) => getLogExecutionTier(l) === 'smart';

  const autoFast = autoLogs.filter(isFastResolved).length;
  const autoSmart = autoLogs.filter(isSmartResolved).length;
  const totalAuto = usage?.routed_volume ?? autoLogs.length;

  const effectiveFast = usage?.fast_executions ?? (directFast + autoFast);
  const effectiveSmart = usage?.smart_executions ?? (directSmart + autoSmart);
  const totalExecutions = effectiveFast + effectiveSmart + directOther || logs.length;
  const totalModelCalls = totalExecutions;

  const formatCalls = (n) => {
    if (!n) return '0 calls';
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M calls`;
    if (n >= 10000) return `${(n / 1000).toFixed(1)}k calls`;
    return `${n.toLocaleString()} calls`;
  };

  // Concrete foundation models aggregated dynamically from logs or demo distribution
  const concreteModelStats = useMemo(() => {
    if (isDemoToken && usage?.model_breakdown && Object.keys(usage.model_breakdown).length > 0) {
      return Object.entries(usage.model_breakdown).map(([model, calls]) => {
        let prov = 'openrouter';
        if (model.includes('/')) prov = model.split('/')[0];
        else if (model.startsWith('alpha')) prov = 'alpha';
        else if (model.startsWith('beta')) prov = 'beta';
        return {
          name: model,
          provider: prov,
          calls: calls,
          tokens: Math.round(calls * (avgTokensPerReq || 420)),
          cost: calls * 0.0002
        };
      }).sort((a, b) => b.calls - a.calls);
    }

    const map = {};
    logs.forEach(l => {
      const model = l.resolved_model || l.model || l.requested_model || 'unknown';
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
  }, [logs, isDemoToken, usage, avgTokensPerReq, fastModelName, smartModelName]);

  // Chart 2: Smart Router Arbitrage Efficiency
  const totalDiverted = totalAuto > 0 ? totalAuto : (effectiveFast + effectiveSmart);
  const fastPct = totalDiverted > 0
    ? Math.round(usage?.fast_ratio != null ? (usage.fast_ratio * 100) : (((totalAuto > 0 ? autoFast : effectiveFast) / totalDiverted) * 100))
    : 0;
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

  const avgCostPerMiss = cacheMisses > 0 ? (totalCost / cacheMisses) : (totalRequests > 0 ? (totalCost / totalRequests) : 0.000030);
  const cumulativeSaved = (usage?.saved_spend_usd != null && usage?.saved_spend_usd > 0)
    ? usage.saved_spend_usd
    : (cacheHits > 0 ? (cacheHits * avgCostPerMiss) : 0);

  // Real upstream provider health data
  const isHealthAvailable = !providerHealthError && providerHealth !== null;
  const allProviders = (isHealthAvailable && Array.isArray(providerHealth)) ? providerHealth : [];

  const sortedProviders = useMemo(() => {
    return [...allProviders].sort((a, b) => {
      const aIsBad = a.circuit_state === 'OPEN' || a.circuit_state === 'HALF_OPEN' || (a.failure_rate || 0) >= 10;
      const bIsBad = b.circuit_state === 'OPEN' || b.circuit_state === 'HALF_OPEN' || (b.failure_rate || 0) >= 10;
      if (aIsBad && !bIsBad) return -1;
      if (!aIsBad && bIsBad) return 1;

      const aCalls = (a.successful_calls || 0) + (a.failed_calls || 0);
      const bCalls = (b.successful_calls || 0) + (b.failed_calls || 0);
      if (bCalls !== aCalls) return bCalls - aCalls;

      return (a.provider || '').localeCompare(b.provider || '');
    });
  }, [allProviders]);

  const healthyCount = allProviders.filter(p => p.circuit_state === 'CLOSED' && (p.failure_rate || 0) < 10).length;
  const degradedCount = allProviders.filter(p => (p.failure_rate || 0) >= 10 || p.circuit_state === 'HALF_OPEN').length;
  const trippedCount = allProviders.filter(p => p.circuit_state === 'OPEN').length;
  const measuredProviders = allProviders.filter(p => p.p95_latency_ms != null && p.p95_latency_ms > 0);
  const globalAvgP95 = measuredProviders.length ? Math.round(measuredProviders.reduce((acc, p) => acc + p.p95_latency_ms, 0) / measuredProviders.length) : null;

  const overviewDisplayProviders = sortedProviders.slice(0, 4);

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

  // Cache breakdown metrics
  const tier1Hits = cacheStats?.tier1_exact_hits ?? logs.filter(l => l.cache_tier === 'tier1_exact').length;
  const tier2Hits = cacheStats?.tier2_semantic_hits ?? (cacheHits > tier1Hits ? (cacheHits - tier1Hits) : logs.filter(l => l.cache_tier === 'tier2_semantic').length);
  const totalCacheEvaluations = tier1Hits + tier2Hits + cacheMisses;
  const tier1Pct = totalCacheEvaluations > 0 ? Math.round((tier1Hits / totalCacheEvaluations) * 100) : 0;
  const tier2Pct = totalCacheEvaluations > 0 ? Math.round((tier2Hits / totalCacheEvaluations) * 100) : 0;
  const missPct = totalCacheEvaluations > 0 ? Math.max(0, 100 - tier1Pct - tier2Pct) : 0;

  const configuredThreshold = useMemo(() => {
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

      {/* Developer Sandbox Notice Banner */}
      {isDemoToken && (
        <SandboxNoticeBanner onOpenAdminModal={onOpenAdminModal} featureName="cluster telemetry and router efficiency" />
      )}

      {/* 1. Five Headline KPI Cards */}
      <OverviewKpis
        totalCost={totalCost}
        currency={currency}
        formatCurrency={formatCurrency}
        totalRequests={totalRequests}
        totalTokens={totalTokens}
        promptTokens={promptTokens}
        completionTokens={completionTokens}
        cacheHitRate={cacheHitRate}
        avgLatency={avgLatency}
        p50={p50}
        p90={p90}
        p99={p99}
      />

      {/* 2. Four Interactive Analytics Charts */}
      <OverviewCharts
        logs={logs}
        totalRequests={totalRequests}
        modelViewMode={modelViewMode}
        setModelViewMode={setModelViewMode}
        effectiveFast={effectiveFast}
        effectiveSmart={effectiveSmart}
        totalAuto={totalAuto}
        directFast={directFast}
        autoFast={autoFast}
        directSmart={directSmart}
        autoSmart={autoSmart}
        fastRate={fastRate}
        smartRate={smartRate}
        fastModelName={fastModelName}
        smartModelName={smartModelName}
        concreteModelStats={concreteModelStats}
        arbitrageSavingsPct={arbitrageSavingsPct}
        totalDiverted={totalDiverted}
        fastPct={fastPct}
        smartPct={smartPct}
        cacheHits={cacheHits}
        cacheMisses={cacheMisses}
        cacheHitRate={cacheHitRate}
        cacheTotal={cacheTotal}
        cumulativeSaved={cumulativeSaved}
        p50={p50}
        p90={p90}
        p99={p99}
        onOpenModal={(modalKey) => setSelectedChartModal(modalKey)}
        formatCalls={formatCalls}
        formatCurrency={formatCurrency}
      />

      {/* 3. Upstream Provider Health & Matrix Explorer */}
      <ProviderFleetSection
        allProviders={allProviders}
        healthyCount={healthyCount}
        degradedCount={degradedCount}
        trippedCount={trippedCount}
        globalAvgP95={globalAvgP95}
        isHealthAvailable={isHealthAvailable}
        overviewDisplayProviders={overviewDisplayProviders}
        onOpenPricingModal={() => setShowPricingModal(true)}
        onOpenFleetModal={() => setSelectedChartModal('providerHealth')}
      />

      {/* 4. Stream Delivery & Semantic Cache Widgets */}
      <DifferentiatorWidgets
        logs={logs}
        streamPct={streamPct}
        promptTokens={promptTokens}
        completionTokens={completionTokens}
        avgTokensPerReq={avgTokensPerReq}
        configuredThreshold={configuredThreshold}
        totalCacheEvaluations={totalCacheEvaluations}
        cacheHits={cacheHits}
        cacheMisses={cacheMisses}
        tier1Hits={tier1Hits}
        tier2Hits={tier2Hits}
        tier1Pct={tier1Pct}
        tier2Pct={tier2Pct}
        missPct={missPct}
      />

      {/* 5. Top Tenant Spend & Quota Leaderboard */}
      <TenantSpendLeaderboard
        keys={keys}
        onNavigate={onNavigate}
        formatCurrency={formatCurrency}
      />

      {/* 6. Model Pricing & Context Explorer Modal */}
      <PricingCatalogModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        pricing={pricing}
        fetchPricingCatalog={fetchPricingCatalog}
        isFetchingPricing={isFetchingPricing}
        currency={currency}
        formatCurrency={formatCurrency}
        getModelContextWindow={getModelContextWindow}
        getModelTierBadge={getModelTierBadge}
      />

      {/* 7. Provider Health Full Matrix Modal */}
      <ProviderFleetModal
        isOpen={selectedChartModal === 'providerHealth'}
        onClose={() => setSelectedChartModal(null)}
        allProviders={sortedProviders}
        healthyCount={healthyCount}
        degradedCount={degradedCount}
        trippedCount={trippedCount}
        globalAvgP95={globalAvgP95}
      />

      {/* 8. Expanded Detail Modals (Trends, Arbitrage, Cache, Latency, Stream, Semantic Guard) */}
      <OverviewDetailModals
        selectedChartModal={selectedChartModal}
        onClose={() => setSelectedChartModal(null)}
        modelStats={{
          fastModelName,
          smartModelName,
          fastRate,
          smartRate,
          effectiveFast,
          effectiveSmart,
          directFast,
          directSmart,
          autoFast,
          autoSmart,
          totalAuto,
          totalModelCalls,
          concreteModelStats
        }}
        arbitrageStats={{
          fastPct,
          smartPct,
          arbitrageSavingsPct
        }}
        cacheMetrics={{
          cacheHitRate,
          cacheHits,
          cacheMisses,
          cumulativeSaved
        }}
        latencyMetrics={{
          p50,
          p90,
          p99
        }}
        streamMetrics={{
          streamLogs,
          streamPct,
          promptTokens,
          completionTokens
        }}
        guardMetrics={{
          totalCacheEvaluations,
          cacheHits,
          cacheMisses,
          tier1Hits,
          tier2Hits,
          configuredThreshold,
          keys
        }}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
