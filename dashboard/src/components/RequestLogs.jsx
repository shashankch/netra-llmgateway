import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  FileText, Play, Pause, Filter, Search, 
  CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronRight, RefreshCw 
} from 'lucide-react';
import Pagination from './Pagination';

export default function RequestLogs({ adminToken = 'netra-admin-demo' }) {
  const { formatCurrency } = useTheme();
  const [logs, setLogs] = useState([]);
  const [isLive, setIsLive] = useState(true);
  const [filterKey, setFilterKey] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const eventSourceRef = useRef(null);

  // Initial fetch
  const fetchLogs = async () => {
    try {
      const url = filterKey 
        ? `/admin/logs?key=${encodeURIComponent(filterKey)}&limit=100` 
        : `/admin/logs?limit=100`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error("Failed to load request logs", e);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [adminToken, filterKey]);

  // Real-time SSE live stream listener
  useEffect(() => {
    if (!isLive) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      return;
    }

    let es = null;
    try {
      const sseUrl = `/admin/logs/stream?token=${encodeURIComponent(adminToken)}`;
      es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.addEventListener('log', (event) => {
        try {
          const newLog = JSON.parse(event.data);
          setLogs(prev => {
            if (prev.some(l => l.id === newLog.id || l.request_id === newLog.request_id)) {
              return prev;
            }
            return [newLog, ...prev.slice(0, 199)];
          });
        } catch (err) {
          console.error("Failed to parse live log SSE event", err);
        }
      });

      es.onerror = () => {
        // Silent recovery on SSE disconnect; interval polling covers gaps
      };
    } catch (e) {
      console.error("SSE stream initialization error", e);
    }

    // Safety sync every 10s to ensure complete historical sync
    const interval = setInterval(fetchLogs, 10000);
    return () => {
      if (es) {
        es.close();
      }
      clearInterval(interval);
    };
  }, [isLive, filterKey, adminToken]);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filterStatus !== 'ALL') {
      if (filterStatus === '200' && log.status_code !== 200) return false;
      if (filterStatus === '429' && log.status_code !== 429) return false;
      if (filterStatus === '401' && log.status_code !== 401) return false;
      if (filterStatus === '402' && log.status_code !== 402) return false;
      if (filterStatus === '502' && log.status_code !== 502) return false;
      if (filterStatus === 'ERR' && (log.status_code === 200)) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchReq = log.request_id?.toLowerCase().includes(term);
      const matchKey = log.virtual_key?.toLowerCase().includes(term);
      const matchModel = log.requested_model?.toLowerCase().includes(term);
      const matchReason = log.route_reason?.toLowerCase().includes(term);
      if (!matchReq && !matchKey && !matchModel && !matchReason) return false;
    }
    return true;
  });

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Live Request Logs
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Real-time activity stream of completions, token usage, status codes, and latency.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setIsLive(!isLive)}
            className={`btn btn-sm ${isLive ? 'btn-primary' : 'btn-secondary'}`}
          >
            {isLive ? <Pause size={14} /> : <Play size={14} />}
            <span>{isLive ? 'Pause Stream' : 'Resume Stream'}</span>
            {isLive && <span className="pulse-indicator" style={{ marginLeft: 4 }} />}
          </button>
          <button onClick={fetchLogs} className="btn btn-secondary btn-sm" title="Manual Sync">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-text"
            placeholder="Search by request ID, model, or status..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{ paddingLeft: '2rem' }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
          {['ALL', '200', '429', '402', '401', '502'].map(st => (
            <button
              key={st}
              onClick={() => { setFilterStatus(st); setCurrentPage(1); }}
              className={`btn btn-sm ${filterStatus === st ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Virtual Key Filter */}
        <div style={{ minWidth: 180 }}>
          <input
            type="text"
            className="input-text font-mono"
            placeholder="Filter by key..."
            value={filterKey}
            onChange={e => { setFilterKey(e.target.value); setCurrentPage(1); }}
            style={{ fontSize: '0.75rem' }}
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Time (UTC)</th>
                <th>Request ID</th>
                <th>Virtual Key</th>
                <th>Model</th>
                <th>Provider / Target</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Cost</th>
                <th>Cache</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No audit logs matching current filter.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map(log => {
                  const isExpanded = expandedId === log.id;
                  const is200 = log.status_code === 200;
                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'now'}
                        </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-code)' }}>
                            {log.request_id?.slice(0, 14)}...
                          </span>
                        </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: '0.75rem' }}>
                            {log.virtual_key}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-neutral font-mono">{log.requested_model}</span>
                        </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: '0.75rem' }}>
                            {log.resolved_provider ? `${log.resolved_provider}/${log.resolved_model}` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${is200 ? 'badge-success' : (log.status_code === 429 || log.status_code === 402 ? 'badge-warning' : 'badge-danger')}`}>
                            {log.status_code || log.status}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: '0.75rem' }}>{log.latency_ms}ms</span>
                        </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: '0.75rem' }}>
                            {formatCurrency(log.cost_usd)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${log.cache === 'hit' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.65rem' }}>
                            {log.cache || 'miss'}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Row Detail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="10" style={{ background: 'var(--bg-canvas)', padding: '1rem 1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.8125rem' }}>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Full Request ID:</span>
                                <div className="font-mono" style={{ fontWeight: 600 }}>{log.request_id}</div>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Route Reason:</span>
                                <div className="font-mono" style={{ color: 'var(--text-code)' }}>{log.route_reason || 'direct'}</div>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Token Usage:</span>
                                <div>Prompt: {log.prompt_tokens} · Completion: {log.completion_tokens}</div>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Failover / Retries:</span>
                                <div>Fallback: {log.fallback ? 'Yes' : 'No'} · Retries: {log.retries}</div>
                              </div>
                              {log.error_type && (
                                <div>
                                  <span style={{ color: 'var(--accent-rose)' }}>Error Type:</span>
                                  <div style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>{log.error_type}</div>
                                </div>
                              )}
                            </div>
                            <pre style={{
                              background: 'var(--bg-card)',
                              padding: '0.75rem',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              overflowX: 'auto',
                              border: '1px solid var(--border-subtle)'
                            }}>
                              {JSON.stringify(log, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredLogs.length > 0 && (
          <Pagination
            totalItems={filteredLogs.length}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={size => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[15, 25, 50, 100]}
          />
        )}
      </div>
    </div>
  );
}

