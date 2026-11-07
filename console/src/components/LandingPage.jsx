import React, { useState } from 'react';
import NetraLogo from './NetraLogo';
import { useGatewayUrl, useGatewayHealth } from '../config/api';
import { 
  Zap, Database, ShieldCheck, Cpu, Terminal, 
  ArrowRight, CheckCircle2, Copy, Sparkles, Layers, DollarSign,
  ExternalLink, Github, BookOpen, Check, Users, Globe, Key, Activity, FileText,
  Clock, Gauge, Network, Coins, Lock, TrendingUp
} from 'lucide-react';

export default function LandingPage({ onNavigate, onOpenAdminModal, adminToken = 'netra-admin-demo' }) {
  const [copied, setCopied] = useState(false);
  const gatewayUrl = useGatewayUrl();
  const { isOnline, isChecking, isPollingEnabled, latencyMs } = useGatewayHealth();
  const isDemoToken = !adminToken || adminToken === 'netra-admin-demo';
  const gatewayHost = gatewayUrl || 'https://<YOUR_GATEWAY_URL>';

  const getStatusBadge = () => {
    if (isChecking) {
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
          label: latencyMs ? `SANDBOX · ONLINE · ${latencyMs}ms` : 'SANDBOX · ONLINE',
          className: 'badge font-mono',
          style: {
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            letterSpacing: '0.04em',
            fontWeight: 700
          },
          title: `Developer Sandbox Connected (${latencyMs ? `${latencyMs}ms` : 'Healthy'}) • Click to configure`
        };
      }
      if (!isPollingEnabled) {
        return {
          label: 'SANDBOX · PAUSED',
          className: 'badge font-mono',
          style: {
            background: 'rgba(245, 158, 11, 0.08)',
            color: '#d97706',
            border: '1px solid rgba(217, 119, 6, 0.20)',
            letterSpacing: '0.04em'
          },
          title: 'Developer Sandbox Probes Paused • Click to configure or test connection'
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
        label: latencyMs ? `PROD · ONLINE · ${latencyMs}ms` : 'PROD · ONLINE',
        className: 'badge badge-success font-mono',
        style: {
          letterSpacing: '0.04em',
          fontWeight: 700
        },
        title: `Production Gateway Operational (ONLINE · ${latencyMs ? `${latencyMs}ms` : 'Healthy'}) • Click to view settings`
      };
    }
    if (!isPollingEnabled) {
      return {
        label: 'PROD · PAUSED',
        className: 'badge badge-warning font-mono',
        style: {
          letterSpacing: '0.04em',
          fontWeight: 600
        },
        title: 'Production Gateway Monitoring Paused • Click to test connection or configure'
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

  const curlExample = `curl -X POST ${gatewayHost}/v1/chat/completions \\
  -H "Authorization: Bearer netra-sk-search-1a2b3c" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "What is a load balancer and why is it needed?"}]
  }'`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(curlExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '0.5rem 0 3rem' }}>
      
      {/* 1. OpenRouter-Style Top Organization Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Organization Avatar */}
          <NetraLogo size={56} showText={false} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                NETRA
              </h2>
              <span 
                onClick={onOpenAdminModal}
                className={statusBadge.className} 
                style={{ 
                  fontSize: '0.65rem',
                  cursor: onOpenAdminModal ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  ...(statusBadge.style || {})
                }}
                title={statusBadge.title}
              >
                {statusBadge.label}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              The unified intelligent interface for LLMs. Find the best models & prices for your prompts.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
              <a 
                href="https://github.com/shashankch/netra-llmgateway" 
                target="_blank" 
                rel="noreferrer" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
              >
                <Github size={14} />
                <span>shashankch/netra-llmgateway</span>
              </a>
              <a 
                href="https://shashankch.github.io/netra-llmgateway/" 
                target="_blank" 
                rel="noreferrer" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
              >
                <BookOpen size={14} />
                <span>Documentation</span>
              </a>
              <a 
                href="https://github.com/shashankch" 
                target="_blank" 
                rel="noreferrer" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                <Sparkles size={14} style={{ color: 'var(--accent-lime)' }} />
                <span>Crafted by <strong>Shashank Chandel</strong></span>
              </a>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button 
            onClick={() => onNavigate('keys')} 
            className="btn btn-cyan btn-sm"
            style={{ padding: '0.5rem 1.15rem', fontSize: '0.8125rem' }}
          >
            <Key size={14} />
            <span>API Keys</span>
          </button>
          <button 
            onClick={() => onNavigate('playground')} 
            className="btn btn-primary btn-sm"
            style={{ padding: '0.5rem 1.15rem', fontSize: '0.8125rem' }}
          >
            <Terminal size={14} />
            <span>Open Playground</span>
          </button>
        </div>
      </div>

      {/* 2. OpenRouter-Style README Card / Hero Banner */}
      <div className="openrouter-hero-container">
        {/* Top Tab Bar */}
        <div className="openrouter-tab-bar">
          <span>README.md</span>
        </div>

        {/* Banner Body */}
        <div className="openrouter-banner-body">
          {/* Big Centerpiece Logo + Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <NetraLogo size={64} showText={true} />
          </div>

          {/* Tagline & Subtitle */}
          <div className="openrouter-tagline">
            The unified interface for LLMs.
          </div>
          <div className="openrouter-subtext">
            Route dynamically across frontier models, eliminate redundant token spend with sub-5ms caching, and ensure zero-downtime inference with one drop-in OpenAI-compatible API.
          </div>

          {/* 4 Stat Metric Cards (OpenRouter Aesthetic) */}
          <div className="openrouter-stats-grid">
            <div className="openrouter-stat-card">
              <div className="openrouter-stat-number" style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.45rem', letterSpacing: '-0.02em' }}>
                <span style={{ color: 'var(--text-primary)' }}>ANY</span>
                <span style={{ color: 'var(--accent-cyan)' }}>LLM</span>
              </div>
              <div className="openrouter-stat-label">OPENAI-COMPATIBLE</div>
              <div className="openrouter-stat-desc">one standard API for every provider</div>
            </div>

            <div className="openrouter-stat-card">
              <div className="openrouter-stat-number" style={{ color: 'var(--text-primary)' }}>
                0.00<span style={{ color: 'var(--accent-lime)' }}>%</span>
              </div>
              <div className="openrouter-stat-label">OVER-ADMISSION</div>
              <div className="openrouter-stat-desc">zero-leak rate &amp; budget limits</div>
            </div>

            <div className="openrouter-stat-card">
              <div className="openrouter-stat-number" style={{ color: 'var(--text-primary)' }}>
                &lt; 5<span style={{ color: 'var(--accent-emerald)' }}>ms</span>
              </div>
              <div className="openrouter-stat-label">SEMANTIC CACHE</div>
              <div className="openrouter-stat-desc">instant answers for repeated prompts</div>
            </div>

            <div className="openrouter-stat-card">
              <div className="openrouter-stat-number" style={{ color: 'var(--text-primary)' }}>
                72.4<span style={{ color: 'var(--accent-indigo)' }}>%</span>
              </div>
              <div className="openrouter-stat-label">COST ARBITRAGE</div>
              <div className="openrouter-stat-desc">smart model routing by complexity</div>
            </div>
          </div>

          {/* OpenRouter Pill Links Bar */}
          <div className="openrouter-pill-bar">
            <a 
              href="https://shashankch.github.io/netra-llmgateway/" 
              target="_blank" 
              rel="noreferrer" 
              className="pill-link" 
              style={{ textDecoration: 'none' }}
            >
              <span className="pill-link-tag">DOCS</span>
              <span className="pill-link-val">shashankch.github.io/netra-llmgateway</span>
            </a>

            <div className="pill-link">
              <span className="pill-link-tag">API</span>
              <span className="pill-link-val">/v1/chat/completions</span>
            </div>

            <button 
              onClick={() => onNavigate('keys')} 
              className="btn btn-cyan"
              style={{ 
                fontSize: '0.8125rem', 
                padding: '0.5rem 1.25rem', 
                borderRadius: 9999, 
                fontWeight: 700, 
                letterSpacing: '0.03em', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.45rem',
                boxShadow: '0 0 16px var(--accent-cyan-subtle)'
              }}
            >
              <Key size={14} />
              <span>GET API KEY</span>
            </button>
            <button 
              onClick={() => onNavigate('playground')} 
              className="btn btn-primary"
              style={{ 
                fontSize: '0.8125rem', 
                padding: '0.5rem 1.25rem', 
                borderRadius: 9999, 
                fontWeight: 700, 
                letterSpacing: '0.03em', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.45rem',
                boxShadow: '0 0 16px var(--accent-primary-subtle)'
              }}
            >
              <Terminal size={14} />
              <span>OPEN PLAYGROUND</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. "Why NETRA?" Section (Modern Enterprise Feature Grid) */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--accent-primary-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-lime)'
              }}>
                <Sparkles size={18} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)' }}>
                Why NETRA?
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.35rem 0 0' }}>
              Enterprise infrastructure for reliable model routing, cost optimization, and multi-tenant AI governance.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem'
        }}>
          {/* Feature 1: Unified Multi-Provider Routing */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(210, 248, 35, 0.1)',
              border: '1px solid rgba(210, 248, 35, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-lime)'
            }}>
              <Network size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Unified Multi-Provider Routing
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Route requests seamlessly across private self-hosted models, external cloud providers, and managed aggregators through a single OpenAI-compatible API. Configure logical model aliases with automated fallback chains and zero client SDK modifications.
            </div>
          </div>

          {/* Feature 2: Intelligent Cost-Optimized Routing */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-indigo)'
            }}>
              <Cpu size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Intelligent Cost-Optimized Routing
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Dynamically analyze prompt complexity at the gateway layer to route simple queries to high-throughput, economical models and reserve flagship models for advanced reasoning, delivering substantial cost reductions automatically.
            </div>
          </div>

          {/* Feature 3: High-Performance Semantic Caching */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-emerald)'
            }}>
              <Database size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              High-Performance Semantic Caching
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Instantly serve repeated and semantically equivalent queries from a low-latency vector cache with zero upstream model charges. Accelerate response times for common queries from seconds to single-digit milliseconds.
            </div>
          </div>

          {/* Feature 4: Concurrency Guarantees & Rate Limiting */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}>
              <Gauge size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Concurrency Guarantees &amp; Rate Limiting
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Enforce strict requests-per-minute quotas and monthly tenant spend ceilings with atomic synchronization. Prevent noisy-neighbor saturation and eliminate billing overruns under high-concurrency production bursts.
            </div>
          </div>

          {/* Feature 5: Active Client Disconnect Handling */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(210, 248, 35, 0.1)',
              border: '1px solid rgba(210, 248, 35, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-lime)'
            }}>
              <Zap size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Active Client Disconnect Handling
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Detect interrupted connections and cancelled user sessions in real time. The gateway immediately terminates the upstream generation stream, eliminating phantom token consumption and wasted spend on abandoned responses.
            </div>
          </div>

          {/* Feature 6: Precision Vector Guardrails */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-emerald)'
            }}>
              <CheckCircle2 size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Precision Vector Guardrails
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Calibrated similarity gating ensures only authentic semantic paraphrases retrieve cached completions while strictly rejecting near-miss queries, preventing cache poisoning and ensuring answers remain contextually accurate.
            </div>
          </div>

          {/* Feature 7: Low-Latency Streaming Relay */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}>
              <Activity size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Low-Latency Streaming Relay
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Stream tokens directly to client applications via unbuffered Server-Sent Events (SSE) with negligible gateway overhead. Engineered for high concurrency and smooth time-to-first-token interactive experiences.
            </div>
          </div>

          {/* Feature 8: Resilient Telemetry Buffering */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-indigo)'
            }}>
              <Layers size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Resilient Telemetry Buffering
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Asynchronously aggregate request logs and financial accounting records in a bounded buffer, shielding downstream databases from write amplification and maintaining gateway responsiveness during traffic surges.
            </div>
          </div>

          {/* Feature 9: Multi-Tenant Security & Isolation */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(210, 248, 35, 0.1)',
              border: '1px solid rgba(210, 248, 35, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-lime)'
            }}>
              <ShieldCheck size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Multi-Tenant Security &amp; Isolation
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Isolate prompt data, vector cache entries, and usage analytics per virtual key. Ensure complete data privacy between internal teams and client applications with zero cross-tenant prompt leakage.
            </div>
          </div>
        </div>
      </div>

      {/* 4. Quickstart Code Block */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Quickstart: Drop-in OpenAI Compatible API</h3>
            <p style={{ fontSize: '0.785rem', color: 'var(--text-secondary)' }}>Drop-in replacement for OpenAI SDKs by configuring your base URL and virtual key with zero code modifications.</p>
          </div>
          <button onClick={copyToClipboard} className="btn btn-secondary btn-sm font-mono">
            {copied ? <Check size={13} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy cURL'}</span>
          </button>
        </div>

        <pre style={{
          background: 'var(--bg-card)',
          padding: '1rem 1.25rem',
          borderRadius: 8,
          fontSize: '0.8125rem',
          overflowX: 'auto',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-code)',
          lineHeight: 1.6
        }}>
          {curlExample}
        </pre>
      </div>

      {/* 5. Explore Gateway Capabilities Grid */}
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.85rem' }}>
          Explore Gateway Console &amp; Tools
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div 
            onClick={() => onNavigate('playground')}
            className="card card-hover" 
            style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.15s ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Developer Playground</span>
              <Terminal size={16} style={{ color: 'var(--accent-lime)' }} />
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Test token streaming, prompt complexity auto routing, and real-time latency badges.
            </p>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-lime)', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              Launch Console →
            </span>
          </div>

          <div 
            onClick={() => onNavigate('keys')}
            className="card card-hover" 
            style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.15s ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>API Keys &amp; Governance</span>
              <Key size={16} style={{ color: 'var(--accent-cyan)' }} />
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Provision virtual keys, model allowlists, sliding-window RPM quotas, and monthly budgets.
            </p>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-cyan)', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              Manage Keys →
            </span>
          </div>

          <div 
            onClick={() => onNavigate('analytics')}
            className="card card-hover" 
            style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.15s ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Real-Time Analytics</span>
              <Activity size={16} style={{ color: 'var(--accent-emerald)' }} />
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Track spend in USD/INR, request velocity, token burn-down, and semantic cache savings.
            </p>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-emerald)', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              View Analytics →
            </span>
          </div>

          <div 
            onClick={() => onNavigate('logs')}
            className="card card-hover" 
            style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.15s ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Audit Request Stream</span>
              <FileText size={16} style={{ color: 'var(--accent-indigo)' }} />
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Real-time Server-Sent Events audit stream with virtual key and status code filtering.
            </p>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-indigo)', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              Stream Logs →
            </span>
          </div>
        </div>
      </div>

      {/* 6. Feature Comparison Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Architecture &amp; Gateway Comparison
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
              Compare architectural guarantees between direct vendor APIs, public cloud aggregators, and NETRA private gateway.
            </p>
          </div>
          <a
            href="https://shashankch.github.io/netra-llmgateway/comparison/"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
          >
            <span>Full Comparison Guide</span>
            <ExternalLink size={12} />
          </a>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '22%', verticalAlign: 'middle' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Layers size={14} style={{ color: 'var(--accent-lime)' }} />
                    <span>CAPABILITY</span>
                  </div>
                </th>
                <th style={{ width: '25%', verticalAlign: 'middle' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Cpu size={14} style={{ color: 'var(--text-muted)' }} />
                    <span>RAW PROVIDER APIS</span>
                  </div>
                </th>
                <th style={{ width: '25%', verticalAlign: 'middle' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Globe size={14} style={{ color: 'var(--accent-cyan)' }} />
                    <span>PUBLIC AGGREGATORS</span>
                  </div>
                </th>
                <th style={{ width: '28%', verticalAlign: 'middle' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <NetraLogo size={16} showText={false} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>NETRA ENTERPRISE GATEWAY</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Data Residency & Privacy */}
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(210, 248, 35, 0.1)',
                      border: '1px solid rgba(210, 248, 35, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-lime)',
                      flexShrink: 0
                    }}>
                      <ShieldCheck size={15} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Data Residency &amp; Privacy</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Proprietary vendor cloud perimeter; prompts and data exit organization boundary
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Transits third-party multi-tenant SaaS edge before reaching upstream
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                    100% In-VPC private deployment with strict network isolation and zero data egress
                  </span>
                </td>
              </tr>

              {/* Row 2: Two-Tier Semantic Vector Cache */}
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-emerald)',
                      flexShrink: 0
                    }}>
                      <Database size={15} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Two-Tier Semantic Cache</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Provider-specific prompt caching billed at standard upstream rates
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    None; every request incurs full upstream token charges
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                    Sub-5ms vector cache serving repeated and paraphrased queries at zero upstream cost
                  </span>
                </td>
              </tr>

              {/* Row 3: Cache Boundary Discrimination */}
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-cyan)',
                      flexShrink: 0
                    }}>
                      <CheckCircle2 size={15} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Boundary Discrimination</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Exact string hash matching only; misses semantic paraphrases
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    None; every variant query billed as a new prompt
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                    Calibrated cosine similarity gating with near-miss rejection to prevent cache poisoning
                  </span>
                </td>
              </tr>

              {/* Row 4: Mid-Stream Cancels & Phantom Spend */}
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(210, 248, 35, 0.1)',
                      border: '1px solid rgba(210, 248, 35, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-lime)',
                      flexShrink: 0
                    }}>
                      <Zap size={15} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Mid-Stream Disconnects</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Upstream generates to completion; unseen tokens are fully billed
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Uncontrolled; streams continue generating upon client disconnect
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                    Instant stream termination halts upstream generation immediately, stopping phantom token spend
                  </span>
                </td>
              </tr>

              {/* Row 5: Rate Limiting & Budgets */}
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-cyan)',
                      flexShrink: 0
                    }}>
                      <Gauge size={15} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Rate Limiting &amp; Budgets</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Opaque provider-side throttling with unpredictable 429 burst limits
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Prepaid account balance checks without real-time tenant rate limits
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                    Atomic sliding-window rate limits and monthly spend ceilings with automatic rollback on failure
                  </span>
                </td>
              </tr>

              {/* Row 6: Cost Arbitrage Routing */}
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-indigo)',
                      flexShrink: 0
                    }}>
                      <Cpu size={15} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Cost Arbitrage Routing</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Hardcoded model references in client application code
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Manual model selection or basic static fallback without difficulty analysis
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                    Dynamic prompt complexity analysis routing routine queries to fast tiers and reasoning to smart tiers
                  </span>
                </td>
              </tr>

              {/* Row 7: High-Availability Failover */}
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-cyan)',
                      flexShrink: 0
                    }}>
                      <Activity size={15} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>High-Availability Failover</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Client-side try/catch retry loops that amplify latency during provider outages
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Hosted multi-provider fallback dependent on third-party SaaS availability
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                    Autonomous circuit breakers and ordered candidate chains with strict timeout budgets
                  </span>
                </td>
              </tr>

              {/* Row 8: Concurrency & Stream Latency */}
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-emerald)',
                      flexShrink: 0
                    }}>
                      <Clock size={15} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Streaming Relay Performance</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Variable connection latency dependent on vendor server proximity
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Additional network hop through third-party proxy adding 50–150ms roundtrip delay
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                    Non-blocking unbuffered streaming relay with sub-millisecond gateway pass-through overhead
                  </span>
                </td>
              </tr>

              {/* Row 9: Deployment & License */}
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(210, 248, 35, 0.1)',
                      border: '1px solid rgba(210, 248, 35, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-lime)',
                      flexShrink: 0
                    }}>
                      <Key size={15} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Deployment &amp; License</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Proprietary vendor cloud infrastructure with vendor lock-in
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Closed-source proprietary SaaS platform
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                    100% open source (Apache 2.0) deployable anywhere via Docker, PaaS, or bare metal
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
