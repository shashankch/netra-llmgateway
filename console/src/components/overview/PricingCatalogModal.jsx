import React, { useState, useMemo } from 'react';
import Pagination from '../Pagination';
import { DEFAULT_PRICING_MODELS, formatProviderName } from '../../constants/pricingCatalog';
import { Coins, RefreshCw, X, Search } from 'lucide-react';

export default function PricingCatalogModal({
  isOpen,
  onClose,
  pricing,
  fetchPricingCatalog,
  isFetchingPricing,
  currency,
  formatCurrency,
  getModelContextWindow,
  getModelTierBadge
}) {
  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingProviderFilter, setPricingProviderFilter] = useState('ALL');
  const [pricingPage, setPricingPage] = useState(1);
  const [pricingPageSize, setPricingPageSize] = useState(10);

  const rawPricingModels = useMemo(() => {
    const liveModels = Array.isArray(pricing?.models) ? pricing.models : [];
    if (liveModels.length === 0) return DEFAULT_PRICING_MODELS;

    const liveMap = new Map(liveModels.map(m => [m.model, m]));
    const merged = DEFAULT_PRICING_MODELS.map(def => {
      const live = liveMap.get(def.model);
      if (live) {
        return {
          ...def,
          input_per_1m: live.input_per_1m ?? live.inputPer1m ?? def.input_per_1m,
          output_per_1m: live.output_per_1m ?? live.outputPer1m ?? def.output_per_1m,
          provider: live.provider || def.provider
        };
      }
      return def;
    });

    for (const live of liveModels) {
      if (!DEFAULT_PRICING_MODELS.some(d => d.model === live.model)) {
        merged.push({
          model: live.model,
          provider: live.provider || 'custom',
          input_per_1m: live.input_per_1m ?? live.inputPer1m ?? 0.0,
          output_per_1m: live.output_per_1m ?? live.outputPer1m ?? 0.0,
          context_window: live.context_window || '128k',
          alias: 'auto'
        });
      }
    }
    return merged;
  }, [pricing]);

  const pricingProvidersList = ['ALL', ...Array.from(new Set(rawPricingModels.map(m => m.provider.toLowerCase())))];

  const filteredPricingModels = rawPricingModels.filter(m => {
    const matchesSearch = !pricingSearch ||
      m.model.toLowerCase().includes(pricingSearch.toLowerCase()) ||
      m.provider.toLowerCase().includes(pricingSearch.toLowerCase());
    const matchesProvider = pricingProviderFilter === 'ALL' ||
      m.provider.toLowerCase() === pricingProviderFilter.toLowerCase();
    return matchesSearch && matchesProvider;
  });

  const paginatedPricingModels = filteredPricingModels.slice(
    (pricingPage - 1) * pricingPageSize,
    pricingPage * pricingPageSize
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: 960, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(101, 163, 13, 0.12)',
              border: '1px solid rgba(101, 163, 13, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-lime)'
            }}>
              <Coins size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                  Model Pricing &amp; Context Explorer
                </h3>
                <span className="badge badge-neutral font-mono" style={{ fontSize: '0.65rem', padding: '0.12rem 0.5rem' }}>
                  {rawPricingModels.length} Models
                </span>
                {pricing?.models && pricing.models.length > 0 && (
                  <span className="badge badge-success font-mono" style={{ fontSize: '0.65rem', padding: '0.12rem 0.5rem' }}>
                    LIVE SYNC
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', margin: 0 }}>
                Active catalog pricing, token rates per 1M tokens, and context window limits ({currency})
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={fetchPricingCatalog}
              disabled={isFetchingPricing}
              className="btn btn-outline btn-sm font-mono"
              style={{ height: 32, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0 0.65rem' }}
              title="Refresh pricing catalog from control plane"
            >
              <RefreshCw size={13} className={isFetchingPricing ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            <button 
              onClick={onClose} 
              className="btn btn-secondary btn-sm" 
              style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Enterprise Model Search & Provider Filter Toolbar */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          background: 'var(--bg-canvas)',
          borderRadius: 10,
          border: '1px solid var(--border-subtle)',
          marginBottom: '1rem'
        }}>
          {/* Row 1: Search Input & Result Count Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 300px', maxWidth: 460 }}>
              <Search size={15} style={{ position: 'absolute', left: '0.85rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search models, providers, context sizes..."
                value={pricingSearch}
                onChange={e => {
                  setPricingSearch(e.target.value);
                  setPricingPage(1);
                }}
                className="input-text font-mono"
                style={{
                  width: '100%',
                  height: 36,
                  paddingLeft: '2.4rem',
                  paddingRight: pricingSearch ? '2.4rem' : '0.85rem',
                  fontSize: '0.8125rem'
                }}
              />
              {pricingSearch && (
                <button
                  onClick={() => {
                    setPricingSearch('');
                    setPricingPage(1);
                  }}
                  style={{
                    position: 'absolute',
                    right: '0.65rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 3
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span className="font-mono">
                Showing <strong>{filteredPricingModels.length}</strong> of <strong>{rawPricingModels.length}</strong> models
              </span>
              {(pricingSearch || pricingProviderFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setPricingSearch('');
                    setPricingProviderFilter('ALL');
                    setPricingPage(1);
                  }}
                  className="btn btn-outline btn-sm font-mono"
                  style={{ height: 26, padding: '0 0.5rem', fontSize: '0.7rem', color: 'var(--accent-primary)' }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Provider Filter Pills */}
          <div 
            className="provider-pills-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              overflowX: 'auto',
              paddingBottom: '0.2rem',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {pricingProvidersList.map(prov => {
              const isActive = pricingProviderFilter.toLowerCase() === prov.toLowerCase();
              const count = prov === 'ALL' 
                ? rawPricingModels.length 
                : rawPricingModels.filter(m => m.provider.toLowerCase() === prov.toLowerCase()).length;
              return (
                <button
                  key={prov}
                  type="button"
                  onClick={() => {
                    setPricingProviderFilter(prov);
                    setPricingPage(1);
                  }}
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}`}
                  style={{
                    height: 28,
                    padding: '0 0.65rem',
                    fontSize: '0.75rem',
                    borderRadius: 6,
                    fontWeight: isActive ? 700 : 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{formatProviderName(prov)}</span>
                  <span 
                    className="font-mono"
                    style={{
                      fontSize: '0.65rem',
                      opacity: isActive ? 0.9 : 0.6,
                      fontWeight: 700
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="table-container" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Model Identifier</th>
                <th>Provider</th>
                <th>Input / 1M Tokens</th>
                <th>Output / 1M Tokens</th>
                <th>Context Limit</th>
                <th>Routing Tier</th>
              </tr>
            </thead>
            <tbody>
              {filteredPricingModels.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                    No models match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedPricingModels.map(m => (
                  <tr key={m.model}>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{m.model}</td>
                    <td>
                      <span className="badge badge-neutral font-mono" style={{ fontSize: '0.68rem', padding: '0.12rem 0.45rem' }}>
                        {formatProviderName(m.provider)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--accent-lime)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(m.input_per_1m ?? m.inputPer1m)}
                    </td>
                    <td style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(m.output_per_1m ?? m.outputPer1m)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {m.context_window || getModelContextWindow(m.model)}
                    </td>
                    <td>{getModelTierBadge(m.model)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredPricingModels.length > 0 && (
          <Pagination
            totalItems={filteredPricingModels.length}
            pageSize={pricingPageSize}
            currentPage={pricingPage}
            onPageChange={setPricingPage}
            onPageSizeChange={size => {
              setPricingPageSize(size);
              setPricingPage(1);
            }}
            pageSizeOptions={[5, 10, 20, 50]}
          />
        )}

        <div className="modal-footer-pills" style={{ marginTop: '1rem' }}>
          <div className="modal-footer-item">
            <span className="modal-footer-dot" style={{ background: 'var(--accent-lime)' }} />
            <span>Exchange rate calculated dynamically via live forex feed</span>
          </div>
          <div className="modal-footer-item" style={{ justifyContent: 'flex-end' }}>
            <span className="modal-footer-dot" style={{ background: 'var(--accent-cyan)' }} />
            <span>Synchronized with active provider rate cards</span>
          </div>
        </div>
      </div>
    </div>
  );
}
