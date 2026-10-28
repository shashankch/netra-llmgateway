import React from 'react';
import { 
  Zap, Database, ShieldCheck, Cpu, Terminal, 
  ArrowRight, CheckCircle2, Copy, Sparkles, Layers, DollarSign 
} from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  const curlExample = `curl -X POST http://localhost:8080/v1/chat/completions \\
  -H "Authorization: Bearer netra-sk-search-1a2b3c" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "fast",
    "messages": [{"role": "user", "content": "What is a load balancer?"}]
  }'`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(curlExample);
    alert("Copied curl quickstart to clipboard!");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', padding: '1rem 0' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', maxWidth: 850, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.85rem',
          borderRadius: 9999,
          background: 'var(--accent-primary-subtle)',
          color: 'var(--accent-primary)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          border: '1px solid rgba(99, 102, 241, 0.3)'
        }}>
          <Sparkles size={14} />
          <span>Apache 2.0 Open-Core Enterprise LLM Gateway</span>
        </div>

        <h1 style={{ fontSize: '2.75rem', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.03em' }}>
          Zero Over-Admission. <br />
          <span style={{
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-cyan) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            In-JVM Semantic Cache.
          </span> <br />
          Java 25 Virtual Threads.
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', lineHeight: 1.6, maxWidth: 650 }}>
          NETRA is a high-performance, drop-in OpenAI-compatible AI gateway and telemetry suite designed for modern multi-tenant AI pipelines and autonomous agents.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <button onClick={() => onNavigate('playground')} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
            <span>Open Playground & Sandbox</span>
            <ArrowRight size={18} />
          </button>
          <button onClick={() => onNavigate('overview')} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
            <span>Live Telemetry Dashboard</span>
          </button>
        </div>
      </div>

      {/* Feature Highlight Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-primary-subtle)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Zap size={22} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Atomic Zero Over-Admission</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Eliminates read-then-write admission races. Redis 8.0 Lua transactions evaluate sliding-window RPM and USD spend in a single atomic memory step. Concurrency drill: 0.00% over-admissions.
          </p>
        </div>

        <div className="card">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-emerald-subtle)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Database size={22} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>In-JVM Semantic Vector Cache</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Embeds <code>all-MiniLM-L6-v2</code> directly into JVM memory via ONNX Runtime with PostgreSQL 18 pgvector HNSW indexing. Replays &lt;5ms completions over SSE without incurring provider fees.
          </p>
        </div>

        <div className="card">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-cyan)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Cpu size={22} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Intelligent Arbitrage Routing</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Two-stage hybrid router dynamically evaluates prompt difficulty and instruction extraction. Cheap queries divert to fast models; complex derivations route to frontier models, cutting costs by ~72%.
          </p>
        </div>

        <div className="card">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-amber-subtle)', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <DollarSign size={22} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Dynamic Real-Time Forex</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Database stores strict base USD ledgers while dynamic Forex service fetches live USD/INR exchange rates. Single-denomination UI toggle flips all metrics without cluttering dual currency text.
          </p>
        </div>
      </div>

      {/* Quickstart Code Block */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Quickstart: Drop-in OpenAI Compatible API</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Just swap base URL and virtual key — zero client SDK changes needed</p>
          </div>
          <button onClick={copyToClipboard} className="btn btn-outline btn-sm">
            <Copy size={13} />
            <span>Copy cURL</span>
          </button>
        </div>

        <pre style={{
          background: 'var(--bg-canvas)',
          padding: '1rem',
          borderRadius: 8,
          fontSize: '0.8125rem',
          overflowX: 'auto',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-code)'
        }}>
          {curlExample}
        </pre>
      </div>

      {/* Feature Comparison Matrix */}
      <div className="card">
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem' }}>Architecture Invariants & Guarantees</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Capability</th>
                <th>Standard Reverse Proxy</th>
                <th>Raw Cloud APIs</th>
                <th>NETRA LLM Gateway</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Rate Limiting</td>
                <td>Leaky bucket / race-prone</td>
                <td>Black-box 429 throttling</td>
                <td><strong style={{ color: 'var(--accent-emerald)' }}>Atomic Redis Lua (0.00% Over-Admission)</strong></td>
              </tr>
              <tr>
                <td>Semantic Vector Cache</td>
                <td>None / exact hash only</td>
                <td>Prompt caching (costly)</td>
                <td><strong style={{ color: 'var(--accent-emerald)' }}>In-JVM ONNX + pgvector HNSW (&lt;5ms)</strong></td>
              </tr>
              <tr>
                <td>Concurrency Model</td>
                <td>Async epoll or OS threads</td>
                <td>N/A</td>
                <td><strong style={{ color: 'var(--accent-emerald)' }}>Java 25 Virtual Threads</strong></td>
              </tr>
              <tr>
                <td>Financial Accounting</td>
                <td>Rough token estimation</td>
                <td>Delayed monthly invoice</td>
                <td><strong style={{ color: 'var(--accent-emerald)' }}>Micro-USD BigDecimal (6 decimals)</strong></td>
              </tr>
              <tr>
                <td>Provider Failover</td>
                <td>Blind retry / client loop</td>
                <td>Manual fallback in code</td>
                <td><strong style={{ color: 'var(--accent-emerald)' }}>Sub-50ms Synchronous Zero-Glitch Failover</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
