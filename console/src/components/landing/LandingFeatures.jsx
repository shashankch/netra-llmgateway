import React from 'react';
import { WHY_NETRA_FEATURES } from '../../constants/landingContent';
import { 
  Network, Cpu, Database, Gauge, Zap, 
  CheckCircle2, Activity, Layers, ShieldCheck, Sparkles 
} from 'lucide-react';

const ICON_MAP = {
  Network,
  Cpu,
  Database,
  Gauge,
  Zap,
  CheckCircle2,
  Activity,
  Layers,
  ShieldCheck
};

export default function LandingFeatures() {
  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--accent-primary-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-lime)'
            }}>
              <Sparkles size={18} />
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)' }}>
              Why NETRA?
            </h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.35rem 0 0' }}>
            Enterprise infrastructure for reliable model routing, cost optimization, and multi-tenant AI governance.
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        gap: '1.25rem'
      }}>
        {WHY_NETRA_FEATURES.map(feature => {
          const IconComponent = ICON_MAP[feature.iconName] || Network;
          return (
            <div 
              key={feature.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: feature.accentBg,
                border: `1px solid ${feature.accentBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: feature.accentColor
              }}>
                <IconComponent size={18} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                {feature.title}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {feature.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
