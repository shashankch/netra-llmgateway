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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            Architecture &amp; Gateway Comparison
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
            Compare architectural guarantees between direct vendor APIs, public cloud aggregators, and NETRA private gateway.
          </p>
        </div>
        <a
          href="https://docs-netrallm.avadhanlabs.dev/comparison/"
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline btn-sm"
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
        >
          <span>Full Comparison Guide</span>
          <ExternalLink size={12} />
        </a>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '22%', verticalAlign: 'middle' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Layers size={14} style={{ color: 'var(--accent-lime)' }} />
                  <span>CAPABILITY</span>
                </div>
              </th>
              <th style={{ width: '25%', verticalAlign: 'middle' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Cpu size={14} style={{ color: 'var(--text-muted)' }} />
                  <span>RAW PROVIDER APIS</span>
                </div>
              </th>
              <th style={{ width: '25%', verticalAlign: 'middle' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Globe size={14} style={{ color: 'var(--accent-cyan)' }} />
                  <span>PUBLIC AGGREGATORS</span>
                </div>
              </th>
              <th style={{ width: '28%', verticalAlign: 'middle' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <NetraLogo size={16} showText={false} />
                  <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>NETRA ENTERPRISE GATEWAY</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row, idx) => {
              const IconComponent = ICON_MAP[row.iconName] || Layers;
              return (
                <tr key={idx}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: row.accentBg,
                        border: `1px solid ${row.accentBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: row.accentColor,
                        flexShrink: 0
                      }}>
                        <IconComponent size={15} />
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {row.capability}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {row.rawApi}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {row.publicAggregator}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                      {row.netra}
                    </span>
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
