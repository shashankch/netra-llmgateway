import React from 'react';
import { ShieldCheck, Coins, Maximize2, Activity, Cpu } from 'lucide-react';

export default function ProviderFleetSection({
  allProviders = [],
  healthyCount = 0,
  degradedCount = 0,
  trippedCount = 0,
  globalAvgP95,
  isHealthAvailable = false,
  overviewDisplayProviders = [],
  onOpenPricingModal,
  onOpenFleetModal
}) {
  return (
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
            onClick={onOpenPricingModal}
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
            onClick={onOpenFleetModal}
            className="btn btn-secondary btn-sm"
            title="Expand Provider Health &amp; Routing Matrix"
            style={{ padding: '0.25rem 0.5rem', height: 28 }}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Fleet KPI Summary & Direct Link to Failover Matrix */}
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

        {/* Action Link to Full Matrix Modal */}
        <button
          onClick={onOpenFleetModal}
          className="btn btn-secondary btn-sm"
          style={{
            fontSize: '0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.65rem'
          }}
        >
          <Activity size={13} style={{ color: 'var(--accent-emerald)' }} />
          <span>View Full Fleet ({allProviders.length}) &rarr;</span>
        </button>
      </div>

      {/* Provider Grid */}
      <div style={{
        maxHeight: 380,
        overflowY: 'auto',
        paddingRight: overviewDisplayProviders.length > 4 ? 4 : 0
      }}>
        {overviewDisplayProviders.length === 0 ? (
          <div style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            background: 'var(--bg-canvas)',
            borderRadius: 8,
            border: '1px dashed var(--border-subtle)',
            margin: '0.5rem 0'
          }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              {!isHealthAvailable ? 'Provider Telemetry Offline' : 'No Providers Configured'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {!isHealthAvailable 
                ? 'Unable to connect to gateway health monitors. Ensure the gateway service is running and your admin credentials are configured.'
                : 'No upstream provider endpoints are currently registered in this environment.'}
            </div>
          </div>
        ) : overviewDisplayProviders.length === 1 ? (() => {
          const p = overviewDisplayProviders[0];
          const isClosed = p.circuit_state === 'CLOSED';
          const isOpen = p.circuit_state === 'OPEN';
          const isHalfOpen = p.circuit_state === 'HALF_OPEN';
          const stateBadgeColor = isClosed ? 'badge-success' : (isOpen ? 'badge-danger' : 'badge-warning');
          const stateDotColor = isClosed ? 'var(--accent-emerald)' : (isOpen ? 'var(--accent-rose)' : 'var(--accent-amber)');
          const failureRate = p.failure_rate || 0;
          const availabilityRate = Math.max(0, Math.min(100, 100 - failureRate)).toFixed(1);
          const totalCalls = (p.successful_calls ?? 0) + (p.failed_calls ?? 0);
          const formattedLatency = p.p95_latency_ms != null && p.p95_latency_ms > 0
            ? (p.p95_latency_ms >= 1000 ? `${(p.p95_latency_ms / 1000).toFixed(2)}s` : `${p.p95_latency_ms}ms`)
            : '—';
          const rawLatencyStr = p.p95_latency_ms != null && p.p95_latency_ms > 0 ? `${p.p95_latency_ms.toLocaleString()}ms` : null;

          return (
            <div
              style={{
                background: 'var(--bg-canvas)',
                border: `1px solid ${isOpen ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                borderRadius: 12,
                padding: '1.25rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--border-subtle)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-emerald)'
                  }}>
                    <Cpu size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                        {p.provider}
                      </span>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)'
                      }}>
                        Primary Upstream Egress
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Active inference gateway target • Automated circuit protection &amp; sub-millisecond failover
                    </div>
                  </div>
                </div>

                <span className={`badge ${stateBadgeColor}`} style={{
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  letterSpacing: '0.04em'
                }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: stateDotColor,
                    boxShadow: `0 0 6px ${stateDotColor}`
                  }} />
                  <span>
                    {isClosed ? 'CIRCUIT CLOSED (OPERATIONAL)' : (isOpen ? 'CIRCUIT TRIPPED (FAILOVER ACTIVE)' : 'CIRCUIT HALF-OPEN (PROBING)')}
                  </span>
                </span>
              </div>

              {/* 4-KPI Metric Rail */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.85rem'
              }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Availability
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
                    {availabilityRate}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {failureRate === 0 ? 'Zero service dropouts' : `${failureRate.toFixed(1)}% error rate`}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Failure Rate
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: failureRate > 20 ? 'var(--accent-rose)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
                    {failureRate.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Trip threshold &gt; 50%
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    p95 Latency
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
                    {formattedLatency}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {rawLatencyStr ? `Raw: ${rawLatencyStr}` : 'Awaiting traffic'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Execution Volume
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
                    {totalCalls} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>calls</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{p.successful_calls ?? 0} ok</span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: (p.failed_calls ?? 0) > 0 ? 'var(--accent-rose)' : 'var(--text-muted)', fontWeight: (p.failed_calls ?? 0) > 0 ? 600 : 400 }}>
                      {p.failed_calls ?? 0} err
                    </span>
                  </div>
                </div>
              </div>

              {/* Health Integrity & Circuit Protection Bar */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: '0.85rem 1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                    <ShieldCheck size={14} style={{ color: isClosed ? 'var(--accent-emerald)' : 'var(--accent-rose)' }} />
                    <span>Circuit Protection Engine:</span>
                    <strong style={{ color: isClosed ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {isOpen ? 'TRIPPED — Bypassing upstream' : (isHalfOpen ? 'HALF-OPEN — Probing recovery' : 'HEALTHY — Active pass-through')}
                    </strong>
                  </span>
                  <span className="font-mono" style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                    Health Index: <strong style={{ color: 'var(--accent-emerald)' }}>{availabilityRate}%</strong>
                  </span>
                </div>

                <div style={{ width: '100%', height: 6, background: 'var(--border-strong)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${availabilityRate}%`,
                      height: '100%',
                      background: isClosed ? 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)' : (isOpen ? 'var(--accent-rose)' : 'var(--accent-amber)'),
                      borderRadius: 3,
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <span>Failover Trip Rule: 5 consecutive upstream timeouts or 5xx faults</span>
                  <span>Probing Recovery Interval: 10 seconds</span>
                </div>
              </div>
            </div>
          );
        })() : (
          /* Multi-Provider Grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {overviewDisplayProviders.map(p => {
              const isClosed = p.circuit_state === 'CLOSED';
              const isOpen = p.circuit_state === 'OPEN';
              const stateBadgeColor = isClosed ? 'badge-success' : (isOpen ? 'badge-danger' : 'badge-warning');
              const stateDotColor = isClosed ? 'var(--accent-emerald)' : (isOpen ? 'var(--accent-rose)' : 'var(--accent-amber)');
              const failureRate = p.failure_rate || 0;
              const availabilityRate = Math.max(0, Math.min(100, 100 - failureRate)).toFixed(1);
              const formattedLatency = p.p95_latency_ms != null && p.p95_latency_ms > 0
                ? (p.p95_latency_ms >= 1000 ? `${(p.p95_latency_ms / 1000).toFixed(2)}s` : `${p.p95_latency_ms}ms`)
                : '—';

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
                    gap: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: stateDotColor, boxShadow: `0 0 8px ${stateDotColor}` }} />
                      <span style={{ fontWeight: 700, fontSize: '0.9375rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{p.provider}</span>
                    </div>
                    <span className={`badge ${stateBadgeColor}`} style={{ fontSize: '0.65rem' }}>
                      {isClosed ? 'CLOSED (NORMAL)' : p.circuit_state}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 90px), 1fr))', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Availability</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                        {availabilityRate}%
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Failure</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: failureRate > 20 ? 'var(--accent-rose)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {failureRate.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>p95 Latency</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {formattedLatency}
                      </div>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 5, background: 'var(--border-strong)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${availabilityRate}%`,
                        height: '100%',
                        background: isClosed ? 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)' : (isOpen ? 'var(--accent-rose)' : 'var(--accent-amber)'),
                        borderRadius: 3
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>Protection: {isOpen ? 'Tripped' : 'Healthy'}</span>
                    <span>{p.successful_calls ?? 0} upstream ok · {p.failed_calls ?? 0} err</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span>
          {allProviders.length <= 4 
            ? `Showing all ${allProviders.length} configured upstream provider${allProviders.length === 1 ? '' : 's'}`
            : `Showing top 4 of ${allProviders.length} active providers (sorted by execution volume & priority)`
          }
        </span>
        <button 
          onClick={onOpenFleetModal} 
          style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.75rem', padding: 0, fontWeight: 600 }}
        >
          {allProviders.length > 4 ? `Search and inspect all ${allProviders.length} in expanded table \u2192` : 'View full metrics matrix \u2192'}
        </button>
      </div>
    </div>
  );
}
