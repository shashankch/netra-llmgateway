import React from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function SandboxNoticeBanner({ onOpenAdminModal, featureName = "cluster telemetry and router efficiency" }) {
  return (
    <div 
      className="sandbox-notice-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.85rem',
        padding: '0.65rem 1rem',
        background: 'rgba(245, 158, 11, 0.05)',
        border: '1px solid rgba(245, 158, 11, 0.22)',
        borderRadius: 8,
        fontSize: '0.75rem',
        color: 'var(--text-primary)',
        marginBottom: '1rem',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.2rem 0.55rem',
          borderRadius: 9999,
          background: 'rgba(245, 158, 11, 0.14)',
          border: '1px solid rgba(245, 158, 11, 0.32)',
          color: '#f59e0b',
          fontWeight: 700,
          fontSize: '0.6875rem',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          flexShrink: 0
        }}>
          <ShieldCheck size={13} style={{ flexShrink: 0 }} />
          <span>Sandbox Mode</span>
        </div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45, fontSize: '0.75rem' }}>
          Displaying demonstrative {featureName}. Prompts evaluated in the <strong style={{ color: 'var(--text-primary)' }}>Playground</strong> execute live against the gateway.
        </div>
      </div>
      {onOpenAdminModal && (
        <button
          type="button"
          onClick={onOpenAdminModal}
          className="btn btn-outline btn-sm"
          style={{
            fontSize: '0.7rem',
            padding: '0.25rem 0.65rem',
            height: 28,
            borderColor: 'rgba(245, 158, 11, 0.45)',
            color: '#f59e0b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            flexShrink: 0,
            cursor: 'pointer',
            fontWeight: 600,
            borderRadius: 6
          }}
          title="Configure dedicated admin token to view private cluster telemetry"
        >
          <span>Connect Admin Key</span>
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
