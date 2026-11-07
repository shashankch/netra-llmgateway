import React, { useState, useEffect, useMemo } from 'react';
import { getApiUrl } from '../config/api';
import { 
  Database, ShieldCheck, Zap, Layers, RefreshCw, 
  Eye, Copy, Check, Search
} from 'lucide-react';
import Pagination from './Pagination';
import CacheContentModal from './CacheContentModal';

export default function CacheInspector({ adminToken = 'netra-admin-demo', onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [filterKeyText, setFilterKeyText] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // Cache Content Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKeyForModal, setSelectedKeyForModal] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl('/admin/cache/stats'), {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to load cache stats", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [adminToken]);

  const totalEntries = stats?.total_entries || 0;
  const totalHits = stats?.total_hits || 0;
  const totalMisses = stats?.total_misses || 0;
  const hitRate = stats?.hit_rate ? (stats.hit_rate * 100).toFixed(1) : '0.0';

  const keyBreakdown = stats?.keys || {};

  // Filtered keys in table
  const filteredKeyEntries = useMemo(() => {
    const entries = Object.entries(keyBreakdown);
    if (!filterKeyText.trim()) return entries;
    const q = filterKeyText.toLowerCase().trim();
    return entries.filter(([keyName]) => keyName.toLowerCase().includes(q));
  }, [keyBreakdown, filterKeyText]);

  // Paginated key rows
  const paginatedKeyEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredKeyEntries.slice(start, start + pageSize);
  }, [filteredKeyEntries, page, pageSize]);

  // Copy key to clipboard
  const handleCopyKey = (keyName, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(keyName);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Open modal to view content for a specific key
  const handleViewContent = (keyName, e) => {
    if (e) e.stopPropagation();
    setSelectedKeyForModal(keyName);
    setIsModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>Semantic Cache</span>
            <span className="badge badge-success font-mono" style={{ fontSize: '0.7rem' }}>Smart Match</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Accelerate response times and eliminate token costs for frequent and repeated queries with tenant-isolated semantic caching.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            onClick={fetchStats} 
            disabled={loading}
            className="btn btn-secondary btn-sm" 
            title="Refresh Cache Stats"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Cached Entries</span>
            <Database size={16} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="kpi-value">{totalEntries}</div>
          <div className="kpi-subtext">Stored completions ready for retrieval</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Cache Hits</span>
            <Zap size={16} style={{ color: 'var(--accent-emerald)' }} />
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-emerald)' }}>{totalHits}</div>
          <div className="kpi-subtext">$0 token cost completions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Cache Misses</span>
            <Layers size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="kpi-value">{totalMisses}</div>
          <div className="kpi-subtext">Routed to upstream LLMs</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Global Hit Rate</span>
            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Active</span>
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>{hitRate}%</div>
          <div className="kpi-subtext">Semantic query matches</div>
        </div>
      </div>

      {/* Per-Key Cache Breakdown Table */}
      <div className="card">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
              Per-Key Cache Breakdown
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', marginBottom: 0 }}>
              Cache storage is strictly isolated per virtual key. Click &quot;View Content&quot; to quickly view stored prompt and response pairs.
            </p>
          </div>

          {/* Search Table Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-text font-mono"
                style={{ paddingLeft: '2.25rem', fontSize: '0.8125rem' }}
                placeholder="Search virtual keys..."
                value={filterKeyText}
                onChange={e => { setFilterKeyText(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Virtual Key</th>
                <th>Threshold</th>
                <th>Cached Entries</th>
                <th>Hits</th>
                <th>Misses</th>
                <th>Tenant Hit Rate</th>
                <th>Isolation</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredKeyEntries.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    {filterKeyText ? `No virtual keys matching "${filterKeyText}".` : 'No cache activity recorded yet for active virtual keys.'}
                  </td>
                </tr>
              ) : (
                paginatedKeyEntries.map(([keyName, keyStat]) => {
                  const rate = (keyStat.hit_rate * 100).toFixed(1);
                  const entryCount = keyStat.entries || 0;

                  return (
                    <tr 
                      key={keyName}
                      onClick={() => handleViewContent(keyName)}
                      style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                      title="Click to view cached content for this virtual key"
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                            {keyName}
                          </span>
                          <button
                            onClick={(e) => handleCopyKey(keyName, e)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                            title="Copy Virtual Key"
                          >
                            {copiedKey === keyName ? (
                              <Check size={12} style={{ color: 'var(--accent-emerald)' }} />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td>
                        {keyStat.cache_enabled === false ? (
                          <span className="badge badge-error font-mono" style={{ fontSize: '0.65rem' }}>Disabled</span>
                        ) : (
                          <span className="badge badge-neutral font-mono" style={{ fontSize: '0.7rem' }}>
                            {keyStat.similarity_threshold != null 
                              ? Number(keyStat.similarity_threshold).toFixed(3) 
                              : (keyName.includes('search') ? '0.920' : '0.850')}
                          </span>
                        )}
                      </td>
                      <td className="font-mono" style={{ fontWeight: 600 }}>
                        {entryCount}
                      </td>
                      <td className="font-mono" style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                        {keyStat.hits}
                      </td>
                      <td className="font-mono">{keyStat.misses}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, minWidth: '42px' }}>{rate}%</span>
                          <div style={{ width: 60, height: 4, background: 'var(--border-strong)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${rate}%`, height: '100%', background: 'var(--accent-emerald)' }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          <ShieldCheck size={12} />
                          <span>Isolated</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={(e) => handleViewContent(keyName, e)}
                          className="btn btn-secondary btn-xs"
                          style={{
                            gap: '0.35rem',
                            padding: '0.3rem 0.65rem',
                            fontSize: '0.75rem',
                            borderRadius: '6px'
                          }}
                          title="View cached content for this virtual key"
                        >
                          <Eye size={12} />
                          <span>View Content</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredKeyEntries.length > 0 && (
          <Pagination
            totalItems={filteredKeyEntries.length}
            pageSize={pageSize}
            currentPage={page}
            onPageChange={setPage}
            onPageSizeChange={size => {
              setPageSize(size);
              setPage(1);
            }}
            pageSizeOptions={[5, 10, 20]}
          />
        )}
      </div>

      {/* Key Architectural Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Zap size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>Instant Repeat Match (&lt;1ms)</span>
          </h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Sub-millisecond response delivery for identical queries at zero compute cost before reaching upstream models.
          </p>
        </div>

        <div className="card">
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Database size={16} style={{ color: 'var(--accent-primary)' }} />
            <span>Smart Semantic Match (&lt;5ms)</span>
          </h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Understands query intent beyond exact phrasing to instantly reuse high-quality completions for paraphrased prompts.
          </p>
        </div>

        <div className="card">
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ShieldCheck size={16} style={{ color: 'var(--accent-emerald)' }} />
            <span>Tenant Data Privacy</span>
          </h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Every cached response is strictly isolated to its virtual key namespace, preventing any cross-tenant data access or cache leakage.
          </p>
        </div>
      </div>

      {/* Cache Content Modal Dialog */}
      <CacheContentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        virtualKey={selectedKeyForModal}
        adminToken={adminToken}
      />
    </div>
  );
}
