import React, { useState } from 'react';
import NetraLogo from './NetraLogo';
import { 
  Zap, Database, ShieldCheck, Cpu, Terminal, 
  ArrowRight, CheckCircle2, Copy, Sparkles, Layers, DollarSign,
  ExternalLink, Github, BookOpen, Check, Users, Globe, Key, Activity, FileText
} from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  const [copied, setCopied] = useState(false);

  const curlExample = `curl -X POST http://localhost:8080/v1/chat/completions \\
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
              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>ONLINE</span>
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

      {/* 3. "Why NETRA?" Section (Clean OpenRouter Typography) */}
      <div className="card" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
          Why NETRA?
        </h3>
        
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', listStyle: 'none', padding: 0 }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            <div style={{ height: '1.5rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-lime)', boxShadow: '0 0 6px var(--accent-lime)' }} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Unified Multi-Provider Routing.</strong> Route requests across upstream providers using standard aliases (<code>fast</code>, <code>smart</code>, <code>auto</code>) without changing client SDK code.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            <div style={{ height: '1.5rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-lime)', boxShadow: '0 0 6px var(--accent-lime)' }} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Better Prices &amp; Uptime.</strong> Automatic ordered fallbacks, exponential backoff retries, and dynamic price/performance auto routing across providers.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            <div style={{ height: '1.5rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-lime)', boxShadow: '0 0 6px var(--accent-lime)' }} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Instant Semantic Vector Cache.</strong> Sub-5ms similarity caching answers repeated and paraphrased prompts instantly with $0 upstream token cost.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            <div style={{ height: '1.5rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-lime)', boxShadow: '0 0 6px var(--accent-lime)' }} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Universal OpenAI Compatibility.</strong> Drop-in replacement for any OpenAI SDK or client by updating only the endpoint URL and virtual key.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            <div style={{ height: '1.5rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-lime)', boxShadow: '0 0 6px var(--accent-lime)' }} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Zero Over-Admission Guarantee.</strong> Atomic rate limits and budget quotas protect your upstream spending with zero race conditions.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            <div style={{ height: '1.5rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-lime)', boxShadow: '0 0 6px var(--accent-lime)' }} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Zero Phantom Spend on Stream Cancels.</strong> When users close a browser tab or cancel an in-flight prompt, NETRA instantly severs the upstream provider connection, preventing runaway token costs that other gateways leave running to completion.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            <div style={{ height: '1.5rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-lime)', boxShadow: '0 0 6px var(--accent-lime)' }} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Hallucination-Safe Semantic Caching.</strong> High-precision vector similarity gating delivers sub-5ms responses for true paraphrased queries while strictly rejecting near-miss prompts, eliminating both redundant model bills and false-positive answers.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            <div style={{ height: '1.5rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-lime)', boxShadow: '0 0 6px var(--accent-lime)' }} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Private Cloud &amp; Multi-Model Flexibility.</strong> Seamlessly connect your private enterprise credentials (Azure OpenAI, AWS Bedrock, self-hosted vLLM) for regulated workloads, alongside 500+ frontier models through OpenRouter under one unified API.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            <div style={{ height: '1.5rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-lime)', boxShadow: '0 0 6px var(--accent-lime)' }} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Enterprise Multi-Tenant Privacy.</strong> Cryptographically isolated tenant partitions guarantee zero cross-tenant prompt leakage, backed by built-in connection backpressure that safeguards database health under massive traffic spikes.
            </div>
          </li>
        </ul>
      </div>

      {/* 4. Quickstart Code Block */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Quickstart: Drop-in OpenAI Compatible API</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Just swap base URL and virtual key — zero client SDK changes needed</p>
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
                <th>Capability</th>
                <th>Raw Provider APIs</th>
                <th>Public Aggregators (e.g. OpenRouter)</th>
                <th>NETRA Enterprise Gateway</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Data Residency &amp; Privacy</td>
                <td>Vendor cloud boundary</td>
                <td>Transits public multi-tenant SaaS edge</td>
                <td><strong style={{ color: 'var(--accent-lime)' }}>100% In-VPC / Sovereign (Zero Data Bleed)</strong></td>
              </tr>
              <tr>
                <td>Semantic Vector Cache</td>
                <td>Costly prompt caching</td>
                <td>None (all queries billed upstream)</td>
                <td><strong style={{ color: 'var(--accent-emerald)' }}>Sub-5ms Semantic Cache ($0 Upstream Cost)</strong></td>
              </tr>
              <tr>
                <td>Cache Boundary Discrimination</td>
                <td>Exact text match only (no semantic recall)</td>
                <td>None (every prompt billed)</td>
                <td><strong style={{ color: 'var(--accent-emerald)' }}>Cosine Boundary Guard (Near-Miss Rejection)</strong></td>
              </tr>
              <tr>
                <td>Mid-Stream Cancels &amp; Phantom Spend</td>
                <td>Runs to completion (unseen tokens billed)</td>
                <td>Runs to completion (unseen tokens billed)</td>
                <td><strong style={{ color: 'var(--accent-lime)' }}>Zero Phantom Spend (Instant Socket Severing)</strong></td>
              </tr>
              <tr>
                <td>Rate Limiting &amp; Budgets</td>
                <td>Black-box 429 throttling</td>
                <td>Prepaid credit top-ups only</td>
                <td><strong style={{ color: 'var(--accent-lime)' }}>Atomic Sliding-Window (0.00% Over-Admission)</strong></td>
              </tr>
              <tr>
                <td>Cost Arbitrage Routing</td>
                <td>Manual model picking in code</td>
                <td>Manual selection / basic fallback</td>
                <td><strong style={{ color: 'var(--accent-indigo)' }}>Dynamic Complexity Routing (~72.4% Cost Savings)</strong></td>
              </tr>
              <tr>
                <td>High-Availability Failover</td>
                <td>Client-side try/catch loops</td>
                <td>Public network host fallback</td>
                <td><strong style={{ color: 'var(--accent-cyan)' }}>Synchronous Zero-Glitch Upstream Failover</strong></td>
              </tr>
              <tr>
                <td>Deployment &amp; License</td>
                <td>Proprietary closed cloud</td>
                <td>Proprietary closed SaaS</td>
                <td><strong style={{ color: 'var(--accent-emerald)' }}>100% Open Source (Apache 2.0 / Self-Hosted)</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
