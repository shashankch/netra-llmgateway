import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getGatewayBaseUrl, setGatewayBaseUrl, useGatewayHealth, setHealthPollingEnabled, normalizeGatewayUrl } from '../config/api';
import NetraLogo from './NetraLogo';
import { 
  Sun, Moon, Monitor, DollarSign, Activity, Terminal, Key, 
  Database, FileText, Sparkles, BookOpen, Github, ShieldCheck, X,
  Lock, Eye, EyeOff, Globe, RefreshCw, CheckCircle2, AlertCircle, Server, Check
} from 'lucide-react';

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
  const [tokenInput, setTokenInput] = useState(adminToken || '');
  const [gatewayUrlInput, setGatewayUrlInput] = useState(() => getGatewayBaseUrl());
  const [showSecret, setShowSecret] = useState(false);
  const isDemoToken = !adminToken || adminToken === 'netra-admin-demo';
  const { isOnline, isChecking, isPollingEnabled, lastChecked, latencyMs, checkNow, togglePolling } = useGatewayHealth();

  // Multi-Environment & Health Status Matrix for Navbar Indicators
  const getStatusDot = () => {
    if (isChecking) {
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
    if (isChecking) {
      return {
        borderColor: 'rgba(6, 182, 212, 0.3)',
        background: 'rgba(6, 182, 212, 0.06)',
        iconColor: 'var(--accent-cyan)',
        badgeText: 'CHECKING',
        badgeBg: 'rgba(6, 182, 212, 0.15)',
        badgeColor: 'var(--accent-cyan)',
        title: 'Probing Gateway health endpoint...',
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
        badgeText: 'DEMO',
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

  const getGatewayModalStatus = () => {
    if (isChecking) {
      return {
        dotBg: 'var(--accent-cyan)',
        dotGlow: '0 0 8px var(--accent-cyan)',
        title: 'Testing Gateway Connectivity',
        badgeText: 'PROBING',
        badgeClass: 'badge-neutral',
        desc: 'Testing connection to control plane endpoint...',
      };
    }
    if (isDemoToken) {
      if (isOnline) {
        return {
          dotBg: '#f59e0b',
          dotGlow: '0 0 8px rgba(245, 158, 11, 0.6)',
          title: 'Sandbox Gateway Active',
          badgeText: 'ONLINE',
          badgeClass: 'badge-warning',
          desc: 'Connected to gateway in developer sandbox mode.',
        };
      }
      return {
        dotBg: '#d97706',
        dotGlow: '0 0 6px rgba(217, 119, 6, 0.4)',
        title: 'Sandbox Preview Mode',
        badgeText: 'OFFLINE',
        badgeClass: 'badge-neutral',
        desc: 'Gateway unreachable. Operating with local preview data.',
      };
    }
    // Production Token Mode
    if (isOnline) {
      return {
        dotBg: 'var(--accent-emerald)',
        dotGlow: '0 0 8px var(--accent-emerald)',
        title: 'Production Gateway Operational',
        badgeText: 'ONLINE',
        badgeClass: 'badge-success',
        desc: 'Serving live traffic with healthy health checks.',
      };
    }
    return {
      dotBg: 'var(--accent-rose)',
      dotGlow: '0 0 8px var(--accent-rose)',
      title: 'Production Gateway Unreachable',
      badgeText: 'OFFLINE',
      badgeClass: 'badge-danger',
      desc: 'Control plane offline. Verify host URL, network, or service status.',
    };
  };

  const statusDot = getStatusDot();
  const adminBtn = getAdminKeyBtnInfo();
  const modalStatus = getGatewayModalStatus();

  useEffect(() => {
    if (showAdminModal) {
      setTokenInput(adminToken || '');
      setGatewayUrlInput(getGatewayBaseUrl());
      document.body.classList.add('modal-open');
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setShowAdminModal(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.classList.remove('modal-open');
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [showAdminModal, adminToken]);

  const handleSaveToken = async (e) => {
    e.preventDefault();
    const cleanUrl = normalizeGatewayUrl(gatewayUrlInput);
    setGatewayBaseUrl(cleanUrl);
    setGatewayUrlInput(cleanUrl);
    if (onUpdateAdminToken) {
      onUpdateAdminToken(tokenInput);
    }
    setHealthPollingEnabled(true);
    checkNow();
    setShowAdminModal(false);
  };

  const handleResetDemo = () => {
    setTokenInput('netra-admin-demo');
    setGatewayUrlInput('');
  };

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
      padding: '0.6rem 1.5rem',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: '0.75rem',
      }}>
        {/* Brand with Netra Aperture Logo */}
        <div 
          onClick={() => setActiveTab('landing')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flexShrink: 0 }}
          title="Return to Home"
        >
          <NetraLogo size={30} showText={true} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <a
              href="https://github.com/shashankch/netra-llmgateway/releases/tag/phase-7-complete"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="badge badge-neutral font-mono"
              style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', textDecoration: 'none' }}
              title="View release v0.7.0 on GitHub"
            >
              v0.7.0
            </a>
            <span 
              onClick={(e) => {
                e.stopPropagation();
                if (setShowAdminModal) {
                  setShowAdminModal(true);
                }
              }}
              className={statusDot.className} 
              style={{ cursor: 'pointer' }}
              title={statusDot.title} 
            />
          </div>
        </div>

        {/* Navigation Tabs (OpenRouter Minimalist Pill Tabs) */}
        <nav 
          className="hide-scrollbar"
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
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'analytics' && activeTab === 'overview');
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`btn btn-sm ${isActive ? 'btn-secondary' : 'btn-outline'}`}
                style={{
                  padding: '0.32rem 0.65rem',
                  borderRadius: 6,
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  borderColor: isActive ? 'var(--border-strong)' : 'transparent',
                  background: isActive ? 'var(--bg-card-hover)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              >
                <Icon size={14} style={{ opacity: isActive ? 1 : 0.7 }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls: Admin Key, Docs, Creator Attribution, Currency & Theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          {/* Admin Key Status & Configuration Button */}
          <button
            onClick={() => setShowAdminModal(true)}
            className="btn btn-outline btn-sm font-mono"
            style={{
              fontWeight: 600,
              padding: '0.3rem 0.55rem',
              fontSize: '0.76rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: adminBtn.borderColor,
              background: adminBtn.background,
              color: 'var(--text-primary)',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            title={adminBtn.title}
          >
            <Key size={13} style={{ color: adminBtn.iconColor, transition: 'color 0.2s ease' }} />
            <span>Admin</span>
            <span style={{
              fontSize: '0.625rem',
              color: adminBtn.badgeColor,
              background: adminBtn.badgeBg,
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              transition: 'all 0.2s ease'
            }}>
              {adminBtn.badgeText}
            </span>
          </button>

          {/* Documentation Link */}
          <a
            href="https://shashankch.github.io/netra-llmgateway/"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
            style={{ fontWeight: 600, padding: '0.3rem 0.55rem', fontSize: '0.76rem', flexShrink: 0 }}
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
            style={{ flexShrink: 0 }}
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
            style={{ fontWeight: 700, padding: '0.3rem 0.55rem', fontSize: '0.76rem', flexShrink: 0 }}
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
              title="System Default"
              aria-label="System default theme"
              aria-pressed={themeMode === 'system'}
            >
              <Monitor size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Admin Secret Configuration Modal (Issue 1) */}
      {showAdminModal && (
        <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div 
            className="modal-dialog" 
            style={{ maxWidth: 520, padding: '1.75rem', gap: '1.25rem' }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-emerald)'
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                    Gateway Admin Access
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Manage administrative authentication and connectivity endpoint
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowAdminModal(false)}
                className="btn btn-outline btn-sm"
                style={{ padding: '0.35rem 0.45rem', border: 'none', color: 'var(--text-muted)' }}
                title="Close (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Authenticates this console session with the NETRA control plane to manage tenant keys, inspect semantic cache entries, and monitor real-time inference telemetry.
            </p>

            <form onSubmit={handleSaveToken} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Field 1: Admin Bearer Token */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                    ADMIN ACCESS TOKEN
                  </label>
                  <span className={`badge ${isDemoToken ? 'badge-warning' : 'badge-success'} font-mono`} style={{ fontSize: '0.65rem' }}>
                    {isDemoToken ? 'Demo Key' : 'Admin Key'}
                  </span>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <Lock size={15} />
                  </div>
                  <input
                    type={showSecret ? "text" : "password"}
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="Enter administrative token..."
                    className="font-mono input-text"
                    style={{
                      width: '100%',
                      paddingLeft: '2.3rem',
                      paddingRight: '4.5rem',
                      fontSize: '0.8125rem'
                    }}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    autoFocus
                  />
                  <div style={{ position: 'absolute', right: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '0.2rem 0.4rem', border: 'none', color: 'var(--text-muted)' }}
                      title={showSecret ? "Hide secret" : "Reveal secret"}
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    {tokenInput && (
                      <button
                        type="button"
                        onClick={() => setTokenInput('')}
                        className="btn btn-outline btn-sm"
                        style={{ padding: '0.2rem 0.35rem', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem' }}
                        title="Clear Token"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                  Administrative token authorized for management operations.
                </span>
              </div>

              {/* Field 2: Gateway API Endpoint */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                    GATEWAY API ENDPOINT
                  </label>
                  <span className={`badge ${gatewayUrlInput.trim() ? 'badge-primary' : 'badge-neutral'} font-mono`} style={{ fontSize: '0.65rem' }}>
                    {gatewayUrlInput.trim() ? 'Custom Remote' : 'Same-Origin · Default'}
                  </span>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <Globe size={15} />
                  </div>
                  <input
                    type="text"
                    value={gatewayUrlInput}
                    onChange={e => setGatewayUrlInput(e.target.value)}
                    placeholder="https://gateway-netrallm.avadhanlabs.dev (or leave empty for default origin)"
                    className="font-mono input-text"
                    style={{
                      width: '100%',
                      paddingLeft: '2.3rem',
                      paddingRight: gatewayUrlInput ? '2.5rem' : '0.85rem',
                      fontSize: '0.8125rem'
                    }}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                  {gatewayUrlInput && (
                    <button
                      type="button"
                      onClick={() => setGatewayUrlInput('')}
                      className="btn btn-outline btn-sm"
                      style={{ position: 'absolute', right: '0.5rem', padding: '0.2rem 0.35rem', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem' }}
                      title="Reset to Same-Origin"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Leave empty to connect through your origin host, or specify an external gateway URL.
                  </span>
                  {gatewayUrlInput && (
                    <button
                      type="button"
                      onClick={() => setGatewayUrlInput('')}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      Use Default Origin
                    </button>
                  )}
                </div>
              </div>

              {/* Field 3: Gateway Health & Connectivity Status (Minimal & Solid Enterprise UI) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                    GATEWAY CONNECTIVITY
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className={`badge ${modalStatus.badgeClass} font-mono`} style={{ fontSize: '0.65rem' }}>
                      {modalStatus.badgeText}
                    </span>
                    {isOnline && latencyMs && (
                      <span className="badge badge-success font-mono" style={{ fontSize: '0.65rem' }}>
                        {latencyMs}ms
                      </span>
                    )}
                  </div>
                </div>

                <div style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                      <span 
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: modalStatus.dotBg,
                          boxShadow: modalStatus.dotGlow,
                          flexShrink: 0,
                          transition: 'all 0.3s ease'
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {modalStatus.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {modalStatus.desc}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => checkNow()}
                      disabled={isChecking}
                      className="btn btn-outline btn-sm"
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.35rem 0.65rem',
                        minWidth: 125,
                        height: 30,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        flexShrink: 0
                      }}
                    >
                      <RefreshCw size={13} className={isChecking ? "animate-spin" : ""} />
                      <span>{isChecking ? 'Checking...' : 'Test Connection'}</span>
                    </button>
                  </div>

                  <div style={{ height: 1, background: 'var(--border-subtle)' }} />

                  {/* Bottom Bar: Polling switch and last checked timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={isPollingEnabled}
                        onChange={e => togglePolling(e.target.checked)}
                        style={{ cursor: 'pointer', width: 13, height: 13, accentColor: 'var(--accent-emerald)' }}
                      />
                      <span>Background connection monitoring</span>
                    </label>

                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {lastChecked ? `Checked ${new Date(lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Not tested'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Reset to local demo credentials and re-enable health checking"
                >
                  <Sparkles size={13} style={{ color: 'var(--accent-amber)' }} />
                  <span>Reset to Demo</span>
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowAdminModal(false)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    style={{ fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Save &amp; Apply</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </header>
  );
}
