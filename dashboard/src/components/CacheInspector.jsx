import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  Database, ShieldCheck, Zap, Layers, RefreshCw, 
  CheckCircle2, ArrowRight, AlertCircle 
} from 'lucide-react';
import Pagination from './Pagination';

export default function CacheInspector({ adminToken = 'netra-admin-demo' }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/admin/cache/stats', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to load cache stats", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [adminToken]);

  const totalEntries = stats?.total_entries || 0;
  const totalHits = stats?.total_hits || 0;
  const totalMisses = stats?.total_misses || 0;
  const hitRate = stats?.hit_rate ? (stats.hit_rate * 100).toFixed(1) : '0.0';

  const keyBreakdown = stats?.keys || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Semantic Cache
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Accelerate response times and eliminate token costs for frequent and repeated queries.
          </p>
        </div>
        <button onClick={fetchStats} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh Stats</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Cached Entries</span>
            <Database size={16} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="kpi-value">{totalEntries}</div>
          <div className="kpi-subtext">Stored completions ready for retrieval</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Cache Hits</span>
            <Zap size={16} style={{ color: 'var(--accent-emerald)' }} />
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-emerald)' }}>{totalHits}</div>
          <div className="kpi-subtext">$0 token cost completions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Cache Misses</span>
            <Layers size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="kpi-value">{totalMisses}</div>
          <div className="kpi-subtext">Routed to upstream LLMs</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Global Hit Rate</span>
            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Active</span>
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>{hitRate}%</div>
          <div className="kpi-subtext">Semantic query matches</div>
        </div>
      </div>

      {/* Per-Key Cache Breakdown Table */}
      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Per-Key Cache Breakdown</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Cache storage is isolated per virtual key. Keys only access their own cached completions.
          </p>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Virtual Key</th>
                <th>Threshold</th>
                <th>Cached Entries</th>
                <th>Hits</th>
                <th>Misses</th>
                <th>Tenant Hit Rate</th>
                <th>Isolation</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(keyBreakdown).length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No cache activity recorded yet for active virtual keys.
                  </td>
                </tr>
              ) : (
                Object.entries(keyBreakdown).slice((page - 1) * pageSize, page * pageSize).map(([keyName, keyStat]) => {
                  const rate = (keyStat.hit_rate * 100).toFixed(1);
                  return (
                    <tr key={keyName}>
                      <td>
                        <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                          {keyName}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-neutral font-mono">
                          {keyName.includes('search') ? '0.920' : (keyName.includes('free') ? '0.850' : 'N/A')}
                        </span>
                      </td>
                      <td className="font-mono">{keyStat.entries}</td>
                      <td className="font-mono" style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{keyStat.hits}</td>
                      <td className="font-mono">{keyStat.misses}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700 }}>{rate}%</span>
                          <div style={{ width: 60, height: 4, background: 'var(--border-strong)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${rate}%`, height: '100%', background: 'var(--accent-emerald)' }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          <ShieldCheck size={12} />
                          <span>Isolated</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {Object.keys(keyBreakdown).length > 0 && (
          <Pagination
            totalItems={Object.keys(keyBreakdown).length}
            pageSize={pageSize}
            currentPage={page}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20]}
          />
        )}
      </div>

      {/* Key Benefits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Zap size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>Instant Semantic Matching</span>
          </h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Answers repeated and paraphrased prompts in sub-5ms without sending queries to upstream providers, saving 100% of token costs on cached responses.
          </p>
        </div>

        <div className="card">
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Database size={16} style={{ color: 'var(--accent-primary)' }} />
            <span>Smart Paraphrase Detection</span>
          </h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Understands intent beyond exact keywords, matching semantically identical prompts while preserving conversation context across multi-turn sessions.
          </p>
        </div>

        <div className="card">
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ShieldCheck size={16} style={{ color: 'var(--accent-emerald)' }} />
            <span>Safety Guardrails &amp; Clean Streaming</span>
          </h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Automatically excludes transient errors and refusal responses from cache storage, and replays valid cached responses with instant streaming token delivery.
          </p>
        </div>
      </div>
    </div>
  );
}

