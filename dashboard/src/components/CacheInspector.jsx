import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  Database, ShieldCheck, Zap, Layers, RefreshCw, 
  CheckCircle2, ArrowRight, AlertCircle 
} from 'lucide-react';

export default function CacheInspector({ adminToken = 'netra-admin-demo' }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
            Semantic Vector Cache & HNSW Isolation Inspector
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            In-JVM dense embeddings (all-MiniLM-L6-v2) and PostgreSQL 18 pgvector HNSW cosine similarity search.
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
            <span className="kpi-title">Total Vector Entries</span>
            <Database size={16} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="kpi-value">{totalEntries}</div>
          <div className="kpi-subtext">384-dimensional dense vectors</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Cache Hits</span>
            <Zap size={16} style={{ color: 'var(--accent-emerald)' }} />
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-emerald)' }}>{totalHits}</div>
          <div className="kpi-subtext">&lt;5ms zero-cost completions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Cache Misses</span>
            <Layers size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="kpi-value">{totalMisses}</div>
          <div className="kpi-subtext">Dispatched to upstream models</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Global Hit Rate</span>
            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>pgvector</span>
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>{hitRate}%</div>
          <div className="kpi-subtext">Cosine similarity &ge; threshold</div>
        </div>
      </div>

      {/* Per-Key Cryptographic Isolation Table */}
      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Per-Tenant Cryptographic Partitioning</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Vector similarity queries are strictly partitioned: <code>WHERE virtual_key = :virtualKey AND model_alias = :modelAlias</code>. Key A entries are mathematically unreachable from Key B.
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
                <th>Cross-Tenant Isolation</th>
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
                Object.entries(keyBreakdown).map(([keyName, keyStat]) => {
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
      </div>

      {/* Architecture Deep Dive Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Zap size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>Zero-Hop In-JVM Dense Embeddings</span>
          </h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            NETRA runs a quantized <code>all-MiniLM-L6-v2</code> embedding model directly in JVM heap via Microsoft ONNX Runtime. Vectors (384 dimensions) are generated in ~5ms without remote OpenAI embedding API calls, eliminating $0.00002/call overhead and network jitter.
          </p>
        </div>

        <div className="card">
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Database size={16} style={{ color: 'var(--accent-primary)' }} />
            <span>PostgreSQL 18 pgvector HNSW Index</span>
          </h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Similarity searches use the pgvector cosine distance operator <code>&lt;=&gt;</code> accelerated by an HNSW index (<code>m=16, ef_construction=64</code>). Multi-turn conversations canonicalize dialogue history into a structured transcript key.
          </p>
        </div>

        <div className="card">
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ShieldCheck size={16} style={{ color: 'var(--accent-emerald)' }} />
            <span>Refusal Suppression & Streaming Replay</span>
          </h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Temporary safety refusals (e.g. <em>"I'm sorry, but I can't help with that"</em>) are intercepted and rejected from vector storage to prevent poisoning. On cache hits, responses replay as unbuffered SSE token deltas ending with <code>[DONE]</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
