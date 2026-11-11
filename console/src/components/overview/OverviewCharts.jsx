import React from 'react';
import { BarChart2, PieChart, Database, Clock } from 'lucide-react';

export default function OverviewCharts({
  logs = [],
  modelViewMode = 'alias',
  setModelViewMode,
  effectiveFast = 0,
  effectiveSmart = 0,
  totalAuto = 0,
  directFast = 0,
  autoFast = 0,
  directSmart = 0,
  autoSmart = 0,
  fastRate = 0.14,
  smartRate = 0.75,
  fastModelName = 'deepseek/deepseek-chat',
  smartModelName = 'google/gemini-3.6-flash',
  concreteModelStats = [],
  arbitrageSavingsPct = '72.4',
  totalDiverted = 0,
  fastPct = 0,
  smartPct = 0,
  cacheHits = 0,
  cacheMisses = 0,
  cacheHitRate = '0.0',
  cacheTotal = 0,
  cumulativeSaved = 0,
  p50 = 0,
  p90 = 0,
  p99 = 0,
  onOpenModal,
  formatCalls = (n) => n?.toLocaleString() || '0 calls',
  formatCurrency = (n) => `$${Number(n || 0).toFixed(6)}`
}) {
  return (
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
          /* Stacked Tier Execution Bar Chart */
          (() => {
            const maxTierVolume = Math.max(effectiveFast, effectiveSmart, totalAuto, 1);
            const chartHeightPx = 130;
            const fastHeight = Math.max(16, Math.round((effectiveFast / maxTierVolume) * chartHeightPx));
            const smartHeight = Math.max(16, Math.round((effectiveSmart / maxTierVolume) * chartHeightPx));
            const autoHeight = Math.max(16, Math.round((totalAuto / maxTierVolume) * chartHeightPx));

            // Fast stacked percentages (direct on bottom, auto on top)
            const fastDirectPct = effectiveFast > 0 ? Math.round((directFast / effectiveFast) * 100) : 0;
            const fastAutoPct = effectiveFast > 0 ? (100 - fastDirectPct) : 0;

            // Smart stacked percentages (direct on bottom, auto on top)
            const smartDirectPct = effectiveSmart > 0 ? Math.round((directSmart / effectiveSmart) * 100) : 0;
            const smartAutoPct = effectiveSmart > 0 ? (100 - smartDirectPct) : 0;

            // Auto router split percentages (fast share on bottom, smart share on top)
            const autoFastPct = totalAuto > 0 ? Math.round((autoFast / totalAuto) * 100) : 50;
            const autoSmartPct = totalAuto > 0 ? (100 - autoFastPct) : 50;

            return (
              <div style={{
                height: 180,
                display: 'flex',
                alignItems: 'flex-end',
                gap: '1.75rem',
                padding: '1rem 2rem 0.75rem 2rem',
                background: 'var(--bg-canvas)',
                borderRadius: 8,
                position: 'relative'
              }}>
                {/* Fast Tier Pillar */}
                <div
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', height: '100%', justifyContent: 'flex-end' }}
                  title={`Fast Tier: ${effectiveFast} total executed (${directFast} direct, ${autoFast} auto-routed)`}
                >
                  <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {formatCalls(effectiveFast)}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: autoFast > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                      {autoFast > 0 ? `${autoFast} via auto` : (directFast > 0 ? 'direct' : 'idle')}
                    </div>
                  </div>

                  <div style={{
                    width: '100%',
                    height: `${fastHeight}px`,
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    borderRadius: '6px 6px 0 0',
                    overflow: 'hidden',
                    transition: 'height 0.3s ease',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    boxShadow: effectiveFast > 0 ? '0 0 12px rgba(6, 182, 212, 0.15)' : 'none',
                    background: 'rgba(6, 182, 212, 0.05)'
                  }}>
                    {/* Direct Fast Base Segment */}
                    {directFast > 0 && (
                      <div style={{
                        height: `${fastDirectPct}%`,
                        background: 'linear-gradient(180deg, rgba(6,182,212,0.95) 0%, rgba(6,182,212,0.7) 100%)',
                        transition: 'height 0.3s ease'
                      }} />
                    )}
                    {/* Auto-Routed Fast Segment */}
                    {autoFast > 0 && (
                      <div style={{
                        height: `${fastAutoPct}%`,
                        background: 'linear-gradient(180deg, #22d3ee 0%, rgba(16, 185, 129, 0.85) 100%)',
                        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 6px, transparent 6px, transparent 12px)',
                        transition: 'height 0.3s ease'
                      }} />
                    )}
                    {effectiveFast === 0 && (
                      <div style={{ height: '100%', background: 'rgba(6,182,212,0.15)' }} />
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>fast</div>
                </div>

                {/* Smart Tier Pillar */}
                <div
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', height: '100%', justifyContent: 'flex-end' }}
                  title={`Smart Tier: ${effectiveSmart} total executed (${directSmart} direct, ${autoSmart} auto-routed)`}
                >
                  <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {formatCalls(effectiveSmart)}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: autoSmart > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                      {autoSmart > 0 ? `${autoSmart} via auto` : (directSmart > 0 ? 'direct' : 'idle')}
                    </div>
                  </div>

                  <div style={{
                    width: '100%',
                    height: `${smartHeight}px`,
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    borderRadius: '6px 6px 0 0',
                    overflow: 'hidden',
                    transition: 'height 0.3s ease',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    boxShadow: effectiveSmart > 0 ? '0 0 12px rgba(99, 102, 241, 0.15)' : 'none',
                    background: 'rgba(99, 102, 241, 0.05)'
                  }}>
                    {/* Direct Smart Base Segment */}
                    {directSmart > 0 && (
                      <div style={{
                        height: `${smartDirectPct}%`,
                        background: 'linear-gradient(180deg, rgba(99,102,241,0.95) 0%, rgba(99,102,241,0.7) 100%)',
                        transition: 'height 0.3s ease'
                      }} />
                    )}
                    {/* Auto-Routed Smart Segment */}
                    {autoSmart > 0 && (
                      <div style={{
                        height: `${smartAutoPct}%`,
                        background: 'linear-gradient(180deg, #a5b4fc 0%, rgba(99, 102, 241, 0.85) 100%)',
                        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 6px, transparent 6px, transparent 12px)',
                        transition: 'height 0.3s ease'
                      }} />
                    )}
                    {effectiveSmart === 0 && (
                      <div style={{ height: '100%', background: 'rgba(99,102,241,0.15)' }} />
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)' }}>smart</div>
                </div>

                {/* Auto Classifier Hub Pillar (Dual-Split Routing Visualizer) */}
                <div
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', height: '100%', justifyContent: 'flex-end' }}
                  title={`Adaptive Auto Router: ${totalAuto} total queries evaluated (${autoFast} routed to fast [${autoFastPct}%], ${autoSmart} routed to smart [${autoSmartPct}%])`}
                >
                  <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {formatCalls(totalAuto)}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: totalAuto > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {totalAuto > 0 ? `${autoFast}F · ${autoSmart}S` : '0 routed'}
                    </div>
                  </div>

                  <div style={{
                    width: '100%',
                    height: `${autoHeight}px`,
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    borderRadius: '6px 6px 0 0',
                    overflow: 'hidden',
                    transition: 'height 0.3s ease',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    boxShadow: totalAuto > 0 ? '0 0 12px rgba(16, 185, 129, 0.15)' : 'none',
                    background: 'rgba(16, 185, 129, 0.05)'
                  }}>
                    {totalAuto > 0 ? (
                      <>
                        {/* Fast Route Portion */}
                        <div style={{
                          height: `${autoFastPct}%`,
                          background: 'linear-gradient(180deg, rgba(6,182,212,0.85) 0%, rgba(16,185,129,0.7) 100%)',
                          transition: 'height 0.3s ease'
                        }} />
                        {/* Smart Route Portion */}
                        <div style={{
                          height: `${autoSmartPct}%`,
                          background: 'linear-gradient(180deg, rgba(99,102,241,0.85) 0%, rgba(16,185,129,0.8) 100%)',
                          transition: 'height 0.3s ease'
                        }} />
                      </>
                    ) : (
                      <div style={{ height: '100%', background: 'rgba(16,185,129,0.15)' }} />
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>auto</div>
                </div>
              </div>
            );
          })()
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
            {concreteModelStats.length > 4 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', paddingTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <span>Showing top 4 of {concreteModelStats.length} models (sorted by usage)</span>
                <button
                  onClick={() => onOpenModal && onOpenModal('trends')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, padding: 0 }}
                >
                  View all in expanded table &rarr;
                </button>
              </div>
            )}
          </div>
        )}

        {/* Polished Tier & Pricing Legend Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
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
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.6875rem',
              marginTop: '0.15rem',
              paddingTop: '0.25rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatCalls(effectiveFast)}</span>
              {autoFast > 0 ? (
                <span style={{ color: 'var(--accent-cyan)', fontSize: '0.625rem', fontWeight: 600 }}>{autoFast} via auto</span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>{directFast > 0 ? `${directFast} direct` : '0 calls'}</span>
              )}
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
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.6875rem',
              marginTop: '0.15rem',
              paddingTop: '0.25rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatCalls(effectiveSmart)}</span>
              {autoSmart > 0 ? (
                <span style={{ color: 'var(--accent-primary)', fontSize: '0.625rem', fontWeight: 600 }}>{autoSmart} via auto</span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>{directSmart > 0 ? `${directSmart} direct` : '0 calls'}</span>
              )}
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
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.6875rem',
              marginTop: '0.15rem',
              paddingTop: '0.25rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatCalls(totalAuto)}</span>
              {totalAuto > 0 ? (
                <span style={{ color: 'var(--accent-emerald)', fontSize: '0.625rem', fontWeight: 600 }}>{autoFast}F · {autoSmart}S</span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>0 routed</span>
              )}
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
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
                {totalAuto} calls
              </span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {logs.length > 0 ? Math.round((totalAuto / logs.length) * 100) : 0}% of fleet traffic
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
              {totalAuto > 0 ? `${autoFast} auto-routed to fast` : `${effectiveFast} total fast executions`}
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
              {totalAuto > 0 ? `${autoSmart} escalated to frontier` : `${effectiveSmart} total smart executions`}
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
  );
}
