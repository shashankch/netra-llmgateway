import React from 'react';
import NetraLogo from '../NetraLogo';
import { COMPARISON_ROWS } from '../../constants/landingContent';
import { 
  ExternalLink, Layers, Cpu, Globe, ShieldCheck, Database, 
  CheckCircle2, Zap, Gauge, Activity, Clock, Key 
} from 'lucide-react';

const ICON_MAP = {
  ShieldCheck,
  Database,
  CheckCircle2,
  Zap,
  Gauge,
  Cpu,
  Activity,
  Clock,
  Key
};

export default function LandingComparison() {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.1rem' }}>
        <div>
          <h3 id="comparison-table-heading" style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            Architecture &amp; Gateway Comparison
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
            Compare architectural guarantees between direct vendor APIs, public cloud aggregators, and NETRA private gateway.
          </p>
        </div>
        <a
          href="https://docs-netrallm.avadhanlabs.dev/comparison/"
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline btn-sm"
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
        >
          <span>Full Comparison Guide</span>
          <ExternalLink size={12} />
        </a>
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="comparison-table-heading"
        className="table-container comparison-table-container"
      >
        <table className="comparison-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '21%' }}>
                <div className="comparison-th-label">
                  <Layers size={14} style={{ color: 'var(--accent-lime)', flexShrink: 0 }} />
                  <span>Capability</span>
                </div>
              </th>
              <th scope="col" style={{ width: '23%' }}>
                <div className="comparison-th-label">
                  <Cpu size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>Raw Provider APIs</span>
                </div>
              </th>
              <th scope="col" style={{ width: '23%' }}>
                <div className="comparison-th-label">
                  <Globe size={14} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                  <span>Public Aggregators</span>
                </div>
              </th>
              <th scope="col" className="comparison-netra-col" style={{ width: '33%' }}>
                <div className="comparison-th-label">
                  <NetraLogo size={16} showText={false} />
                  <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>NETRA Enterprise Gateway</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row, idx) => {
              const IconComponent = ICON_MAP[row.iconName] || Layers;
              return (
                <tr key={idx}>
                  <th scope="row" className="comparison-capability-cell">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: row.accentBg,
                        border: `1px solid ${row.accentBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: row.accentColor,
                        flexShrink: 0
                      }}>
                        <IconComponent size={14} />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.35 }}>
                        {row.capability}
                      </span>
                    </div>
                  </th>
                  <td data-label="Raw Provider APIs">
                    <span className="comparison-cell-muted">
                      {row.rawApi}
                    </span>
                  </td>
                  <td data-label="Public Aggregators">
                    <span className="comparison-cell-muted">
                      {row.publicAggregator}
                    </span>
                  </td>
                  <td data-label="NETRA Enterprise Gateway" className="comparison-netra-cell">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <CheckCircle2
                        size={14}
                        style={{
                          color: 'var(--accent-emerald, #10b981)',
                          flexShrink: 0,
                          marginTop: '0.2rem'
                        }}
                      />
                      <span className="comparison-cell-netra">
                        {row.netra}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
