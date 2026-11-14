import React, { useState, useEffect } from 'react';
import { 
  getGatewayBaseUrl, 
  setGatewayBaseUrl, 
  normalizeGatewayUrl, 
  setHealthPollingEnabled, 
  isHealthPollingEnabled,
  getEnvAdminToken
} from '../config/api';
import { 
  ShieldCheck, X, Lock, Eye, EyeOff, Globe, 
  RefreshCw, CheckCircle2, Sparkles 
} from 'lucide-react';

export default function AdminConfigModal({
  isOpen,
  onClose,
  adminToken,
  onUpdateAdminToken,
  healthState
}) {
  const [tokenInput, setTokenInput] = useState(adminToken || '');
  const [gatewayUrlInput, setGatewayUrlInput] = useState(() => getGatewayBaseUrl());
  const [pollingInput, setPollingInput] = useState(() => isHealthPollingEnabled());
  const [showSecret, setShowSecret] = useState(false);

  const { isOnline, isChecking, lastChecked, checkNow } = healthState;
  const isDemoToken = !adminToken || adminToken === 'netra-admin-demo';

  useEffect(() => {
    if (isOpen) {
      setTokenInput(adminToken || '');
      setGatewayUrlInput(getGatewayBaseUrl());
      setPollingInput(isHealthPollingEnabled());
      document.body.classList.add('modal-open');
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.classList.remove('modal-open');
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [isOpen, adminToken, onClose]);

  if (!isOpen) return null;

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
        desc: 'Control plane healthy · All endpoints responding normally.',
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

  const modalStatus = getGatewayModalStatus();

  const handleSaveToken = async (e) => {
    e.preventDefault();
    const cleanUrl = normalizeGatewayUrl(gatewayUrlInput);
    setGatewayBaseUrl(cleanUrl);
    setGatewayUrlInput(cleanUrl);
    if (onUpdateAdminToken) {
      onUpdateAdminToken(tokenInput);
    }
    setHealthPollingEnabled(pollingInput);
    if (pollingInput) {
      checkNow();
    }
    onClose();
  };

  const handleResetDemo = () => {
    setTokenInput('netra-admin-demo');
    setGatewayUrlInput('');
    setPollingInput(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
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
            onClick={onClose}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {getEnvAdminToken() && (
                  <span className="badge badge-primary font-mono" style={{ fontSize: '0.62rem' }} title="NETRA_ADMIN_TOKEN injected via build or Vercel environment variable">
                    Env Secret Active
                  </span>
                )}
                <span className={`badge ${isDemoToken ? 'badge-warning' : 'badge-success'} font-mono`} style={{ fontSize: '0.65rem' }}>
                  {isDemoToken ? 'Demo Key' : 'Admin Key'}
                </span>
              </div>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <Lock size={15} />
              </div>
              <input
                type={showSecret ? "text" : "password"}
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder={getEnvAdminToken() ? "Configured via Vercel / NETRA_ADMIN_TOKEN" : "Enter administrative token..."}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {gatewayUrlInput && (
                  <button
                    type="button"
                    onClick={() => setGatewayUrlInput('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                    title="Reset to default same-origin host"
                  >
                    Use Default Origin
                  </button>
                )}
                <span className={`badge ${gatewayUrlInput.trim() ? 'badge-primary' : 'badge-neutral'} font-mono`} style={{ fontSize: '0.65rem' }}>
                  {gatewayUrlInput.trim() ? 'Custom Remote' : 'Same-Origin · Default'}
                </span>
              </div>
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
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
              Leave empty to connect through your origin host, or specify an external gateway URL.
            </span>
          </div>

          {/* Field 3: Gateway Health & Connectivity Status */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                GATEWAY CONNECTIVITY
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className={`badge ${modalStatus.badgeClass} font-mono`} style={{ fontSize: '0.65rem' }}>
                  {modalStatus.badgeText}
                </span>
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
                    checked={pollingInput}
                    onChange={e => setPollingInput(e.target.checked)}
                    style={{ cursor: 'pointer', width: 13, height: 13, accentColor: 'var(--accent-emerald)' }}
                  />
                  <span>Auto-check connection in background</span>
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
                onClick={onClose}
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
  );
}
