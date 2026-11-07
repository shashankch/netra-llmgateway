import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({
  totalItems = 0,
  pageSize = 25,
  currentPage = 1,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [15, 25, 50, 100]
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis window
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safeCurrentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (safeCurrentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.85rem 1.25rem',
      padding: '0.85rem 1.25rem',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--bg-card)',
      borderRadius: '0 0 12px 12px',
      fontSize: '0.8125rem'
    }}>
      {/* Item Range Counter */}
      <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span>Showing</span>
        <strong style={{ color: 'var(--text-primary)' }}>{startItem.toLocaleString()}</strong>
        <span>to</span>
        <strong style={{ color: 'var(--text-primary)' }}>{endItem.toLocaleString()}</strong>
        <span>of</span>
        <strong style={{ color: 'var(--text-primary)' }}>{totalItems.toLocaleString()}</strong>
        <span>results</span>
      </div>

      {/* Pagination Controls & Page Size Selector */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.75rem' }}>Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
              style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              {pageSizeOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}

        {/* Buttons Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            onClick={() => onPageChange(1)}
            disabled={safeCurrentPage === 1}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.35rem 0.45rem', opacity: safeCurrentPage === 1 ? 0.4 : 1, cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
            title="First Page"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            onClick={() => onPageChange(safeCurrentPage - 1)}
            disabled={safeCurrentPage === 1}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.35rem 0.45rem', opacity: safeCurrentPage === 1 ? 0.4 : 1, cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
            title="Previous Page"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Page Numbers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            {getPageNumbers().map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`dots-${idx}`} style={{ padding: '0 0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    ...
                  </span>
                );
              }
              const isActive = p === safeCurrentPage;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    minWidth: 28,
                    height: 28,
                    padding: '0 0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 700 : 500
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(safeCurrentPage + 1)}
            disabled={safeCurrentPage === totalPages}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.35rem 0.45rem', opacity: safeCurrentPage === totalPages ? 0.4 : 1, cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer' }}
            title="Next Page"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={safeCurrentPage === totalPages}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.35rem 0.45rem', opacity: safeCurrentPage === totalPages ? 0.4 : 1, cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer' }}
            title="Last Page"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
