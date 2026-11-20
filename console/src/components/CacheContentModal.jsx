import React, { useState, useEffect, useMemo } from 'react';
import { X, Database, FileText, RefreshCw, AlertCircle, Search, Tag, Cpu, Clock } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { DEMO_CACHE_ENTRIES } from '../constants/demoFallbackData';

export default function CacheContentModal({
  isOpen,
  onClose,
  virtualKey,
  adminToken = 'netra-admin-demo'
}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterModel, setFilterModel] = useState('all');

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
      setFilterSearch('');
      setFilterModel('all');
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

  // Extract unique model tiers present in entries
  const availableModels = useMemo(() => {
    const set = new Set();
    entries.forEach(e => {
      if (e.model_alias) set.add(e.model_alias);
    });
    return Array.from(set);
  }, [entries]);

  // Filter entries by search text and model tier
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (filterModel !== 'all' && e.model_alias !== filterModel) {
        return false;
      }
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase().trim();
        const p = (e.prompt_text || '').toLowerCase();
        const r = (e.completion_text || '').toLowerCase();
        const m = (e.model_alias || '').toLowerCase();
        const prov = (e.resolved_provider || '').toLowerCase();
        return p.includes(q) || r.includes(q) || m.includes(q) || prov.includes(q);
      }
      return true;
    });
  }, [entries, filterModel, filterSearch]);

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

        {/* Filter and Search Toolbar */}
        {entries.length > 0 && (
          <div
            style={{
              padding: '0.65rem 1.25rem',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-canvas)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 200px', maxWidth: '340px' }}>
              <Search size={12} style={{ position: 'absolute', left: '0.55rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Filter prompt or response..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.3rem 0.5rem 0.3rem 1.65rem',
                  fontSize: '0.75rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            {/* Model Tier Pills & Count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {availableModels.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setFilterModel('all')}
                    className={`btn btn-xs ${filterModel === 'all' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '0.6875rem', padding: '0.15rem 0.45rem', height: 22 }}
                  >
                    all
                  </button>
                  {availableModels.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFilterModel(m)}
                      className={`btn btn-xs ${filterModel === m ? 'btn-primary' : 'btn-outline'}`}
                      style={{ fontSize: '0.6875rem', padding: '0.15rem 0.45rem', height: 22 }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {filteredEntries.length} of {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
          </div>
        )}

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
          ) : filteredEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <FileText size={28} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>No cached entries found</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {entries.length > 0 ? 'No cached prompt matched your filter query.' : 'Requests sent using this virtual key have not produced cached responses yet.'}
              </p>
            </div>
          ) : (
            filteredEntries.map((entry, idx) => (
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
                {/* Entry Metadata & Hits Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      ENTRY #{idx + 1}
                    </span>
                    {entry.model_alias && (
                      <span
                        className={`badge ${entry.model_alias === 'smart' ? 'badge-alias-smart' : entry.model_alias === 'fast' ? 'badge-alias-fast' : 'badge-alias-auto'}`}
                        style={{ fontSize: '0.65rem', textTransform: 'lowercase' }}
                      >
                        {entry.model_alias}
                      </span>
                    )}
                    {entry.resolved_provider && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-secondary)',
                          background: 'var(--bg-canvas)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: 4,
                          border: '1px solid var(--border-subtle)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <Cpu size={10} />
                        <span>{entry.resolved_provider}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    {entry.created_at && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Clock size={10} />
                        <span>{new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    )}
                    {entry.hit_count != null && (
                      <span className="badge badge-success font-mono" style={{ fontSize: '0.65rem' }}>
                        {entry.hit_count} {entry.hit_count === 1 ? 'hit' : 'hits'}
                      </span>
                    )}
                  </div>
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
              ? (filteredEntries.length !== entries.length
                  ? `${filteredEntries.length} of ${entries.length} entries shown`
                  : `${entries.length} stored ${entries.length === 1 ? 'entry' : 'entries'}`)
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
