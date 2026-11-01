import React from 'react';
import { useTheme } from '../context/ThemeContext';
import NetraLogo from './NetraLogo';
import { 
  Sun, Moon, Monitor, DollarSign, Activity, Terminal, Key, 
  Database, FileText, Sparkles, BookOpen, Github 
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { theme, themeMode, setThemeMode, systemTheme, currency, toggleCurrency, exchangeRate } = useTheme();

  const navItems = [
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'playground', label: 'Playground', icon: Terminal },
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'logs', label: 'Request Logs', icon: FileText },
    { id: 'cache', label: 'Vector Cache', icon: Database },
  ];

  return (
    <header style={{
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0.65rem 2rem',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        {/* Brand with Netra Aperture Logo */}
        <div 
          onClick={() => setActiveTab('landing')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: 'pointer' }}
          title="Return to Home"
        >
          <NetraLogo size={32} showText={true} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="badge badge-neutral font-mono" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>v0.6.0</span>
            <span className="pulse-indicator" title="Gateway Operational" />
          </div>
        </div>

        {/* Navigation Tabs (OpenRouter Minimalist Pill Tabs) */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'analytics' && activeTab === 'overview');
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`btn btn-sm ${isActive ? 'btn-secondary' : 'btn-outline'}`}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: 6,
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.8125rem',
                  borderColor: isActive ? 'var(--border-strong)' : 'transparent',
                  background: isActive ? 'var(--bg-card-hover)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={14} style={{ opacity: isActive ? 1 : 0.7 }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls: Docs, Creator Attribution, Currency & Theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Documentation Link */}
          <a
            href="https://shashankch.github.io/netra-llmgateway/"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
            style={{ fontWeight: 600, padding: '0.35rem 0.65rem' }}
            title="Open Documentation (Zensical)"
          >
            <BookOpen size={13} />
            <span>Docs</span>
          </a>

          {/* Creator Attribution Pill */}
          <a
            href="https://github.com/shashankch"
            target="_blank"
            rel="noreferrer"
            className="author-nav-badge"
            title="Crafted by Shashank Chandel"
          >
            <Github size={13} style={{ opacity: 0.8 }} />
            <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.72rem' }}>by</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>@shashankch</span>
          </a>

          {/* Single-Denomination Currency Toggle */}
          <button
            onClick={toggleCurrency}
            className="btn btn-secondary btn-sm font-mono"
            title={`Active Currency: ${currency} (1 USD = ${exchangeRate} INR)`}
            style={{ fontWeight: 700, padding: '0.35rem 0.65rem' }}
          >
            <DollarSign size={13} style={{ color: 'var(--accent-emerald)' }} />
            <span>{currency}</span>
          </button>

          {/* Tri-State Theme Switcher (OpenRouter Style: Light, Dark, System) */}
          <div className="theme-segmented-control" role="group" aria-label="Theme preference">
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`theme-segmented-btn ${themeMode === 'light' ? 'active' : ''}`}
              title="Light Mode"
              aria-label="Light mode"
              aria-pressed={themeMode === 'light'}
            >
              <Sun size={14} />
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`theme-segmented-btn ${themeMode === 'dark' ? 'active' : ''}`}
              title="Dark Mode"
              aria-label="Dark mode"
              aria-pressed={themeMode === 'dark'}
            >
              <Moon size={14} />
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('system')}
              className={`theme-segmented-btn ${themeMode === 'system' ? 'active' : ''}`}
              title={`System Default (${systemTheme === 'dark' ? 'Dark' : 'Light'})`}
              aria-label="System default theme"
              aria-pressed={themeMode === 'system'}
            >
              <Monitor size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
