import React from 'react';
import { Key, ArrowUpRight } from 'lucide-react';

export default function TenantSpendLeaderboard({
  keys = [],
  onNavigate,
  formatCurrency
}) {
  return (
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
              const rawPct = budget > 0 ? (spend / budget) * 100 : 0;
              const displayPct = rawPct > 0 && rawPct < 1 ? '<1%' : `${Math.min(100, Math.round(rawPct))}%`;
              const visualBarWidth = spend > 0 ? Math.max(2, Math.min(100, rawPct)) : 0;
              const barColor = rawPct > 90 ? 'var(--accent-rose)' : (rawPct > 70 ? 'var(--accent-amber)' : 'var(--accent-emerald)');
              const badgeColorClass = rawPct > 90 ? 'badge-danger' : (rawPct > 70 ? 'badge-warning' : 'badge-neutral');

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
                        {displayPct}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${visualBarWidth}%`,
                      height: '100%',
                      background: barColor,
                      borderRadius: 3,
                      transition: 'width 0.3s ease',
                      boxShadow: `0 0 6px ${barColor}`
                    }} />
                  </div>

                  {/* Bottom Metadata Badges */}
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
  );
}
