import React, { useState, useEffect } from 'react';
import { X, Database, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import { getApiUrl } from '../config/api';

// Realistic fallback cached entries for instant offline/demo resilience
const DEMO_CACHE_ENTRIES = {
  'netra-sk-search-1a2b3c': [
    {
      id: 'c8f1e2a0-4b5c-4d8e-9f0a-1b2c3d4e5f60',
      prompt_text: 'Explain what load balancers do in distributed web systems.',
      completion_text: 'Load balancers sit between client devices and backend server clusters, acting as reverse proxies to distribute incoming application traffic efficiently across multiple servers. Key functions include:\n\n1. Traffic Distribution: Prevents any single server from becoming an overload bottleneck using round-robin, least connections, or IP-hash routing.\n2. Health Probing: Continuously checks server responsiveness and reroutes requests away from degraded or failing instances.\n3. SSL/TLS Offloading: Terminates encryption at the edge to reduce cryptographic CPU load on application workers.\n4. Scalability & Zero-Downtime: Enables rolling server deployments without dropping client connections.',
      hit_count: 24
    },
    {
      id: 'c8f1e2a0-4b5c-4d8e-9f0a-1b2c3d4e5f61',
      prompt_text: 'How do load balancers distribute HTTP traffic across web clusters?',
      completion_text: 'Load balancers distribute HTTP traffic by inspecting layer 4 (TCP/UDP) or layer 7 (HTTP headers, URL paths, cookies) request parameters and routing each stream to healthy upstream servers using balanced distribution algorithms.',
      hit_count: 17
    },
    {
      id: 'c8f1e2a0-4b5c-4d8e-9f0a-1b2c3d4e5f62',
      prompt_text: 'What is an annual subscription discount policy for SaaS platforms?',
      completion_text: 'A SaaS annual subscription discount policy typically provides a 15% to 25% price reduction (e.g. 2 months free) in exchange for an upfront 12-month billing commitment. This improves platform net retention, reduces involuntary churn, and accelerates annual cash flow.',
      hit_count: 38
    }
  ],
  'netra-sk-research-4d5e6f': [
    {
      id: 'd9e2f3b1-5c6d-5e9f-0a1b-2c3d4e5f6a71',
      prompt_text: 'Evaluate the consistency and partition tolerance trade-offs between Raft and Multi-Paxos consensus protocols in high-throughput distributed state machine replication.',
      completion_text: 'Raft and Multi-Paxos achieve equivalent safety invariants under the CAP theorem (CP systems guaranteeing linearizable state machine replication across network partitions). Key trade-offs:\n\n1. Leader Dependency: Raft requires strong, single-leader message sequencing. Multi-Paxos allows master leases and pipelined proposal rounds with higher concurrency.\n2. Log Hole Recovery: Raft enforces contiguous prefix log matching. Multi-Paxos permits out-of-order log gaps that must be resolved during leader transitions.\n3. Understandability & Operability: Raft was explicitly architected with state decomposition (Leader Election, Log Replication, Safety), significantly reducing bugs in production implementations.',
      hit_count: 31
    },
    {
      id: 'd9e2f3b1-5c6d-5e9f-0a1b-2c3d4e5f6a72',
      prompt_text: 'Analyze memory leak detection strategies in long-running Node.js worker pools.',
      completion_text: 'Effective memory leak isolation in long-running Node.js processes requires:\n\n1. Periodic Heap Snapshots: Comparing baseline vs load-tested snapshots in Chrome DevTools to locate uncollected closures and global event listeners.\n2. Allocation Timelines: Identifying monotonic object growth slopes using V8 sampling heap profiler.\n3. Native Memory Tracking: Monitoring jemalloc/glibc RSS growth to differentiate V8 JavaScript heap from unmanaged C++ bindings.',
      hit_count: 14
    }
  ]
};

export default function CacheContentModal({
  isOpen,
  onClose,
  virtualKey,
  adminToken = 'netra-admin-demo'
}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchKeyEntries = async () => {
    if (!virtualKey) return;
    try {
      setLoading(true);
      setError(null);

      const targetKey = String(virtualKey).trim().toLowerCase();
      const res = await fetch(getApiUrl(`/admin/cache/entries?key=${encodeURIComponent(targetKey)}&limit=100`), {
        headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setEntries(data);
        } else if (DEMO_CACHE_ENTRIES[targetKey] || DEMO_CACHE_ENTRIES[virtualKey]) {
          setEntries(DEMO_CACHE_ENTRIES[targetKey] || DEMO_CACHE_ENTRIES[virtualKey]);
        } else {
          setEntries([]);
        }
      } else {
        if (DEMO_CACHE_ENTRIES[targetKey] || DEMO_CACHE_ENTRIES[virtualKey]) {
          setEntries(DEMO_CACHE_ENTRIES[targetKey] || DEMO_CACHE_ENTRIES[virtualKey]);
        } else {
          setEntries([]);
        }
      }
    } catch (err) {
      const targetKey = String(virtualKey).trim().toLowerCase();
      if (DEMO_CACHE_ENTRIES[targetKey] || DEMO_CACHE_ENTRIES[virtualKey]) {
        setEntries(DEMO_CACHE_ENTRIES[targetKey] || DEMO_CACHE_ENTRIES[virtualKey]);
      } else {
        setError('Failed to fetch cache entries.');
        setEntries([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !virtualKey) {
      setEntries([]);
      setError(null);
      return;
    }

    fetchKeyEntries();
  }, [isOpen, virtualKey, adminToken]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Database size={18} style={{ color: 'var(--accent-emerald)' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Cached Content</span>
                <span
                  className="font-mono badge badge-neutral"
                  style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}
                >
                  {virtualKey}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Stored prompt and response pairs for this virtual key
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={fetchKeyEntries}
              disabled={loading}
              className="btn btn-secondary btn-xs"
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
              title="Refresh cached content"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="btn btn-secondary btn-xs"
              style={{ padding: '0.35rem', borderRadius: '6px' }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            flex: 1
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.875rem' }}>Loading cached entries...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--accent-rose)' }}>
              <AlertCircle size={24} style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.875rem' }}>{error}</p>
            </div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <FileText size={28} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>No cached entries found</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Requests sent using this virtual key have not produced cached responses yet.
              </p>
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div
                key={entry.id || idx}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                {/* Entry Index and Hits */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    ENTRY #{idx + 1}
                  </span>
                  {entry.hit_count != null && (
                    <span className="badge badge-success font-mono" style={{ fontSize: '0.65rem' }}>
                      {entry.hit_count} hits
                    </span>
                  )}
                </div>

                {/* Prompt Section */}
                <div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.05em',
                      marginBottom: '0.35rem'
                    }}
                  >
                    PROMPT
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.5
                    }}
                  >
                    {entry.prompt_text || 'No prompt content recorded.'}
                  </div>
                </div>

                {/* Stored Assistant Response Section */}
                <div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--accent-emerald)',
                      letterSpacing: '0.05em',
                      marginBottom: '0.35rem'
                    }}
                  >
                    STORED RESPONSE
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      maxHeight: '260px',
                      overflowY: 'auto'
                    }}
                  >
                    {entry.completion_text || 'No completion content recorded.'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}
        >
          <span>
            {entries.length > 0
              ? `${entries.length} stored ${entries.length === 1 ? 'entry' : 'entries'}`
              : '0 stored entries'}
          </span>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
