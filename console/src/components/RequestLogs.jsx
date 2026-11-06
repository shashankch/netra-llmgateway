import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getApiUrl, useGatewayUrl } from '../config/api';
import { 
  FileText, Play, Pause, Filter, Search, 
  CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronRight, RefreshCw 
} from 'lucide-react';
import Pagination from './Pagination';

export default function RequestLogs({ adminToken = 'netra-admin-demo' }) {
  const gatewayUrl = useGatewayUrl();
  const { formatCurrency } = useTheme();
  const [logs, setLogs] = useState([]);
  const [isLive, setIsLive] = useState(true);
  const [filterKey, setFilterKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalServerCount, setTotalServerCount] = useState(0);

  const eventSourceRef = useRef(null);
  const abortControllerRef = useRef(null);
  const currentPageRef = useRef(currentPage);
  const pageSizeRef = useRef(pageSize);
  const filterKeyRef = useRef(filterKey);
  const filterStatusRef = useRef(filterStatus);
  const searchTermRef = useRef(searchTerm);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  useEffect(() => {
    filterKeyRef.current = filterKey;
  }, [filterKey]);

  useEffect(() => {
    filterStatusRef.current = filterStatus;
  }, [filterStatus]);

  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  // Initial and server-paginated fetch with server-side filtering
  const fetchLogs = async (page = currentPageRef.current, size = pageSizeRef.current) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const pageParam = Math.max(0, page - 1);
      const params = new URLSearchParams();
      params.set('page', String(pageParam));
      params.set('limit', String(size));
      
      const activeKey = filterKeyRef.current;
      const activeStatus = filterStatusRef.current;
      const activeSearch = searchTermRef.current;

      if (activeKey && activeKey.trim()) {
        params.set('key', activeKey.trim());
      }
      if (activeStatus && activeStatus !== 'ALL') {
        params.set('status', activeStatus);
      }
      if (activeSearch && activeSearch.trim()) {
        params.set('search', activeSearch.trim());
      }
      const url = `/admin/logs?${params.toString()}`;
      const res = await fetch(getApiUrl(url), {
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const totalHeader = res.headers.get('X-Total-Count');
        const data = await res.json();
        const logsList = Array.isArray(data) ? data : [];
        if (totalHeader !== null && totalHeader !== undefined) {
          setTotalServerCount(parseInt(totalHeader, 10) || 0);
        } else {
          setTotalServerCount(logsList.length);
        }
        setLogs(logsList);
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        return; // Ignore stale aborted requests
      }
      console.error("Failed to load request logs", e);
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchLogs(currentPage, pageSize);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [adminToken, filterKey, filterStatus, searchTerm, currentPage, pageSize, gatewayUrl]);

  // Real-time SSE live stream listener with scoped stream-ticket authentication
  useEffect(() => {
    if (!isLive) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      return;
    }

    let isCancelled = false;
    let es = null;
    let reconnectTimeout = null;

    const connectSSE = async () => {
      try {
        let streamUrl = '/admin/logs/stream';
        // Request a short-lived, single-use ticket using standard Bearer authorization header
        const ticketRes = await fetch(getApiUrl('/admin/logs/stream-ticket'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }).catch(() => null);

        if (ticketRes && ticketRes.ok) {
          const data = await ticketRes.json().catch(() => null);
          if (data && data.ticket) {
            streamUrl = `/admin/logs/stream?ticket=${encodeURIComponent(data.ticket)}`;
          }
        } else {
          // Fallback only if ticket endpoint unavailable
          streamUrl = `/admin/logs/stream?token=${encodeURIComponent(adminToken)}`;
        }

        if (isCancelled) return;

        es = new EventSource(getApiUrl(streamUrl));
        eventSourceRef.current = es;

        es.addEventListener('log', (event) => {
          try {
            const newLog = JSON.parse(event.data);
            const statusCode = newLog.status_code !== undefined ? newLog.status_code : newLog.status;

            // Filter incoming live log against current filters
            if (filterKeyRef.current && !newLog.virtual_key?.toLowerCase().includes(filterKeyRef.current.toLowerCase())) {
              return;
            }
            if (filterStatusRef.current !== 'ALL') {
              if (filterStatusRef.current === 'ERR') {
                if (Number(statusCode) === 200) return;
              } else if (String(statusCode) !== String(filterStatusRef.current)) {
                return;
              }
            }
            if (searchTermRef.current) {
              const term = searchTermRef.current.toLowerCase();
              const matchReq = newLog.request_id?.toLowerCase().includes(term);
              const matchKey = newLog.virtual_key?.toLowerCase().includes(term);
              const matchModel = (newLog.requested_model || newLog.model)?.toLowerCase().includes(term);
              const matchReason = newLog.route_reason?.toLowerCase().includes(term);
              if (!matchReq && !matchKey && !matchModel && !matchReason) return;
            }

            setTotalServerCount(prev => prev + 1);

            setLogs(prev => {
              const isDuplicate = prev.some(l => {
                if (newLog.request_id && l.request_id) {
                  return l.request_id === newLog.request_id;
                }
                if (newLog.id && l.id) {
                  return l.id === newLog.id;
                }
                return false;
              });
              if (isDuplicate) {
                return prev;
              }
              // Only prepend when viewing first page so historical pagination isn't disrupted
              if (currentPageRef.current === 1) {
                return [newLog, ...prev.slice(0, pageSizeRef.current - 1)];
              }
              return prev;
            });
          } catch (err) {
            console.error("Failed to parse live log SSE event", err);
          }
        });

        es.onerror = () => {
          if (isCancelled) return;
          if (es) {
            es.close();
          }
          reconnectTimeout = setTimeout(() => {
            if (!isCancelled && isLive) {
              connectSSE();
            }
          }, 3000);
        };
      } catch (e) {
        console.error("SSE stream initialization error", e);
      }
    };

    connectSSE();

    // Safety sync every 10s to ensure complete historical sync using latest refs
    const interval = setInterval(() => {
      fetchLogs(currentPageRef.current, pageSizeRef.current);
    }, 10000);

    return () => {
      isCancelled = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (es) {
        es.close();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      clearInterval(interval);
    };
  }, [isLive, adminToken, gatewayUrl]);

  // Bulletproof client-side filtering on logs to guarantee strict consistency under live traffic
  const displayedLogs = logs.filter(log => {
    const code = log.status_code !== undefined ? log.status_code : log.status;
    if (filterStatus !== 'ALL') {
      if (filterStatus === 'ERR') {
        if (Number(code) === 200) return false;
      } else if (String(code) !== String(filterStatus)) {
        return false;
      }
    }
    if (filterKey && filterKey.trim()) {
      if (!log.virtual_key?.toLowerCase().includes(filterKey.trim().toLowerCase())) {
        return false;
      }
    }
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const matchReq = log.request_id?.toLowerCase().includes(term);
      const matchKey = log.virtual_key?.toLowerCase().includes(term);
      const matchModel = (log.requested_model || log.model)?.toLowerCase().includes(term);
      const matchReason = log.route_reason?.toLowerCase().includes(term);
      if (!matchReq && !matchKey && !matchModel && !matchReason) return false;
    }
    return true;
  });

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
          <button 
            onClick={() => fetchLogs(currentPage, pageSize)} 
            disabled={loading}
            className="btn btn-secondary btn-sm" 
            title="Refresh Logs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
          {['ALL', '200', '429', '402', '401', '502', 'ERR'].map(st => (
            <button
              key={st}
              onClick={() => { setFilterStatus(st); setCurrentPage(1); }}
              className={`btn btn-sm ${filterStatus === st ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
            >
              {st === 'ERR' ? 'All Errors' : st}
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
              {displayedLogs.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'var(--bg-canvas)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)'
                      }}>
                        <Filter size={20} />
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                        No request logs found
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: 420 }}>
                        {filterStatus !== 'ALL' || filterKey || searchTerm
                          ? `No live or historical requests matching ${filterStatus !== 'ALL' ? `HTTP status ${filterStatus}` : ''} ${filterKey ? `key "${filterKey}"` : ''} ${searchTerm ? `search "${searchTerm}"` : ''}`
                          : 'No requests processed yet. Send queries via the Playground or OpenAI SDK to stream real-time logs.'}
                      </div>
                      {(filterStatus !== 'ALL' || filterKey || searchTerm) && (
                        <button
                          onClick={() => {
                            setFilterStatus('ALL');
                            setFilterKey('');
                            setSearchTerm('');
                            setCurrentPage(1);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: '0.25rem' }}
                        >
                          Clear Active Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedLogs.map(log => {
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
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 22,
                            padding: '0 0.5rem',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                            borderRadius: 4,
                            background: 'var(--bg-canvas)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-subtle)',
                            lineHeight: 1,
                            whiteSpace: 'nowrap'
                          }}>
                            {log.requested_model}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {log.resolved_provider ? `${log.resolved_provider}/${log.resolved_model}` : '—'}
                            </span>
                            {log.fallback && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                height: 18,
                                padding: '0 0.35rem',
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                borderRadius: 3,
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: 'var(--accent-amber)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                lineHeight: 1
                              }} title={`Failover candidate triggered (${log.retries || 1} retry)`}>
                                FALLBACK
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 22,
                            minWidth: 42,
                            padding: '0 0.45rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            borderRadius: 4,
                            background: is200 ? 'rgba(16, 185, 129, 0.12)' : (log.status_code === 429 || log.status_code === 402 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                            color: is200 ? 'var(--accent-emerald)' : (log.status_code === 429 || log.status_code === 402 ? 'var(--accent-amber)' : 'var(--accent-rose)'),
                            border: `1px solid ${is200 ? 'rgba(16, 185, 129, 0.25)' : (log.status_code === 429 || log.status_code === 402 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)')}`,
                            lineHeight: 1
                          }}>
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
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 22,
                            minWidth: 46,
                            padding: '0 0.45rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            borderRadius: 4,
                            background: log.cache === 'hit' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-canvas)',
                            color: log.cache === 'hit' ? 'var(--accent-emerald)' : 'var(--text-muted)',
                            border: `1px solid ${log.cache === 'hit' ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-subtle)'}`,
                            lineHeight: 1,
                            letterSpacing: '0.04em'
                          }}>
                            {String(log.cache || 'miss').toUpperCase()}
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
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block', marginBottom: '0.2rem' }}>Route Reason:</span>
                                <span className="badge badge-neutral font-mono" style={{ fontSize: '0.7rem', height: 22, padding: '0 0.5rem', display: 'inline-flex', alignItems: 'center' }}>
                                  {log.route_reason || 'direct_ingress'}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block', marginBottom: '0.2rem' }}>Token Usage:</span>
                                <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                  Prompt: <span style={{ color: 'var(--accent-cyan)' }}>{log.prompt_tokens ?? 0}</span> · Output: <span style={{ color: 'var(--accent-emerald)' }}>{log.completion_tokens ?? 0}</span>
                                </span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block', marginBottom: '0.2rem' }}>Failover &amp; Retries:</span>
                                <span className={`badge ${log.fallback ? 'badge-warning' : 'badge-neutral'} font-mono`} style={{ fontSize: '0.7rem', height: 22, padding: '0 0.5rem', display: 'inline-flex', alignItems: 'center' }}>
                                  {log.fallback ? `Fallback Triggered (${log.retries || 0} retries)` : `Primary Route (${log.retries || 0} retries)`}
                                </span>
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
        {totalServerCount > 0 && displayedLogs.length > 0 && (
          <Pagination
            totalItems={totalServerCount}
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

