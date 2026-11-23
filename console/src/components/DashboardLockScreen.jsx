import React, { useState } from 'react';
import { Lock, Shield, ArrowRight, AlertCircle, Eye, EyeOff, Server, Terminal, RotateCcw } from 'lucide-react';
import { loginUi, getGatewayBaseUrl, setGatewayBaseUrl } from '../config/api';

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
      const res = await loginUi(password);
      if (res.ok) {
        onUnlock();
      } else {
        setError(res.error || 'Authentication failed. Please verify NETRA_UI_PASSWORD.');
      }
    } catch (err) {
      setError('Network error connecting to NETRA gateway');
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
          maxWidth: '440px',
          padding: '2.25rem',
          borderRadius: '16px',
          border: '1px solid var(--border-default, #1f2937)',
          background: 'var(--bg-card, #111827)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(16, 185, 129, 0.12)',
          textAlign: 'center'
        }}
      >
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: 'var(--accent-emerald, #10b981)',
            marginBottom: '1.25rem'
          }}
        >
          <Lock size={26} />
        </div>

        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
          NETRA Console Locked
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1.75rem', lineHeight: 1.5 }}>
          This gateway instance is protected with operator dashboard authentication (<code style={{ color: 'var(--accent-cyan)' }}>NETRA_UI_PASSWORD</code>). Enter your password to continue.
        </p>

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
        </form>

        {editingGateway ? (
          <div 
            style={{
              marginTop: '1.25rem',
              padding: '0.85rem',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid var(--border-default, #1f2937)',
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
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              color: 'var(--text-muted)'
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Server size={12} />
              <span className="font-mono">{gatewayUrl || 'localhost:8080'}</span>
              <button
                type="button"
                onClick={() => {
                  setCustomGatewayUrl(gatewayUrl || getGatewayBaseUrl() || '');
                  setEditingGateway(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary, #10b981)',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  padding: '1px 4px',
                  textDecoration: 'underline'
                }}
                title="Change gateway target URL"
              >
                Change
              </button>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Shield size={12} style={{ color: 'var(--accent-emerald)' }} />
              <span>24h Session Cookie</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
