import React from 'react';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';

export default function SandboxNoticeBanner({ onOpenAdminModal, featureName = "telemetry and governance" }) {
  return (
    <div 
      className="sandbox-notice-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.65rem 1rem',
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 8,
        fontSize: '0.75rem',
        color: 'var(--text-primary)',
        marginBottom: '1rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
        <ShieldCheck size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
        <span style={{ lineHeight: 1.4 }}>
          <strong style={{ color: '#f59e0b' }}>Developer Sandbox Mode</strong> — Showing demonstrative {featureName}. Inference requests in the <strong>Playground</strong> execute live against the gateway.
        </span>
      </div>
      {onOpenAdminModal && (
        <button
          type="button"
          onClick={onOpenAdminModal}
          className="btn btn-outline btn-sm"
          style={{
            fontSize: '0.7rem',
            padding: '0.2rem 0.55rem',
            height: 26,
            borderColor: 'rgba(245, 158, 11, 0.45)',
            color: '#f59e0b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            flexShrink: 0,
            cursor: 'pointer'
          }}
          title="Configure dedicated admin token to view private cluster telemetry"
        >
          <span>Connect Admin Key</span>
          <ArrowUpRight size={12} />
        </button>
      )}
    </div>
  );
}
