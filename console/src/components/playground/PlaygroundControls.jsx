import React, { useState } from 'react';
import { ROUTER_TIERS, DEFAULT_UPSTREAM_MODELS } from '../../constants/routerTiers';
import { BENCHMARK_PROMPT_TEMPLATES } from '../../constants/benchmarkScenarios';
import { 
  Zap, Sparkles, Cpu, Send, Radio, Terminal, 
  RotateCcw, AlertTriangle, Key, ChevronDown, ChevronRight 
} from 'lucide-react';

const ICON_MAP = {
  Zap,
  Sparkles,
  Cpu
};

export default function PlaygroundControls({
  virtualKey,
  setVirtualKey,
  model,
  setModel,
  stream,
  setStream,
  prompt,
  setPrompt,
  systemPrompt,
  setSystemPrompt,
  catalog,
  tenantKeys,
  isSelectedKeyDisabled,
  currentKeyObj,
  executing,
  handleSend,
  handleStop,
  onNavigate
}) {
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  // Dynamic models from database catalog
  const catalogModels = (catalog?.models || [])
    .map(m => m.model)
    .flatMap(s => (typeof s === 'string' ? s.split(',') : [s]))
    .map(s => String(s).trim().replace(/^[a-zA-Z0-9_-]+:/, ''))
    .filter(Boolean);

  const fastTargetModel = catalog?.aliases?.fast?.primary ? catalog.aliases.fast.primary.replace(/^[a-zA-Z0-9_-]+:/, '').trim() : null;
  const smartTargetModel = catalog?.aliases?.smart?.primary ? catalog.aliases.smart.primary.replace(/^[a-zA-Z0-9_-]+:/, '').trim() : null;

  const aliasFallbackModels = [
    ...(catalog?.aliases?.fast?.fallbacks || []),
    ...(catalog?.aliases?.smart?.fallbacks || [])
  ]
    .flatMap(s => (typeof s === 'string' ? s.split(',') : [s]))
    .map(s => String(s).trim().replace(/^[a-zA-Z0-9_-]+:/, ''))
    .filter(Boolean);

  const availableConcreteModels = Array.from(new Set([
    ...(fastTargetModel ? [fastTargetModel] : []),
    ...(smartTargetModel ? [smartTargetModel] : []),
    ...catalogModels,
    ...aliasFallbackModels
  ])).filter(m => !['fast', 'smart', 'auto'].includes(m));

  const keyAllowlist = currentKeyObj?.model_allowlist || [];
  const activeTemplate = BENCHMARK_PROMPT_TEMPLATES.find(t => t.text === prompt);
  const isCustomPrompt = !activeTemplate && prompt.trim().length > 0;

  return (
    <div 
      className="card" 
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: '0.85rem 1rem',
        overflow: 'hidden'
      }}
    >
      {/* Scrollable Upper Configuration Section */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.65rem', 
        paddingRight: '0.25rem',
        minHeight: 0
      }}>
        
        {/* Virtual Key */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Key size={11} style={{ color: 'var(--accent-lime)' }} />
              <span>VIRTUAL KEY</span>
            </label>
            <span className="badge badge-neutral font-mono" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>Bearer Auth</span>
          </div>
          <input
            type="text"
            list="vkey-options"
            className="input-text font-mono"
            value={virtualKey}
            onChange={e => setVirtualKey(e.target.value)}
            placeholder="netra-sk-..."
            style={{ 
              fontSize: '0.75rem', 
              height: 30,
              padding: '0.2rem 0.55rem',
              borderColor: isSelectedKeyDisabled ? 'var(--accent-rose, #f43f5e)' : undefined
            }}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
          />
          {tenantKeys.length > 0 && (
            <datalist id="vkey-options">
              {tenantKeys.map(k => (
                <option key={k.virtual_key} value={k.virtual_key}>
                  {k.team || 'Key'} ({k.status})
                </option>
              ))}
            </datalist>
          )}
          {isSelectedKeyDisabled && (
            <div style={{ marginTop: '0.25rem', fontSize: '0.68rem', color: 'var(--accent-amber, #f59e0b)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <AlertTriangle size={11} />
              <span>
                {currentKeyObj 
                  ? `Virtual key is ${currentKeyObj.status}. Inference requests will be blocked.` 
                  : 'Key not seeded in production database. Requests will fail with 401.'}
              </span>
              {onNavigate && (
                <button 
                  type="button" 
                  onClick={() => onNavigate('keys')} 
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.68rem', padding: 0 }}
                >
                  Mint key
                </button>
              )}
            </div>
          )}
        </div>

        {/* Router Classification Badges + Stream / JSON Slider */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '0.5rem', alignItems: 'flex-start' }}>
          {/* Dynamic Router Badges */}
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', letterSpacing: '0.03em' }}>
              ROUTER CLASSIFICATION
            </label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {ROUTER_TIERS.map(tier => {
                const IconComponent = ICON_MAP[tier.iconName] || Zap;
                const isActive = model === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setModel(tier.id)}
                    style={{
                      flex: 1,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      fontSize: '0.72rem',
                      fontWeight: isActive ? 700 : 500,
                      fontFamily: 'var(--font-mono)',
                      borderRadius: 6,
                      border: `1px solid ${isActive ? tier.border : 'var(--border-subtle)'}`,
                      background: isActive ? tier.bg : 'var(--bg-card)',
                      color: isActive ? tier.color : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? `0 0 8px ${tier.bg}` : 'none'
                    }}
                    title={tier.title}
                  >
                    <IconComponent size={11} style={{ color: isActive ? tier.color : 'var(--text-muted)' }} />
                    <span>{tier.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stream / JSON Slider */}
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', letterSpacing: '0.03em' }}>
              STREAMING MODE
            </label>
            <div style={{
              display: 'flex',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: 2,
              height: 28,
              boxSizing: 'border-box'
            }}>
              <button
                type="button"
                onClick={() => setStream(true)}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  fontWeight: stream ? 700 : 500,
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  background: stream ? 'var(--accent-lime)' : 'transparent',
                  color: stream ? 'var(--accent-primary-text)' : 'var(--text-muted)',
                  boxShadow: stream ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title="Real-time Server-Sent Events (SSE) token streaming"
              >
                <Radio size={10} />
                <span>Stream</span>
              </button>
              <button
                type="button"
                onClick={() => setStream(false)}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  fontWeight: !stream ? 700 : 500,
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  background: !stream ? 'var(--accent-lime)' : 'transparent',
                  color: !stream ? 'var(--accent-primary-text)' : 'var(--text-muted)',
                  boxShadow: !stream ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title="Single unbuffered JSON response payload"
              >
                <Terminal size={10} />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Concrete Model Dropdown */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              DIRECT MODEL OVERRIDE
            </label>
            {!['fast', 'smart', 'auto'].includes(model) && (
              <span className="badge font-mono" style={{ fontSize: '0.58rem', padding: '0.08rem 0.3rem', background: 'rgba(6, 182, 212, 0.12)', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                Direct Upstream Active
              </span>
            )}
          </div>
          <select
            className="select-input font-mono"
            value={['fast', 'smart', 'auto'].includes(model) ? '' : model}
            onChange={e => {
              if (e.target.value) setModel(e.target.value);
            }}
            style={{
              fontSize: '0.75rem',
              height: 30,
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              cursor: 'pointer',
              borderColor: !['fast', 'smart', 'auto'].includes(model) ? 'var(--accent-cyan)' : 'var(--border-subtle)'
            }}
          >
            <option value="">— Use Router Alias Above ({model}) —</option>
            {availableConcreteModels.length > 0 ? (
              <>
                {keyAllowlist.length > 0 && availableConcreteModels.some(m => keyAllowlist.includes(m)) && (
                  <optgroup label="Allowed for Current Key">
                    {availableConcreteModels.filter(m => keyAllowlist.includes(m)).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={keyAllowlist.length > 0 ? "All Configured Upstream Models" : "Available Models"}>
                  {availableConcreteModels.filter(m => !keyAllowlist.includes(m)).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </optgroup>
              </>
            ) : (
              <optgroup label="Upstream Production Models">
                {DEFAULT_UPSTREAM_MODELS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Benchmark Test Scenarios Dropdown */}
        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem', letterSpacing: '0.03em' }}>
            BENCHMARK TEST SCENARIOS
          </label>
          <select
            className="select-input font-mono"
            style={{ 
              fontSize: '0.75rem', 
              height: 30, 
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              cursor: 'pointer',
              borderColor: isCustomPrompt ? 'rgba(245, 158, 11, 0.35)' : 'var(--border-subtle)',
              background: isCustomPrompt ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
              color: isCustomPrompt ? 'var(--text-primary)' : 'inherit'
            }}
            value={activeTemplate ? activeTemplate.label : (isCustomPrompt ? '__custom__' : '')}
            onChange={e => {
              if (e.target.value === '__custom__') return;
              const found = BENCHMARK_PROMPT_TEMPLATES.find(t => t.label === e.target.value);
              if (found) {
                setPrompt(found.text);
                setModel(found.model);
              }
            }}
          >
            {isCustomPrompt ? (
              <option value="__custom__">✍️ Custom Prompt (Active)</option>
            ) : (
              <option value="" disabled>Select a benchmark scenario...</option>
            )}
            <optgroup label="Semantic Vector Cache — Pair A (Distributed Web Systems)">
              <option value={BENCHMARK_PROMPT_TEMPLATES[0]?.label}>Pair A · Step 1 (Seed Cache): What is a load balancer?</option>
              <option value={BENCHMARK_PROMPT_TEMPLATES[1]?.label}>Pair A · Step 2 (Semantic Hit): Explain what load balancers do</option>
            </optgroup>
            <optgroup label="Semantic Vector Cache — Pair B (Commercial SaaS Policy)">
              <option value={BENCHMARK_PROMPT_TEMPLATES[2]?.label}>Pair B · Step 1 (Seed Cache): What is the refund policy?</option>
              <option value={BENCHMARK_PROMPT_TEMPLATES[3]?.label}>Pair B · Step 2 (Semantic Hit): If I bought annual tier, full refund?</option>
            </optgroup>
            <optgroup label="Cache Boundary &amp; Threshold Guardrails">
              <option value={BENCHMARK_PROMPT_TEMPLATES[4]?.label}>Near-Miss Guard (Rejection): 2FA configuration on Linux</option>
            </optgroup>
            <optgroup label="Dynamic Adaptive Router Intent Proofs">
              <option value={BENCHMARK_PROMPT_TEMPLATES[5]?.label}>Auto → Fast Tier (Low Complexity): Capital of France</option>
              <option value={BENCHMARK_PROMPT_TEMPLATES[6]?.label}>Auto → Smart Tier (High Complexity): Distributed rate limiter</option>
            </optgroup>
            <optgroup label="Direct Upstream Frontier">
              <option value={BENCHMARK_PROMPT_TEMPLATES[7]?.label}>Frontier Direct: Quantum computing in 2 sentences</option>
            </optgroup>
          </select>
        </div>

        {/* Collapsible System Prompt */}
        <div>
          <button
            type="button"
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              marginBottom: showSystemPrompt ? '0.25rem' : 0
            }}
          >
            {showSystemPrompt ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>SYSTEM PROMPT (OPTIONAL)</span>
          </button>
          {showSystemPrompt && (
            <input
              type="text"
              className="input-text"
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              style={{ fontSize: '0.75rem', height: 28, padding: '0.2rem 0.55rem' }}
              placeholder="You are NETRA, an enterprise AI assistant."
            />
          )}
        </div>

        {/* User Prompt */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 70 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
              USER PROMPT
            </label>
            {prompt && (
              <button
                type="button"
                onClick={() => setPrompt('')}
                className="btn btn-outline btn-sm font-mono"
                style={{ 
                  padding: '0.05rem 0.35rem', 
                  fontSize: '0.65rem', 
                  height: 18, 
                  border: '1px solid var(--border-subtle)', 
                  color: 'var(--text-muted)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem'
                }}
                title="Clear prompt text"
              >
                <RotateCcw size={9} />
                <span>Clear</span>
              </button>
            )}
          </div>
          <textarea
            className="textarea-input"
            rows={3}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Enter prompt to execute across smart router..."
            style={{ 
              resize: 'none', 
              fontSize: '0.78rem', 
              flex: 1, 
              minHeight: 65,
              padding: '0.45rem 0.6rem',
              lineHeight: 1.45
            }}
          />
        </div>
      </div>

      {/* Pinned Bottom Action Bar (Guaranteed Always In Viewport) */}
      <div style={{
        paddingTop: '0.55rem',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: '0.5rem',
        marginTop: 'auto',
        background: 'var(--bg-card)',
        flexShrink: 0
      }}>
        <button
          onClick={handleSend}
          disabled={executing || !prompt.trim() || isSelectedKeyDisabled}
          className="btn btn-primary"
          style={{
            flex: 1,
            height: 36,
            fontWeight: 700,
            fontSize: '0.8125rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            opacity: isSelectedKeyDisabled ? 0.6 : 1,
            cursor: isSelectedKeyDisabled ? 'not-allowed' : 'pointer'
          }}
          title={isSelectedKeyDisabled ? 'Selected virtual key is inactive or not seeded in database' : undefined}
        >
          <Send size={14} />
          <span>{executing ? 'Streaming Response...' : isSelectedKeyDisabled ? 'Key Disabled / Unseeded' : 'Dispatch Request'}</span>
        </button>
        {executing && (
          <button 
            onClick={handleStop} 
            className="btn btn-secondary"
            style={{ height: 36, padding: '0 0.85rem', fontWeight: 600, fontSize: '0.78rem' }}
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
