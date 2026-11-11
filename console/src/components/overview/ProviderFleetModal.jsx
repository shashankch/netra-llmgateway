import React, { useState } from 'react';
import Pagination from '../Pagination';
import { X, Search } from 'lucide-react';

export default function ProviderFleetModal({
  isOpen,
  onClose,
  allProviders,
  healthyCount,
  degradedCount,
  trippedCount,
  globalAvgP95
}) {
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [providerSearch, setProviderSearch] = useState('');
  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixPageSize, setMatrixPageSize] = useState(10);

  if (!isOpen) return null;

  const filteredProviders = allProviders.filter(p => {
    const isClosed = p.circuit_state === 'CLOSED';
    const isOpenState = p.circuit_state === 'OPEN';
    const isDegraded = !isOpenState && (p.failure_rate || 0) > 10;

    let matchesFilter = true;
    if (providerFilter === 'HEALTHY') matchesFilter = isClosed && !isDegraded;
    else if (providerFilter === 'DEGRADED') matchesFilter = isDegraded;
    else if (providerFilter === 'TRIPPED') matchesFilter = isOpenState;

    const matchesSearch = !providerSearch ||
      (p.provider || '').toLowerCase().includes(providerSearch.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const paginatedMatrixProviders = filteredProviders.slice(
    (matrixPage - 1) * matrixPageSize,
    matrixPage * matrixPageSize
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: 960, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Upstream Provider Health &amp; Failover Matrix</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Continuous cluster health telemetry, latency profiles, and automated circuit breaking across upstream LLM providers
            </p>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>
            <X size={16} />
          </button>
        </div>

        {/* Modal KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configured Providers</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{allProviders.length}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Active Endpoints</div>
          </div>
          <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Operational</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{healthyCount}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Closed Circuits</div>
          </div>
          <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Degraded / Tripped</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: (degradedCount + trippedCount) > 0 ? 'var(--accent-rose)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {degradedCount + trippedCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Fast-Fail Protection</div>
          </div>
          <div style={{ padding: '0.85rem', background: 'var(--bg-canvas)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fleet p95 Latency</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{globalAvgP95}ms</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sliding Window</div>
          </div>
        </div>

        {/* Modal Search & Filter Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--bg-canvas)',
            borderRadius: 6,
            padding: 2,
            border: '1px solid var(--border-subtle)'
          }}>
            {['ALL', 'HEALTHY', 'DEGRADED', 'TRIPPED'].map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setProviderFilter(tab);
                  setMatrixPage(1);
                }}
                style={{
                  border: 'none',
                  height: '100%',
                  background: providerFilter === tab ? 'var(--bg-card)' : 'transparent',
                  color: providerFilter === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  padding: '0 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: providerFilter === tab ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {tab === 'ALL' ? `All (${allProviders.length})` :
                 tab === 'HEALTHY' ? `Healthy (${healthyCount})` :
                 tab === 'DEGRADED' ? `Degraded (${degradedCount})` :
                 `Tripped (${trippedCount})`}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.65rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search provider by name..."
              value={providerSearch}
              onChange={e => {
                setProviderSearch(e.target.value);
                setMatrixPage(1);
              }}
              style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                height: 32,
                padding: providerSearch ? '0 1.8rem 0 2rem' : '0 0.75rem 0 2rem',
                fontSize: '0.8125rem',
                color: 'var(--text-primary)',
                width: 240,
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
              }}
            />
            {providerSearch && (
              <button
                onClick={() => {
                  setProviderSearch('');
                  setMatrixPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: '0.45rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2
                }}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Tabular Breakdown */}
        <div className="table-container" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Status</th>
                <th>Circuit State</th>
                <th>Failure Rate</th>
                <th>Slow Call Rate</th>
                <th>p95 Latency</th>
                <th>Volume (OK / Err)</th>
                <th>Failover Route</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMatrixProviders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                    No upstream providers match filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedMatrixProviders.map(p => {
                  const isClosed = p.circuit_state === 'CLOSED';
                  const isOpen = p.circuit_state === 'OPEN';
                  const stateBadgeColor = isClosed ? 'badge-success' : (isOpen ? 'badge-danger' : 'badge-warning');
                  return (
                    <tr key={p.provider}>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', textTransform: 'uppercase' }}>
                        {p.provider}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                          <span style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: isClosed ? 'var(--accent-emerald)' : (isOpen ? 'var(--accent-rose)' : 'var(--accent-amber)')
                          }} />
                          {isOpen ? 'Outage' : ((p.failure_rate || 0) > 10 ? 'Degraded' : 'Operational')}
                        </span>
                      </td>
                      <td><span className={`badge ${stateBadgeColor}`}>{p.circuit_state}</span></td>
                      <td style={{ fontWeight: 600, color: p.failure_rate > 20 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                        {(p.failure_rate || 0).toFixed(1)}%
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{(p.slow_call_rate || 0).toFixed(1)}%</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        {p.p95_latency_ms != null && p.p95_latency_ms > 0 ? `${p.p95_latency_ms}ms` : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {p.successful_calls || 0} upstream ok · {p.failed_calls || 0} err
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {isOpen ? 'Fast-fail (< 0.05ms) rerouted' : 'Primary active route'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredProviders.length > 0 && (
          <Pagination
            totalItems={filteredProviders.length}
            pageSize={matrixPageSize}
            currentPage={matrixPage}
            onPageChange={setMatrixPage}
            onPageSizeChange={size => {
              setMatrixPageSize(size);
              setMatrixPage(1);
            }}
            pageSizeOptions={[5, 10, 25, 50, 100]}
          />
        )}

        <div className="modal-footer-pills" style={{ marginTop: '1rem' }}>
          <div className="modal-footer-item">
            <span className="modal-footer-dot" style={{ background: 'var(--accent-emerald)' }} />
            <span>Sub-0.05ms fast-fail rejection when circuit trips</span>
          </div>
          <div className="modal-footer-item" style={{ justifyContent: 'flex-end' }}>
            <span className="modal-footer-dot" style={{ background: 'var(--accent-cyan)' }} />
            <span>Automated sliding-window health evaluation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
