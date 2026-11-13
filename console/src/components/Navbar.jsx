import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useGatewayHealth, CONSOLE_VERSION } from '../config/api';
import NetraLogo from './NetraLogo';
import AdminConfigModal from './AdminConfigModal';
import { 
  Sun, Moon, Monitor, DollarSign, Activity, Terminal, Key, 
  Database, FileText, Sparkles, BookOpen, ShieldCheck
} from 'lucide-react';

/**
 * Top navigation bar with environment indicator, routing tabs,
 * admin authentication trigger, and session customization controls.
 */
export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  adminToken, 
  onUpdateAdminToken,
  showAdminModal: externalShowAdminModal,
  setShowAdminModal: externalSetShowAdminModal
}) {
  const { theme, themeMode, setThemeMode, systemTheme, currency, toggleCurrency, exchangeRate } = useTheme();
  const [localShowAdminModal, setLocalShowAdminModal] = useState(false);
  const showAdminModal = externalShowAdminModal !== undefined ? externalShowAdminModal : localShowAdminModal;
  const setShowAdminModal = externalSetShowAdminModal || setLocalShowAdminModal;

  const isDemoToken = !adminToken || adminToken === 'netra-admin-demo';
  const healthState = useGatewayHealth();
  const { isOnline, isChecking, latencyMs, lastChecked } = healthState;

  const rawVersion = healthState?.version || CONSOLE_VERSION;
  const displayVersion = rawVersion ? (rawVersion.startsWith('v') ? rawVersion : `v${rawVersion}`) : `v${CONSOLE_VERSION}`;

  // Multi-Environment & Health Status Matrix for Navbar Indicators
  const getStatusDot = () => {
    if (isChecking || !lastChecked) {
      return {
        className: 'pulse-indicator checking',
        title: 'Probing Gateway health endpoint...',
      };
    }
    if (isDemoToken) {
      if (isOnline) {
        return {
          className: 'pulse-indicator sandbox-online',
          title: `Developer Sandbox Connected (ONLINE${latencyMs ? ` · ${latencyMs}ms` : ''})`,
        };
      }
      return {
        className: 'pulse-indicator sandbox-offline',
        title: 'Developer Sandbox Offline / Mock Mode (Backend Disconnected) — Click to configure Gateway URL',
      };
    }
    // Production Token Mode
    if (isOnline) {
      return {
        className: 'pulse-indicator prod-online',
        title: `Production Gateway Operational (ONLINE${latencyMs ? ` · ${latencyMs}ms` : ''})`,
      };
    }
    return {
      className: 'pulse-indicator prod-offline',
      title: 'Production Gateway Disconnected / Unreachable (CRITICAL OFFLINE) — Click to configure Gateway URL',
    };
  };

  const getAdminKeyBtnInfo = () => {
    if (isChecking || !lastChecked) {
      return {
        borderColor: 'rgba(6, 182, 212, 0.3)',
        background: 'rgba(6, 182, 212, 0.06)',
        iconColor: 'var(--accent-cyan)',
        badgeText: 'CONNECTING',
        badgeBg: 'rgba(6, 182, 212, 0.15)',
        badgeColor: 'var(--accent-cyan)',
        title: 'Connecting to Gateway health endpoint...',
      };
    }
    if (isDemoToken) {
      if (isOnline) {
        return {
          borderColor: 'rgba(245, 158, 11, 0.35)',
          background: 'rgba(245, 158, 11, 0.08)',
          iconColor: '#f59e0b',
          badgeText: 'DEMO · ONLINE',
          badgeBg: 'rgba(245, 158, 11, 0.18)',
          badgeColor: '#f59e0b',
          title: `Developer Sandbox Mode — Gateway Connected (${latencyMs ? `${latencyMs}ms` : 'Healthy'})`,
        };
      }
      return {
        borderColor: 'var(--border-subtle)',
        background: 'transparent',
        iconColor: '#d97706',
        badgeText: 'DEMO · OFFLINE',
        badgeBg: 'rgba(245, 158, 11, 0.12)',
        badgeColor: '#d97706',
        title: 'Developer Sandbox Mode — Gateway Disconnected (Mock Mode)',
      };
    }
    // Production Token Mode
    if (isOnline) {
      return {
        borderColor: 'var(--accent-emerald)',
        background: 'rgba(16, 185, 129, 0.08)',
        iconColor: 'var(--accent-emerald)',
        badgeText: 'PROD · LIVE',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeColor: '#059669',
        title: `Production Gateway Connected (${latencyMs ? `${latencyMs}ms` : 'Operational'})`,
      };
    }
    return {
      borderColor: 'rgba(225, 29, 72, 0.45)',
      background: 'rgba(225, 29, 72, 0.08)',
      iconColor: 'var(--accent-rose)',
      badgeText: 'PROD · OFFLINE',
      badgeBg: 'rgba(225, 29, 72, 0.18)',
      badgeColor: '#e11d48',
      title: 'Production Gateway Disconnected / Unreachable — Click to configure credentials',
    };
  };

  const statusDot = getStatusDot();
  const adminBtn = getAdminKeyBtnInfo();

  const navItems = [
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'playground', label: 'Playground', icon: Terminal },
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'logs', label: 'Request Logs', icon: FileText },
    { id: 'cache', label: 'Semantic Cache', icon: Database },
  ];

  return (
    <header style={{
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div className="navbar-inner" style={{ padding: '0.65rem 1.5rem' }}>
        
        {/* Brand Logo and Home Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div 
            onClick={() => setActiveTab('landing')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.65rem',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title="Return to NETRA Home"
          >
            <NetraLogo size={32} showText={true} />
          </div>

          {/* Unified Gateway Health / Environment Status Indicator */}
          <span 
            onClick={() => setShowAdminModal(true)}
            className={statusDot.className} 
            title={statusDot.title}
            style={{ cursor: 'pointer' }}
          />

          <a 
            href="https://github.com/shashankch/netra-llmgateway/releases/latest"
            target="_blank"
            rel="noreferrer"
            className="badge badge-neutral font-mono"
            style={{ 
              fontSize: '0.65rem', 
              padding: '0.15rem 0.45rem', 
              background: 'var(--bg-card-hover)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
            title="View Latest Release on GitHub"
          >
            {displayVersion}
          </a>
        </div>

        {/* Navigation Tabs */}
        <nav 
          className="navbar-nav" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.2rem', 
            overflowX: 'auto', 
            flexShrink: 1, 
            minWidth: 0, 
            WebkitOverflowScrolling: 'touch' 
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('landing')}
            className={`nav-tab ${activeTab === 'landing' ? 'active' : ''}`}
          >
            <span>Overview</span>
          </button>
          
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'analytics' && activeTab === 'overview');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`nav-tab ${isActive ? 'active' : ''}`}
              >
                <Icon size={14} style={{ opacity: isActive ? 1 : 0.7 }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls: Admin Key, Docs, Creator Attribution, Currency & Theme */}
        <div className="navbar-actions">
          
          {/* Admin Key Status & Configuration Button */}
          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="btn btn-outline btn-sm"
            style={{
              fontSize: '0.75rem',
              padding: '0.3rem 0.65rem',
              height: 32,
              borderRadius: 6,
              borderColor: adminBtn.borderColor,
              background: adminBtn.background,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            title={adminBtn.title}
          >
            <ShieldCheck size={14} style={{ color: adminBtn.iconColor, flexShrink: 0 }} />
            <span className="admin-btn-text" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {isDemoToken ? 'Sandbox' : 'Admin'}
            </span>
            <span 
              className="font-mono admin-status-badge"
              style={{
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '0.1rem 0.35rem',
                borderRadius: 4,
                background: adminBtn.badgeBg,
                color: adminBtn.badgeColor,
                lineHeight: 1.2
              }}
            >
              {adminBtn.badgeText}
            </span>
          </button>

          {/* Documentation Link */}
          <a
            href="https://docs-netrallm.avadhanlabs.dev/"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm docs-nav-link"
            style={{
              fontSize: '0.75rem',
              padding: '0.3rem 0.65rem',
              height: 32,
              alignItems: 'center',
              gap: '0.4rem',
              textDecoration: 'none'
            }}
            title="Read NETRA Documentation"
          >
            <BookOpen size={14} />
            <span>Docs</span>
          </a>

          {/* Currency Toggle */}
          <button
            type="button"
            onClick={toggleCurrency}
            className="btn btn-outline btn-sm font-mono"
            style={{ 
              fontSize: '0.75rem', 
              padding: '0.3rem 0.55rem', 
              height: 32,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem'
            }}
            title={`Display currency: ${currency} (Click to toggle USD / INR)`}
          >
            <DollarSign size={13} style={{ color: 'var(--accent-lime)' }} />
            <span>{currency}</span>
          </button>

          {/* Tri-State Theme Switcher: Light, Dark, System */}
          <div className="theme-segmented-control" title={`Theme: ${themeMode} (Current: ${theme})`}>
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`theme-segmented-btn ${themeMode === 'light' ? 'active' : ''}`}
              title="Light Mode"
              aria-label="Switch to light theme"
            >
              <Sun size={13} />
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`theme-segmented-btn ${themeMode === 'dark' ? 'active' : ''}`}
              title="Dark Mode"
              aria-label="Switch to dark theme"
            >
              <Moon size={13} />
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('system')}
              className={`theme-segmented-btn ${themeMode === 'system' ? 'active' : ''}`}
              title={`System Default (${systemTheme})`}
              aria-label="Follow system theme"
            >
              <Monitor size={13} />
            </button>
          </div>

        </div>
      </div>

      {/* Admin Secret Configuration Modal */}
      <AdminConfigModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        adminToken={adminToken}
        onUpdateAdminToken={onUpdateAdminToken}
        healthState={healthState}
      />
    </header>
  );
}
