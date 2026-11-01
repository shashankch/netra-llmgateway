import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  Key, Plus, Edit2, Trash2, ShieldCheck, Check, 
  X, RefreshCw, AlertCircle, Sparkles 
} from 'lucide-react';
import Pagination from './Pagination';

export default function VirtualKeys({ adminToken = 'netra-admin-demo' }) {
  const { formatCurrency, currency } = useTheme();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
      const res = await fetch('/admin/keys', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
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

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/admin/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(newKey)
      });
      if (res.ok) {
        setShowCreateModal(false);
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
      }
    } catch (err) {
      alert("Error creating virtual key: " + err.message);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    try {
      const res = await fetch(`/admin/keys/${editTarget.id}`, {
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
        fetchKeys();
      }
    } catch (err) {
      alert("Error updating virtual key: " + err.message);
    }
  };

  const handleRevoke = async (id, virtualKey) => {
    if (!window.confirm(`Revoke key ${virtualKey}? Incoming requests will receive HTTP 401.`)) return;
    try {
      const res = await fetch(`/admin/keys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        fetchKeys();
      }
    } catch (err) {
      alert("Error revoking virtual key: " + err.message);
    }
  };

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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={fetchKeys} className="btn btn-secondary btn-sm" title="Refresh Keys">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
            <Plus size={14} />
            <span>Create API Key</span>
          </button>
        </div>
      </div>

      {/* Keys Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Virtual Key</th>
                <th>Team / App</th>
                <th>RPM Limit</th>
                <th>Monthly Budget</th>
                <th>Model Allowlist</th>
                <th>Semantic Cache</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No keys found. Click Create Virtual Key to add a tenant.
                  </td>
                </tr>
              ) : (
                keys.slice((page - 1) * pageSize, page * pageSize).map(k => (
                  <tr key={k.virtual_key}>
                    <td>
                      <div className="font-mono" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {k.virtual_key}
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{k.team}</td>
                    <td>
                      <span className="badge badge-neutral font-mono">{k.rpm_limit} RPM</span>
                    </td>
                    <td>
                      <div>{formatCurrency(k.current_spend_usd)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Cap: {k.monthly_budget_usd < 0 ? 'Unlimited' : formatCurrency(k.monthly_budget_usd)}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {(k.model_allowlist || []).map(m => (
                          <span key={m} className="badge badge-neutral font-mono" style={{ fontSize: '0.65rem' }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {k.semantic_cache_enabled ? (
                        <span className="badge badge-success font-mono" style={{ fontSize: '0.7rem' }}>
                          Sim &ge; {k.similarity_threshold}
                        </span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>Disabled</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${k.status === 'ACTIVE' ? 'badge-success' : (k.status === 'EXHAUSTED' ? 'badge-warning' : 'badge-danger')}`}>
                        {k.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => setEditTarget({ ...k })}
                          className="btn btn-outline btn-sm"
                          title="Edit Key"
                        >
                          <Edit2 size={13} />
                        </button>
                        {k.is_active && (
                          <button
                            onClick={() => handleRevoke(k.id, k.virtual_key)}
                            className="btn btn-outline btn-sm"
                            title="Revoke Key"
                            style={{ color: 'var(--accent-rose)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {keys.length > 0 && (
          <Pagination
            totalItems={keys.length}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                  Semantic Cache Similarity Threshold: {newKey.similarity_threshold}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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

