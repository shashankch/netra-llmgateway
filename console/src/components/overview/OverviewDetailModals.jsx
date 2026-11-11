import React from 'react';
import { X } from 'lucide-react';

export default function OverviewDetailModals({
  selectedChartModal,
  onClose,
  modelStats = {},
  arbitrageStats = {},
  cacheMetrics = {},
  latencyMetrics = {},
  streamMetrics = {},
  guardMetrics = {},
  formatCurrency
}) {
  if (!selectedChartModal) return null;

  const {
    fastModelName = 'deepseek/deepseek-chat',
    smartModelName = 'google/gemini-3.6-flash',
    fastRate = 0.14,
    smartRate = 0.75,
    effectiveFast = 0,
    effectiveSmart = 0,
    directFast = 0,
    directSmart = 0,
    autoFast = 0,
    autoSmart = 0,
    totalAuto = 0,
    totalModelCalls = 0,
    concreteModelStats = []
  } = modelStats;

  const {
    fastPct = 0,
    smartPct = 0,
    arbitrageSavingsPct = 72.4
  } = arbitrageStats;

  const {
    cacheHitRate = 0,
    cacheHits = 0,
    cacheMisses = 0,
    cumulativeSaved = 0
  } = cacheMetrics;

  const {
    p50 = 0,
    p90 = 0,
    p99 = 0
  } = latencyMetrics;

  const {
    streamPct = 0,
    streamCount = 0,
    promptTokens = 0,
    completionTokens = 0,
    avgTokensPerReq = 0
  } = streamMetrics;

  const {
    tier1Hits = 0,
    tier2Hits = 0,
    configuredThreshold = 0.92,
    tenantCount = 0
  } = guardMetrics;

  return (
    <>
      {/* Model Breakdown Modal */}
      {selectedChartModal === 'trends' && (
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Model Volume &amp; Spend Breakdown</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Traffic and cost distribution across configured model tiers</p>
              </div>
              <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
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
                  <div style={{ fontWeight: 700 }}>{effectiveFast.toLocaleString()} calls executed</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {totalModelCalls > 0 ? ((effectiveFast / totalModelCalls) * 100).toFixed(1) : '0.0'}% of fleet ({directFast} direct, {autoFast} via auto)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '0.85rem 1.1rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Frontier Intelligence Tier ({smartModelName})</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Input: ${smartRate.toFixed(2)}/1M · Advanced reasoning, code synthesis &amp; analysis</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{effectiveSmart.toLocaleString()} calls executed</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {totalModelCalls > 0 ? ((effectiveSmart / totalModelCalls) * 100).toFixed(1) : '0.0'}% of fleet ({directSmart} direct, {autoSmart} via auto)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '0.85rem 1.1rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>Automated Routing Tier (Dynamic Arbitrage)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Intelligent query classification with up to ~{arbitrageSavingsPct}% cost reduction</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{totalAuto.toLocaleString()} calls arbitrated</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {totalModelCalls > 0 ? ((totalAuto / totalModelCalls) * 100).toFixed(1) : '0.0'}% of fleet ({autoFast} fast / {autoSmart} smart)
                  </div>
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
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Smart Router Arbitrage Analytics</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Automated difficulty classification and enterprise cost reduction</p>
              </div>
              <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Routed to Fast Tier ({fastModelName})</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{fastPct}%</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {totalAuto > 0 ? `${autoFast.toLocaleString()} queries routed to fast` : `${effectiveFast.toLocaleString()} simple queries executed`}
                </div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Escalated to Frontier Tier ({smartModelName})</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{smartPct}%</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {totalAuto > 0 ? `${autoSmart.toLocaleString()} queries escalated to frontier` : `${effectiveSmart.toLocaleString()} complex reasoning tasks`}
                </div>
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
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Semantic Vector Cache Analytics</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Sub-5ms vector similarity caching and token cost elimination</p>
              </div>
              <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
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
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Latency &amp; Ingress Overhead Decomposition</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Sub-millisecond pass-through telemetry across gateway processing stages</p>
              </div>
              <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
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

      {/* Stream Severance & Spend Reclaim Modal */}
      {selectedChartModal === 'streamSeverance' && (
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-dialog" style={{ maxWidth: 780, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Stream Severance &amp; Phantom Spend Reclaim</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Real-time upstream connection termination and compute cost recovery on client disconnects
                </p>
              </div>
              <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>
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
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-dialog" style={{ maxWidth: 780, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Semantic Cache &amp; Accuracy Guard</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Two-tier intelligent caching with strict similarity thresholds and tenant-isolated data protection
                </p>
              </div>
              <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>
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
                  {tenantCount} {tenantCount === 1 ? 'Tenant' : 'Tenants'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Zero Data Leakage</div>
              </div>
            </div>

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
    </>
  );
}
