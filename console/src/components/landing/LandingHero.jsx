import React from 'react';
import NetraLogo from '../NetraLogo';
import { HERO_STATS } from '../../constants/landingContent';
import { 
  Github, BookOpen, Sparkles, Key, Terminal 
} from 'lucide-react';

export default function LandingHero({ 
  onNavigate, 
  onOpenAdminModal, 
  statusBadge 
}) {
  return (
    <div className="hero-banner-container" style={{ margin: '0.5rem 0 1rem' }}>
      {/* Top Window Bar */}
      <div className="hero-tab-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-lime)' }} />
          <span>NETRA ENTERPRISE GATEWAY</span>
        </div>
        <span 
          onClick={onOpenAdminModal}
          className={statusBadge.className} 
          style={{ 
            fontSize: '0.625rem',
            cursor: onOpenAdminModal ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
            ...(statusBadge.style || {})
          }}
          title={statusBadge.title}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* Hero Body */}
      <div className="hero-banner-body" style={{ padding: '2.75rem 2rem 2.25rem' }}>
        {/* Centerpiece Logo & Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <NetraLogo size={52} showText={true} />
        </div>

        {/* Primary Tagline */}
        <h1 className="hero-tagline" style={{ margin: 0, maxWidth: 840, fontSize: '1.85rem' }}>
          The Unified Intelligent Interface for LLMs
        </h1>

        {/* Subtitle */}
        <p className="hero-subtext" style={{ margin: 0 }}>
          Route dynamically across frontier models, eliminate redundant token spend with sub-5ms caching, and ensure zero-downtime inference with one drop-in OpenAI-compatible API.
        </p>

        {/* Repository & Attribution Links */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.8125rem' }}>
          <a 
            href="https://github.com/shashankch/netra-llmgateway" 
            target="_blank" 
            rel="noreferrer" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            <Github size={14} />
            <span>shashankch/netra-llmgateway</span>
          </a>
          <a 
            href="https://docs-netrallm.avadhanlabs.dev/" 
            target="_blank" 
            rel="noreferrer" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            <BookOpen size={14} />
            <span>Documentation</span>
          </a>
          <a 
            href="https://github.com/shashankch" 
            target="_blank" 
            rel="noreferrer" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-lime)' }} />
            <span>Crafted by <strong>Shashank Chandel</strong></span>
          </a>
        </div>

        {/* Headline Metric Cards */}
        <div className="hero-stats-grid" style={{ marginTop: '0.75rem' }}>
          {HERO_STATS.map(stat => (
            <div key={stat.id} className="hero-stat-card">
              <div 
                className="hero-stat-number" 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'baseline', 
                  gap: '0.2rem', 
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)'
                }}
              >
                <span>{stat.number}</span>
                {stat.highlight && (
                  <span style={{ color: stat.highlightColor || 'var(--accent-lime)' }}>
                    {stat.highlight}
                  </span>
                )}
              </div>
              <div className="hero-stat-label">{stat.label}</div>
              <div className="hero-stat-desc">{stat.desc}</div>
            </div>
          ))}
        </div>

        {/* Action CTAs & Endpoint Info */}
        <div className="hero-pill-bar" style={{ marginTop: '1.25rem' }}>
          <a 
            href="https://docs-netrallm.avadhanlabs.dev/" 
            target="_blank" 
            rel="noreferrer" 
            className="pill-link" 
            style={{ textDecoration: 'none' }}
          >
            <span className="pill-link-tag">DOCS</span>
            <span className="pill-link-val">docs-netrallm.avadhanlabs.dev</span>
          </a>

          <div className="pill-link">
            <span className="pill-link-tag">API</span>
            <span className="pill-link-val">/v1/chat/completions</span>
          </div>

          <button 
            onClick={() => onNavigate('keys')} 
            className="btn btn-cyan"
            style={{ 
              fontSize: '0.8125rem', 
              padding: '0.5rem 1.25rem', 
              borderRadius: 9999, 
              fontWeight: 700, 
              letterSpacing: '0.03em', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.45rem',
              boxShadow: '0 0 16px var(--accent-cyan-subtle)'
            }}
          >
            <Key size={14} />
            <span>GET API KEY</span>
          </button>
          <button 
            onClick={() => onNavigate('playground')} 
            className="btn btn-primary"
            style={{ 
              fontSize: '0.8125rem', 
              padding: '0.5rem 1.25rem', 
              borderRadius: 9999, 
              fontWeight: 700, 
              letterSpacing: '0.03em', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.45rem',
              boxShadow: '0 0 16px var(--accent-primary-subtle)'
            }}
          >
            <Terminal size={14} />
            <span>EVALUATE IN PLAYGROUND</span>
          </button>
        </div>
      </div>
    </div>
  );
}
