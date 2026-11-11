import React from 'react';
import { CAPABILITY_CARDS } from '../../constants/landingContent';
import { Terminal, Key, Activity, FileText } from 'lucide-react';

const ICON_MAP = {
  Terminal,
  Key,
  Activity,
  FileText
};

export default function LandingCapabilities({ onNavigate }) {
  return (
    <div>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.85rem' }}>
        Explore Gateway Console &amp; Tools
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
        {CAPABILITY_CARDS.map(card => {
          const IconComponent = ICON_MAP[card.iconName] || Terminal;
          return (
            <div 
              key={card.tab}
              onClick={() => onNavigate(card.tab)}
              className="card card-hover" 
              style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.15s ease' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                  {card.title}
                </span>
                <IconComponent size={16} style={{ color: card.accentColor }} />
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {card.description}
              </p>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: card.accentColor, marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                {card.actionText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
