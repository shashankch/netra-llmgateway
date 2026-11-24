import React, { useState } from 'react';
import { Lock, Shield, ArrowRight, AlertCircle, Eye, EyeOff, Server, Terminal, RotateCcw } from 'lucide-react';
import { loginUi, getGatewayBaseUrl, setGatewayBaseUrl } from '../config/api';
import NetraLogo from './NetraLogo';

export default function DashboardLockScreen({ onUnlock, gatewayUrl }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingGateway, setEditingGateway] = useState(false);
  const [customGatewayUrl, setCustomGatewayUrl] = useState(gatewayUrl || getGatewayBaseUrl() || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the dashboard password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await loginUi(password, gatewayUrl);
      if (res.ok) {
        onUnlock();
      } else {
        setError(res.error || 'Authentication failed. Please verify operator password.');
      }
    } catch (err) {
      if (password === 'netra@admin') {
        onUnlock();
      } else {
        setError('Network error connecting to NETRA gateway. Enter default password "netra@admin" to unlock locally.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(16, 185, 129, 0.08) 0%, rgba(11, 15, 25, 0.98) 75%)',
        backgroundColor: 'var(--bg-canvas, #0b0f19)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div 
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '2.25rem',
          borderRadius: '16px',
          border: '1px solid var(--border-strong)',
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-lg), 0 0 40px rgba(16, 185, 129, 0.08)',
          textAlign: 'center'
        }}
      >
        {/* Brand & Security Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <NetraLogo size={34} showText={true} />
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(210, 248, 35, 0.1)',
                border: '1px solid rgba(210, 248, 35, 0.25)',
                color: 'var(--logo-bg, #d2f823)',
                lineHeight: '1.4'
              }}
            >
              Gateway
            </span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '3px 10px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: 'var(--accent-emerald, #10b981)',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              marginBottom: '0.85rem'
            }}
          >
            <span className="pulse-indicator" style={{ width: 6, height: 6 }} />
            <span>Protected Console</span>
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Operator Authentication
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, maxWidth: '340px' }}>
            Enter your operator password to access gateway telemetry, virtual keys, and routing controls.
          </p>
        </div>

        {error && (
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: 'var(--accent-rose, #ef4444)',
              fontSize: '0.8125rem',
              textAlign: 'left',
              marginBottom: '1.25rem'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative', textAlign: 'left' }}>
            <label 
              htmlFor="dashboard-password-input"
              style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}
            >
              Operator Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="dashboard-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                autoFocus
                disabled={loading}
                className="input"
                style={{
                  width: '100%',
                  paddingRight: '2.5rem',
                  fontFamily: showPassword ? 'var(--font-mono)' : 'inherit',
                  letterSpacing: showPassword ? 'normal' : '0.15em'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: 700,
              justifyContent: 'center',
              gap: '0.5rem',
              marginTop: '0.25rem'
            }}
          >
            {loading ? (
              <>
                <span className="pulse-indicator" style={{ width: 8, height: 8 }} />
                <span>Verifying Session...</span>
              </>
            ) : (
              <>
                <span>Unlock Operations Console</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div style={{ marginTop: '0.65rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={async () => {
                setPassword('netra@admin');
                setLoading(true);
                setError(null);
                try {
                  const res = await loginUi('netra@admin', gatewayUrl);
                  if (res.ok) {
                    onUnlock();
                  } else {
                    setError(res.error);
                  }
                } catch {
                  onUnlock();
                } finally {
                  setLoading(false);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.72rem',
                textDecoration: 'underline',
                padding: '2px 4px'
              }}
              title="Unlock using the default operator credentials"
            >
              Use default password (<span style={{ color: 'var(--accent-emerald, #10b981)', fontWeight: 600 }}>netra@admin</span>)
            </button>
          </div>
        </form>

        {editingGateway ? (
          <div 
            style={{
              marginTop: '1.25rem',
              padding: '0.85rem',
              borderRadius: '8px',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-strong)',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Target Gateway Address
              </label>
              <button
                type="button"
                onClick={() => {
                  setGatewayBaseUrl('');
                  setCustomGatewayUrl('');
                  setEditingGateway(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem'
                }}
                title="Reset to default local gateway"
              >
                <RotateCcw size={10} />
                <span>Reset Default</span>
              </button>
            </div>
            <input
              type="text"
              value={customGatewayUrl}
              onChange={(e) => setCustomGatewayUrl(e.target.value)}
              placeholder="e.g. http://localhost:8080"
              className="input font-mono"
              style={{ width: '100%', fontSize: '0.78rem', padding: '0.4rem 0.6rem', marginBottom: '0.6rem' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditingGateway(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setGatewayBaseUrl(customGatewayUrl);
                  setEditingGateway(false);
                }}
                className="btn btn-primary"
                style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
              >
                Save & Reconnect
              </button>
            </div>
          </div>
        ) : (
          <div 
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}
          >
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.45rem 0.65rem',
                gap: '0.5rem'
              }}
            >
              <div 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.45rem', 
                  minWidth: 0, 
                  flex: 1 
                }}
              >
                <Server size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span 
                  className="font-mono" 
                  style={{ 
                    fontSize: '0.72rem', 
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={gatewayUrl || 'localhost:8080'}
                >
                  {gatewayUrl || 'localhost:8080'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomGatewayUrl(gatewayUrl || getGatewayBaseUrl() || '');
                  setEditingGateway(true);
                }}
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: 'var(--accent-primary, #10b981)',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  flexShrink: 0,
                  lineHeight: '1.4'
                }}
                title="Change gateway target URL"
              >
                Change
              </button>
            </div>

            <div 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.35rem',
                fontSize: '0.68rem',
                color: 'var(--text-muted)'
              }}
            >
              <Shield size={12} style={{ color: 'var(--accent-emerald, #10b981)' }} />
              <span>24h Session Cookie</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
