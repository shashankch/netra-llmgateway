import React from 'react';
import { Gauge, Sparkles } from 'lucide-react';

export default function DifferentiatorWidgets({
  logs = [],
  streamPct = 0,
  promptTokens = 0,
  completionTokens = 0,
  avgTokensPerReq = 0,
  configuredThreshold = 0.92,
  totalCacheEvaluations = 0,
  cacheHits = 0,
  cacheMisses = 0,
  tier1Hits = 0,
  tier2Hits = 0,
  tier1Pct = 0,
  tier2Pct = 0,
  missPct = 0
}) {
  return (
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
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth="3.6"
              />
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
  );
}
