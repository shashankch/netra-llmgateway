import React, { useState } from 'react';
import { 
  Cpu, Database, Clock, Coins, AlertTriangle, 
  Check, Copy, Trash2, Zap, XCircle, Terminal,
  FileText, Code
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

export default function PlaygroundResponsePane({
  executing,
  telemetry,
  responseContent,
  errorInfo,
  stream,
  chunkCount,
  copiedResponse,
  copyResponseToClipboard,
  handleClearOutput,
  responseContainerRef,
  formatCurrency
}) {
  const [viewMode, setViewMode] = useState('markdown'); // 'markdown' | 'raw'
  return (
    <div 
      className="card" 
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        height: '100%',
        minHeight: 0,
        padding: '1.1rem',
        overflow: 'hidden'
      }}
    >
      {/* Execution Telemetry Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 800, letterSpacing: '-0.01em' }}>Response</span>
            {executing && (
              <span className="pulse-indicator" style={{ width: 7, height: 7 }} />
            )}
          </div>

          {telemetry && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span 
                className="font-mono" 
                style={{ 
                  fontSize: '0.7rem', 
                  padding: '0.15rem 0.5rem', 
                  borderRadius: 4, 
                  fontWeight: 700, 
                  background: telemetry.status === 200 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                  color: telemetry.status === 200 ? 'var(--accent-emerald)' : 'var(--accent-rose)' 
                }}
              >
                {telemetry.status === 200 ? '200 OK' : `HTTP ${telemetry.status}`}
              </span>

              <span 
                className="font-mono" 
                style={{ 
                  fontSize: '0.7rem', 
                  padding: '0.15rem 0.5rem', 
                  borderRadius: 4, 
                  fontWeight: 600, 
                  background: 'rgba(255, 255, 255, 0.04)', 
                  color: 'var(--text-secondary)', 
                  border: '1px solid var(--border-subtle)', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.3rem' 
                }}
                title="Upstream Execution Provider"
              >
                <Cpu size={11} />
                <span>{telemetry.provider}</span>
              </span>

              <span 
                className="font-mono" 
                style={{ 
                  fontSize: '0.7rem', 
                  padding: '0.15rem 0.5rem', 
                  borderRadius: 4, 
                  fontWeight: 700, 
                  background: telemetry.cache === 'hit' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)', 
                  color: telemetry.cache === 'hit' ? 'var(--accent-emerald)' : 'var(--text-secondary)', 
                  border: `1px solid ${telemetry.cache === 'hit' ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-subtle)'}`, 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.3rem' 
                }}
                title="Semantic Vector Cache Resolution"
              >
                <Database size={11} />
                <span>{telemetry.cache === 'hit' ? 'CACHE HIT' : 'CACHE MISS'}</span>
              </span>

              <span 
                className="font-mono" 
                style={{ 
                  fontSize: '0.7rem', 
                  padding: '0.15rem 0.5rem', 
                  borderRadius: 4, 
                  fontWeight: 600, 
                  background: 'rgba(255, 255, 255, 0.04)', 
                  color: 'var(--text-secondary)', 
                  border: '1px solid var(--border-subtle)', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.3rem' 
                }}
                title="Total E2E Gateway Latency"
              >
                <Clock size={11} />
                <span>{telemetry.latencyMs}ms</span>
              </span>

              <span 
                className="font-mono" 
                style={{ 
                  fontSize: '0.7rem', 
                  padding: '0.15rem 0.5rem', 
                  borderRadius: 4, 
                  fontWeight: 600, 
                  background: 'rgba(255, 255, 255, 0.04)', 
                  color: 'var(--text-secondary)', 
                  border: '1px solid var(--border-subtle)', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.3rem' 
                }}
                title={
                  telemetry.cache === 'hit'
                    ? 'Cached Response — $0.00 Incurred (Upstream token cost eliminated)'
                    : `Total Transaction Cost: ${formatCurrency(telemetry.costUsd)} (${telemetry.promptTokens || 0} prompt + ${telemetry.completionTokens || 0} completion tokens)`
                }
              >
                <Coins size={11} style={{ color: telemetry.cache === 'hit' ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
                {executing && !telemetry.isFinalized ? (
                  <span style={{ color: 'var(--accent-cyan)' }}>Streaming...</span>
                ) : (
                  <span>
                    {formatCurrency(telemetry.costUsd)}
                    {telemetry.cache === 'hit' && (
                      <span style={{ fontSize: '0.625rem', color: 'var(--accent-emerald)', marginLeft: '0.25rem', fontWeight: 700 }}>
                        (Cached)
                      </span>
                    )}
                  </span>
                )}
              </span>

              {telemetry.fallback && (
                <span 
                  className="font-mono" 
                  style={{ 
                    fontSize: '0.7rem', 
                    padding: '0.15rem 0.5rem', 
                    borderRadius: 4, 
                    fontWeight: 700, 
                    background: 'rgba(245, 158, 11, 0.12)', 
                    color: 'var(--accent-amber)', 
                    border: '1px solid rgba(245, 158, 11, 0.25)', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.3rem' 
                  }}
                  title="Request Recovered via Automated Fast-Failover Fallback"
                >
                  <AlertTriangle size={11} />
                  <span>FAILOVER</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Output Actions: Markdown/Raw Mode Toggle, Copy & Clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {responseContent && (
            <div 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                background: 'var(--bg-canvas)', 
                border: '1px solid var(--border-subtle)', 
                borderRadius: 6, 
                padding: '0.15rem' 
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('markdown')}
                className="font-mono"
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: viewMode === 'markdown' ? 'var(--bg-card-hover)' : 'transparent',
                  color: viewMode === 'markdown' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'markdown' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none'
                }}
                title="Render formatted Markdown"
              >
                <FileText size={11} />
                <span>Markdown</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className="font-mono"
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: viewMode === 'raw' ? 'var(--bg-card-hover)' : 'transparent',
                  color: viewMode === 'raw' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'raw' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none'
                }}
                title="View raw plain text / JSON response"
              >
                <Code size={11} />
                <span>Raw</span>
              </button>
            </div>
          )}

          {responseContent && (
            <>
              <button
                type="button"
                onClick={copyResponseToClipboard}
                className="btn btn-outline btn-sm font-mono"
                style={{
                  padding: '0.25rem 0.55rem',
                  height: 26,
                  fontSize: '0.72rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  color: copiedResponse ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                  borderColor: copiedResponse ? 'var(--accent-emerald)' : 'var(--border-subtle)',
                  background: copiedResponse ? 'rgba(16, 185, 129, 0.08)' : 'transparent'
                }}
                title="Copy response markdown to clipboard"
              >
                {copiedResponse ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedResponse ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handleClearOutput}
                className="btn btn-outline btn-sm"
                style={{ padding: '0.25rem 0.45rem', height: 26, color: 'var(--text-muted)' }}
                title="Clear response output"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Unified Enterprise Route & Decision Banner */}
      {telemetry?.routeReason && (
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: '0.45rem 0.75rem',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <Zap size={13} style={{ color: 'var(--accent-lime)', flexShrink: 0 }} />
            <span style={{ 
              fontWeight: 700, 
              color: 'var(--text-secondary)', 
              letterSpacing: '0.02em', 
              fontSize: '0.6875rem',
              textTransform: 'uppercase'
            }}>
              Gateway Routing:
            </span>
            <span className="font-mono" style={{ color: 'var(--text-code)' }}>{telemetry.routeReason}</span>
          </div>
          {telemetry.retries > 0 && (
            <span className="font-mono" style={{ color: 'var(--accent-amber)', fontWeight: 600, fontSize: '0.6875rem' }}>
              ({telemetry.retries} retries absorbed)
            </span>
          )}
        </div>
      )}

      {/* Scrollable Response Stream Body */}
      <div 
        ref={responseContainerRef}
        className="response-output-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '1.25rem',
          fontFamily: viewMode === 'markdown' ? 'inherit' : 'var(--font-mono)',
          fontSize: '0.875rem',
          lineHeight: 1.65,
          overflowY: 'auto',
          whiteSpace: viewMode === 'markdown' ? 'normal' : 'pre-wrap',
          position: 'relative'
        }}
      >
        {errorInfo ? (
          <div style={{ color: 'var(--accent-rose)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <XCircle size={18} />
              <span>{errorInfo.type || 'Inference Error'}</span>
            </div>
            <div style={{ fontSize: '0.8125rem' }}>{errorInfo.message}</div>
            {errorInfo.code && <div className="font-mono" style={{ fontSize: '0.75rem' }}>Code: {errorInfo.code}</div>}
          </div>
        ) : responseContent ? (
          viewMode === 'markdown' ? (
            <MarkdownRenderer content={responseContent} executing={executing} />
          ) : (
            <pre style={{ 
              margin: 0, 
              fontFamily: 'var(--font-mono)', 
              fontSize: '0.8125rem', 
              lineHeight: 1.6, 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word', 
              color: 'var(--text-code)' 
            }}>
              {responseContent}
              {executing && (
                <span style={{
                  display: 'inline-block',
                  width: 7,
                  height: 15,
                  backgroundColor: 'var(--accent-primary)',
                  marginLeft: 4,
                  verticalAlign: 'middle',
                  animation: 'pulse 1s infinite'
                }} />
              )}
            </pre>
          )
        ) : executing ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="pulse-indicator" />
            <span>Awaiting first token from upstream inference provider...</span>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Terminal size={32} style={{ opacity: 0.3 }} />
            <div style={{ maxWidth: 360, fontSize: '0.8125rem', lineHeight: 1.5 }}>
              Select a test preset or type a prompt on the left, then click <strong>Dispatch Request</strong> to test streaming completions and dynamic model routing.
            </div>
          </div>
        )}
      </div>

      {/* Bottom Stream Status */}
      {stream && chunkCount > 0 && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.2rem' }}>
          <span className="font-mono">SSE Tokens Received: {chunkCount}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="pulse-indicator" style={{ width: 6, height: 6 }} />
            <span className="font-mono">text/event-stream</span>
          </span>
        </div>
      )}
    </div>
  );
}
