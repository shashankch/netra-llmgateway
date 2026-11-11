import React from 'react';
import { Zap, Layers, Database, Clock } from 'lucide-react';

export default function OverviewKpis({
  totalCost,
  currency,
  formatCurrency,
  totalRequests,
  totalTokens,
  promptTokens,
  completionTokens,
  cacheHitRate,
  avgLatency,
  p50,
  p90,
  p99
}) {
  return (
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
  );
}
