import React, { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

export default function LandingQuickstart({ gatewayHost }) {
  const [copied, setCopied] = useState(false);

  const curlExample = `curl -X POST ${gatewayHost}/v1/chat/completions \\
  -H "Authorization: Bearer netra-sk-research-4d5e6f" \\
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
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={16} style={{ color: 'var(--accent-lime)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Quickstart: OpenAI-Compatible Invocations</span>
        </div>
        <button 
          onClick={copyToClipboard}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          {copied ? <Check size={12} style={{ color: 'var(--accent-lime)' }} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy cURL'}</span>
        </button>
      </div>
      <pre style={{ 
        margin: 0, 
        padding: '1rem', 
        background: 'var(--bg-card)', 
        borderRadius: 8, 
        border: '1px solid var(--border-subtle)',
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-mono)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        color: 'var(--text-code)',
        lineHeight: 1.5
      }}>
        {curlExample}
      </pre>
    </div>
  );
}
