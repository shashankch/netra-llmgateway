import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getApiUrl } from '../config/api';
import { 
  Key, Plus, Edit2, Trash2, ShieldCheck, Check, 
  X, RefreshCw, AlertCircle, Sparkles, Copy, Search, Filter, Gauge, Database
} from 'lucide-react';
import Pagination from './Pagination';

export default function VirtualKeys({ adminToken = 'netra-admin-demo', onOpenAdminModal }) {
  const { formatCurrency, currency } = useTheme();
  const [keys, setKeys] = useState(() => {
    try {
      const cached = sessionStorage.getItem(`netra_tenant_keys_${adminToken || 'demo'}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem(`netra_tenant_keys_loaded_${adminToken || 'demo'}`);
    } catch {
      return true;
    }
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copiedKey, setCopiedKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const isDemoToken = !adminToken || adminToken === 'netra-admin-demo';

  const copyKeyToClipboard = (keyStr) => {
    navigator.clipboard.writeText(keyStr);
    setCopiedKey(keyStr);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // New key form state
  const [newKey, setNewKey] = useState({
    virtual_key: '',
    team: '',
    rpm_limit: 60,
    monthly_budget_usd: 100,
    model_allowlist: ['fast', 'smart', 'auto'],
    semantic_cache_enabled: true,
    similarity_threshold: 0.850
  });

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl('/admin/keys'), {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
        try {
          sessionStorage.setItem(`netra_tenant_keys_${adminToken || 'demo'}`, JSON.stringify(data));
          sessionStorage.setItem(`netra_tenant_keys_loaded_${adminToken || 'demo'}`, 'true');
        } catch {}
      }
    } catch (e) {
      console.error("Failed to load virtual keys", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [adminToken]);

  // Lock background body scroll and dismiss on Escape when modal is active
  useEffect(() => {
    const hasOpenModal = Boolean(showCreateModal || editTarget);
    if (hasOpenModal) {
      document.body.classList.add('modal-open');
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setShowCreateModal(false);
          setEditTarget(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.classList.remove('modal-open');
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [showCreateModal, editTarget]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError(null);
    try {
      const res = await fetch(getApiUrl('/admin/keys'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(newKey)
      });
      if (res.ok) {
        setShowCreateModal(false);
        setModalError(null);
        fetchKeys();
        setNewKey({
          virtual_key: '',
          team: '',
          rpm_limit: 60,
          monthly_budget_usd: 100,
          model_allowlist: ['fast', 'smart', 'auto'],
          semantic_cache_enabled: true,
          similarity_threshold: 0.850
        });
      } else {
        const errData = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
        setModalError(errData.error?.message || errData.message || `Failed to create virtual key (HTTP ${res.status})`);
      }
    } catch (err) {
      setModalError("Error creating virtual key: " + err.message);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    setModalError(null);
    try {
      const res = await fetch(getApiUrl(`/admin/keys/${editTarget.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          team: editTarget.team,
          rpm_limit: editTarget.rpm_limit,
          monthly_budget_usd: editTarget.monthly_budget_usd,
          model_allowlist: editTarget.model_allowlist,
          semantic_cache_enabled: editTarget.semantic_cache_enabled,
          similarity_threshold: editTarget.similarity_threshold,
          is_active: editTarget.is_active
        })
      });
      if (res.ok) {
        setEditTarget(null);
        setModalError(null);
        fetchKeys();
      } else {
        const errData = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
        setModalError(errData.error?.message || errData.message || `Failed to update virtual key (HTTP ${res.status})`);
      }
    } catch (err) {
      setModalError("Error updating virtual key: " + err.message);
    }
  };

  const handleRevoke = async (id, virtualKey) => {
    if (!window.confirm(`Revoke key ${virtualKey}? Incoming requests will receive HTTP 401.`)) return;
    try {
      const res = await fetch(getApiUrl(`/admin/keys/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        fetchKeys();
      } else {
        const errData = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
        alert(errData.error?.message || errData.message || `Failed to revoke virtual key (HTTP ${res.status})`);
      }
    } catch (err) {
      alert("Error revoking virtual key: " + err.message);
    }
  };

  const filteredKeys = keys.filter(k => {
    if (statusFilter !== 'ALL') {
      const budgetNum = Number(k.monthly_budget_usd);
      const spendNum = Number(k.current_spend_usd) || 0;
      const isExhausted = k.status === 'EXHAUSTED' || (budgetNum > 0 && spendNum >= budgetNum);
      const isActive = k.is_active && !isExhausted;
      const isRevoked = !k.is_active;

      if (statusFilter === 'ACTIVE' && !isActive) return false;
      if (statusFilter === 'EXHAUSTED' && !isExhausted) return false;
      if (statusFilter === 'REVOKED' && !isRevoked) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchKey = k.virtual_key?.toLowerCase().includes(q);
      const matchTeam = k.team?.toLowerCase().includes(q);
      return matchKey || matchTeam;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            API Keys &amp; Governance
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage API keys, rate limits, monthly budgets, and model access controls.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={fetchKeys} 
            disabled={loading}
            className="btn btn-secondary btn-sm" 
            title="Refresh API Keys"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
            <Plus size={14} />
            <span>Create API Key</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-text font-mono"
            placeholder="Search by key name or team..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            style={{ paddingLeft: '2rem', fontSize: '0.8125rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
          {['ALL', 'ACTIVE', 'EXHAUSTED', 'REVOKED'].map(st => (
            <button
              key={st}
              onClick={() => { setStatusFilter(st); setPage(1); }}
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Keys Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Virtual Key</th>
                <th>Team / Tenant</th>
                <th>Rate Limit</th>
                <th style={{ minWidth: 170 }}>Monthly Budget &amp; Spend</th>
                <th>Model Allowlist</th>
                <th>Semantic Cache</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
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
                        <Key size={20} />
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                        No virtual keys found
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: 360 }}>
                        {searchQuery || statusFilter !== 'ALL'
                          ? `No keys matching active filters. Try clearing your search or status query.`
                          : 'No virtual keys provisioned yet. Click Create API Key above to provision a tenant key.'}
                      </div>
                      {(searchQuery || statusFilter !== 'ALL') && (
                        <button
                          onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setPage(1); }}
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: '0.25rem' }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredKeys.slice((page - 1) * pageSize, page * pageSize).map(k => {
                  const isCopied = copiedKey === k.virtual_key;
                  const budgetNum = Number(k.monthly_budget_usd);
                  const spendNum = Number(k.current_spend_usd) || 0;
                  const rawPercent = budgetNum > 0 ? (spendNum / budgetNum) * 100 : 0;
                  const spendPercentDisplay = rawPercent > 0 && rawPercent < 1 ? '<1%' : `${Math.min(100, Math.round(rawPercent))}%`;
                  const visualBarWidth = spendNum > 0 ? Math.max(3, Math.min(100, rawPercent)) : 0;
                  const isExhausted = k.status === 'EXHAUSTED' || (budgetNum > 0 && spendNum >= budgetNum);

                  return (
                    <tr key={k.virtual_key}>
                      {/* Virtual Key Column with Quick Copy */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span 
                            className="font-mono" 
                            style={{ 
                              fontWeight: 700, 
                              color: 'var(--accent-primary)',
                              fontSize: '0.8125rem',
                              letterSpacing: '-0.01em'
                            }}
                          >
                            {k.virtual_key}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyKeyToClipboard(k.virtual_key)}
                            className="btn btn-outline btn-sm font-mono"
                            style={{
                              padding: '0.2rem 0.45rem',
                              height: 24,
                              fontSize: '0.7rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              color: isCopied ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                              borderColor: isCopied ? 'var(--accent-emerald)' : 'var(--border-subtle)',
                              background: isCopied ? 'rgba(16, 185, 129, 0.08)' : 'transparent'
                            }}
                            title="Copy virtual key to clipboard"
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                      </td>

                      {/* Team / Tenant */}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{k.team || 'Default'}</div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tenant App</span>
                      </td>

                      {/* RPM Rate Limit */}
                      <td>
                        <span className="badge badge-neutral font-mono" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Gauge size={11} />
                          <span>{k.rpm_limit} RPM</span>
                        </span>
                      </td>

                      {/* Monthly Budget & Progress Bar */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                {formatCurrency(k.current_spend_usd)}
                              </span>
                              {budgetNum > 0 && spendNum > 0 && (
                                <span className="badge badge-neutral font-mono" style={{ fontSize: '0.625rem', padding: '0.05rem 0.35rem', lineHeight: 1.2 }}>
                                  {spendPercentDisplay}
                                </span>
                              )}
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                              {budgetNum < 0 ? 'Unlimited' : `/ ${formatCurrency(budgetNum)}`}
                            </span>
                          </div>
                          {budgetNum > 0 && (
                            <div style={{
                              width: '100%',
                              height: 4,
                              background: 'var(--border-subtle)',
                              borderRadius: 2,
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${visualBarWidth}%`,
                                height: '100%',
                                background: rawPercent >= 90 ? 'var(--accent-rose)' : (rawPercent >= 70 ? 'var(--accent-amber)' : 'var(--accent-emerald)'),
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Model Allowlist */}
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {(k.model_allowlist || []).map(m => (
                            <span key={m} className="badge badge-neutral font-mono" style={{ fontSize: '0.65rem' }}>
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Semantic Cache */}
                      <td>
                        {k.semantic_cache_enabled ? (
                          <span className="badge badge-success font-mono" style={{ fontSize: '0.6875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Database size={10} />
                            <span>Sim &ge; {k.similarity_threshold}</span>
                          </span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>Bypassed</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge ${k.status === 'ACTIVE' && !isExhausted ? 'badge-success' : (isExhausted ? 'badge-warning' : 'badge-danger')}`} style={{ fontSize: '0.7rem' }}>
                          {isExhausted ? 'EXHAUSTED' : (k.status || 'ACTIVE')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            onClick={() => setEditTarget({ ...k })}
                            className="btn btn-outline btn-sm"
                            title="Edit Key Governance Limits"
                            style={{ padding: '0.25rem 0.45rem' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          {k.is_active && (
                            <button
                              onClick={() => handleRevoke(k.id, k.virtual_key)}
                              className="btn btn-outline btn-sm"
                              title="Revoke Virtual Key"
                              style={{ color: 'var(--accent-rose)', padding: '0.25rem 0.45rem' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredKeys.length > 0 && (
          <Pagination
            totalItems={filteredKeys.length}
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

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Create New Virtual Key</h3>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-outline btn-sm">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {modalError && (
                <div style={{
                  padding: '0.625rem 0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--accent-rose)',
                  color: 'var(--accent-rose)',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Team / App Name:
                </label>
                <input
                  type="text"
                  required
                  className="input-text"
                  placeholder="e.g. Finance Analytics Core"
                  value={newKey.team}
                  onChange={e => setNewKey({ ...newKey, team: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Virtual Key (Optional, auto-generated if blank):
                </label>
                <input
                  type="text"
                  className="input-text font-mono"
                  placeholder="e.g. netra-sk-finance-demo"
                  value={newKey.virtual_key}
                  onChange={e => setNewKey({ ...newKey, virtual_key: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Rate Limit (RPM):
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input-text font-mono"
                    value={newKey.rpm_limit}
                    onChange={e => setNewKey({ ...newKey, rpm_limit: parseInt(e.target.value) || 60 })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Monthly Budget (USD):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-text font-mono"
                    value={newKey.monthly_budget_usd}
                    onChange={e => setNewKey({ ...newKey, monthly_budget_usd: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Model Access Allowlist:
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {['fast', 'smart', 'auto'].map(alias => (
                    <label key={alias} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newKey.model_allowlist.includes(alias)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...newKey.model_allowlist, alias]
                            : newKey.model_allowlist.filter(m => m !== alias);
                          setNewKey({ ...newKey, model_allowlist: next });
                        }}
                      />
                      <span className="font-mono">{alias}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="newKeyCache" style={{ fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                    Enable Semantic Vector Cache
                  </label>
                  <input
                    type="checkbox"
                    id="newKeyCache"
                    checked={newKey.semantic_cache_enabled}
                    onChange={e => setNewKey({ ...newKey, semantic_cache_enabled: e.target.checked })}
                  />
                </div>
                {newKey.semantic_cache_enabled && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                      Similarity Threshold: {newKey.similarity_threshold}
                    </label>
                    <input
                      type="range"
                      min="0.75"
                      max="0.99"
                      step="0.01"
                      style={{ width: '100%' }}
                      value={newKey.similarity_threshold}
                      onChange={e => setNewKey({ ...newKey, similarity_threshold: parseFloat(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Key Modal */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Edit Virtual Key</h3>
              <button onClick={() => setEditTarget(null)} className="btn btn-outline btn-sm">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {modalError && (
                <div style={{
                  padding: '0.625rem 0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--accent-rose)',
                  color: 'var(--accent-rose)',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Virtual Key:
                </label>
                <input
                  type="text"
                  disabled
                  className="input-text font-mono"
                  value={editTarget.virtual_key}
                  style={{ opacity: 0.6 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Team / App:
                </label>
                <input
                  type="text"
                  required
                  className="input-text"
                  value={editTarget.team}
                  onChange={e => setEditTarget({ ...editTarget, team: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    RPM Limit:
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input-text font-mono"
                    value={editTarget.rpm_limit}
                    onChange={e => setEditTarget({ ...editTarget, rpm_limit: parseInt(e.target.value) || 60 })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Monthly Budget (USD):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-text font-mono"
                    value={editTarget.monthly_budget_usd}
                    onChange={e => setEditTarget({ ...editTarget, monthly_budget_usd: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Model Access Allowlist:
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {['fast', 'smart', 'auto'].map(alias => (
                    <label key={alias} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={(editTarget.model_allowlist || []).includes(alias)}
                        onChange={e => {
                          const curr = editTarget.model_allowlist || [];
                          const next = e.target.checked
                            ? [...curr, alias]
                            : curr.filter(m => m !== alias);
                          setEditTarget({ ...editTarget, model_allowlist: next });
                        }}
                      />
                      <span className="font-mono">{alias}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="editKeyCache" style={{ fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                    Enable Semantic Vector Cache
                  </label>
                  <input
                    type="checkbox"
                    id="editKeyCache"
                    checked={editTarget.semantic_cache_enabled}
                    onChange={e => setEditTarget({ ...editTarget, semantic_cache_enabled: e.target.checked })}
                  />
                </div>
                {editTarget.semantic_cache_enabled && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                      Similarity Threshold: {editTarget.similarity_threshold}
                    </label>
                    <input
                      type="range"
                      min="0.75"
                      max="0.99"
                      step="0.01"
                      style={{ width: '100%' }}
                      value={editTarget.similarity_threshold}
                      onChange={e => setEditTarget({ ...editTarget, similarity_threshold: parseFloat(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={editTarget.is_active}
                  onChange={e => setEditTarget({ ...editTarget, is_active: e.target.checked })}
                />
                <label htmlFor="activeCheck" style={{ fontSize: '0.8125rem' }}>Active Key (Uncheck to revoke access)</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setEditTarget(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

