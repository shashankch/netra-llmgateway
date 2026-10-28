import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  Sun, Moon, DollarSign, Activity, Terminal, Key, 
  Database, FileText, ShieldCheck, Sparkles 
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { theme, toggleTheme, currency, toggleCurrency, exchangeRate } = useTheme();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'playground', label: 'Playground', icon: Terminal },
    { id: 'keys', label: 'Virtual Keys', icon: Key },
    { id: 'logs', label: 'Live Logs', icon: FileText },
    { id: 'cache', label: 'Semantic Cache', icon: Database },
    { id: 'landing', label: 'About', icon: Sparkles },
  ];

  return (
    <header style={{
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0.75rem 2rem',
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
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-cyan) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1rem'
          }}>
            N
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>NETRA</span>
              <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>v0.6.0</span>
              <span className="pulse-indicator" title="Gateway Operational" />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AI-First LLM Gateway & Ops Console</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: 6,
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls: Currency & Theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Currency Toggle */}
          <button
            onClick={toggleCurrency}
            className="btn btn-secondary btn-sm"
            title={`Active: ${currency} (1 USD = ${exchangeRate} INR)`}
            style={{ fontWeight: 600, padding: '0.35rem 0.65rem' }}
          >
            <DollarSign size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span>{currency}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary btn-sm"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ padding: '0.35rem 0.6rem' }}
          >
            {theme === 'dark' ? (
              <Sun size={15} style={{ color: 'var(--accent-amber)' }} />
            ) : (
              <Moon size={15} style={{ color: 'var(--accent-primary)' }} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
