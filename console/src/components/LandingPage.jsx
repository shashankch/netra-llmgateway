import React from 'react';
import { useGatewayUrl, useGatewayHealth } from '../config/api';
import LandingHero from './landing/LandingHero';
import LandingFeatures from './landing/LandingFeatures';
import LandingQuickstart from './landing/LandingQuickstart';
import LandingCapabilities from './landing/LandingCapabilities';
import LandingComparison from './landing/LandingComparison';

/**
 * Top-level Landing Page component.
 * Composes the Hero banner, enterprise feature grid, quickstart snippet,
 * console capability shortcuts, and architectural comparison table.
 */
export default function LandingPage({ 
  onNavigate, 
  onOpenAdminModal, 
  adminToken = 'netra-admin-demo' 
}) {
  const gatewayUrl = useGatewayUrl();
  const { isOnline, isChecking, latencyMs, lastChecked } = useGatewayHealth();
  const isDemoToken = !adminToken || adminToken === 'netra-admin-demo';
  const gatewayHost = gatewayUrl || 'https://<YOUR_GATEWAY_URL>';

  const getStatusBadge = () => {
    if (isChecking || !lastChecked) {
      return {
        label: 'PROBING...',
        className: 'badge badge-neutral font-mono',
        style: {
          background: 'rgba(6, 182, 212, 0.12)',
          color: 'var(--accent-cyan)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          letterSpacing: '0.04em'
        },
        title: 'Probing Gateway health endpoint...'
      };
    }
    if (isDemoToken) {
      if (isOnline) {
        return {
          label: 'SANDBOX · ONLINE',
          className: 'badge font-mono',
          style: {
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            letterSpacing: '0.04em',
            fontWeight: 700
          },
          title: `Developer Sandbox Connected (ONLINE${latencyMs ? ` · ${latencyMs}ms` : ''}) • Click to configure`
        };
      }
      return {
        label: 'SANDBOX · OFFLINE',
        className: 'badge font-mono',
        style: {
          background: 'rgba(245, 158, 11, 0.10)',
          color: '#d97706',
          border: '1px solid rgba(217, 119, 6, 0.25)',
          letterSpacing: '0.04em',
          fontWeight: 600
        },
        title: 'Developer Sandbox Offline / Mock Mode (Backend Disconnected) • Click to configure Gateway URL'
      };
    }
    // Production Token Mode
    if (isOnline) {
      return {
        label: 'PROD · ONLINE',
        className: 'badge badge-success font-mono',
        style: {
          letterSpacing: '0.04em',
          fontWeight: 700
        },
        title: `Production Gateway Operational (ONLINE${latencyMs ? ` · ${latencyMs}ms` : ''}) • Click to view settings`
      };
    }
    return {
      label: 'PROD · OFFLINE',
      className: 'badge badge-danger font-mono',
      style: {
        letterSpacing: '0.04em',
        fontWeight: 700
      },
      title: 'Production Gateway Disconnected / Unreachable (CRITICAL OFFLINE) • Click to configure credentials'
    };
  };

  const statusBadge = getStatusBadge();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '0.5rem 0 3rem' }}>
      <LandingHero 
        onNavigate={onNavigate} 
        onOpenAdminModal={onOpenAdminModal} 
        statusBadge={statusBadge} 
      />

      <LandingFeatures />

      <LandingQuickstart gatewayHost={gatewayHost} />

      <LandingCapabilities onNavigate={onNavigate} />

      <LandingComparison />
    </div>
  );
}
