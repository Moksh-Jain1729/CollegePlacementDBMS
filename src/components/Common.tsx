import React, { useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

/**
 * Formats an ISO YYYY-MM-DD (or date string) into DD-MM-YYYY (e.g., 10-05-2026).
 */
export function formatDateDDMMYYYY(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const cleaned = String(dateStr).trim().split('T')[0];
  const parts = cleaned.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return cleaned;
}

/**
 * Interactive sortable table header cell with ascending/descending indicator icons
 */
export function SortableTh({
  label,
  sortKey,
  currentSort,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string;
  sortKey: string;
  currentSort: { key: string; dir: 'asc' | 'desc' };
  onSort: (key: string) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <th className={`py-3 px-4 select-none ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold hover:text-indigo-700 transition-colors ${
          isActive ? 'text-indigo-700' : 'text-slate-600'
        } ${align === 'right' ? 'ml-auto' : ''}`}
      >
        <span>{label}</span>
        {isActive ? (
          currentSort.dir === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 shrink-0" />
        )}
      </button>
    </th>
  );
}

/**
 * Generic array sorter supporting strings, numbers, and YYYY-MM-DD dates
 */
export function sortRows<T extends Record<string, any>>(
  rows: T[],
  sort: { key: string; dir: 'asc' | 'desc' }
): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const va = a[sort.key];
    const vb = b[sort.key];
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'number' && typeof vb === 'number') {
      return sort.dir === 'asc' ? va - vb : vb - va;
    }
    const sa = String(va).toLowerCase();
    const sb = String(vb).toLowerCase();
    if (sa < sb) return sort.dir === 'asc' ? -1 : 1;
    if (sa > sb) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });
  return copy;
}

/**
 * Semantic Status Indicator utilizing CSS variables for guaranteed WCAG AA contrast
 * in both light and dark modes. Pairs a semantic dot + label so state is never
 * communicated by hue alone.
 */
export function StatusBadge({ status }: { status: string }) {
  const normalized = (status || '').trim();
  let badgeStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-subtle)',
    color: 'var(--text-secondary)',
    borderColor: 'var(--border-subtle)',
  };
  let dotColor = '#64748B';

  if (normalized === 'Applied') {
    badgeStyle = {
      backgroundColor: 'var(--status-info-bg)',
      color: 'var(--status-info-text)',
      borderColor: 'var(--status-info-border)',
    };
    dotColor = '#3B82F6';
  } else if (normalized === 'Shortlisted' || normalized === 'Pending') {
    badgeStyle = {
      backgroundColor: 'var(--status-warning-bg)',
      color: 'var(--status-warning-text)',
      borderColor: 'var(--status-warning-border)',
    };
    dotColor = '#D97706';
  } else if (
    normalized === 'Selected' ||
    normalized === 'Passed' ||
    normalized.startsWith('Placed')
  ) {
    badgeStyle = {
      backgroundColor: 'var(--status-success-bg)',
      color: 'var(--status-success-text)',
      borderColor: 'var(--status-success-border)',
    };
    dotColor = '#10B981';
  } else if (normalized === 'Rejected' || normalized === 'Failed') {
    badgeStyle = {
      backgroundColor: 'var(--status-error-bg)',
      color: 'var(--status-error-text)',
      borderColor: 'var(--status-error-border)',
    };
    dotColor = '#EF4444';
  }

  return (
    <span
      style={badgeStyle}
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-md border whitespace-nowrap"
    >
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      {normalized}
    </span>
  );
}

/**
 * Clean loading skeleton matching compact table rows
 */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3.5 flex gap-4">
        {Array.from({ length: cols }).map((_, idx) => (
          <div key={idx} className="h-3.5 bg-slate-200 rounded w-24 animate-pulse" />
        ))}
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-4 py-3.5 flex items-center justify-between gap-4">
            {Array.from({ length: cols }).map((__, cIdx) => (
              <div key={cIdx} className="h-3.5 bg-slate-100 rounded w-full animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Clean empty state panel with optional primary action (40px+ accessible touch target)
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-xs">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-indigo-700 rounded-md hover:bg-indigo-800 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Confirmation Modal (avoids window.confirm inside iframe)
 */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Slices an array of items for current page and page size
 */
export function paginateRows<T>(rows: T[], currentPage: number, pageSize: number): T[] {
  if (!rows || rows.length === 0) return [];
  if (pageSize <= 0) return rows;
  const start = (currentPage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  className?: string;
}

/**
 * Universal accessible pagination control supporting page sizes, numbered buttons,
 * and next/previous/first/last boundaries.
 */
export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  itemName = 'items',
  className = '',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  // Generate page numbers with ellipses
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (safePage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (safePage >= totalPages - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      pages.push(safePage - 1);
      pages.push(safePage);
      pages.push(safePage + 1);
      pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [safePage, totalPages]);

  if (totalItems === 0) return null;

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg text-xs ${className}`}
    >
      {/* Range Info & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 text-slate-600">
        <span className="font-mono tabular-nums">
          Showing <span className="font-semibold text-slate-900">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-900">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-900">{totalItems}</span> {itemName}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
            <label htmlFor="pageSizeSelect" className="text-slate-500 whitespace-nowrap">
              Per page:
            </label>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                onPageSizeChange(nextSize);
                onPageChange(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-700"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation Buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage === 1}
          className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="First page"
          aria-label="Go to first page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1}
          className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Previous page"
          aria-label="Go to previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Numbered buttons */}
        <div className="flex items-center gap-1 mx-1">
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots_${idx}`} className="px-1.5 text-slate-400 select-none">
                  •••
                </span>
              );
            }
            const isCurrent = p === safePage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(Number(p))}
                aria-current={isCurrent ? 'page' : undefined}
                style={
                  isCurrent
                    ? {
                        backgroundColor: 'var(--color-brand)',
                        color: '#FFFFFF',
                        borderColor: 'var(--color-brand)',
                      }
                    : undefined
                }
                className={`min-w-[32px] min-h-[32px] px-2 py-1 text-xs font-semibold rounded border transition-colors ${
                  isCurrent
                    ? 'shadow-xs'
                    : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage === totalPages}
          className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Next page"
          aria-label="Go to next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage === totalPages}
          className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Last page"
          aria-label="Go to last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Informative permission notice banner when interacting user has limited/read-only access
 */
export function PermissionBanner({
  roleName,
  message,
  requiredRole = 'TPO Admin',
}: {
  roleName: string;
  message: string;
  requiredRole?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 shadow-xs">
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
        <span>
          <strong className="font-semibold">Interacting as {roleName}:</strong> {message}
        </span>
      </div>
      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
        Requires {requiredRole}
      </span>
    </div>
  );
}

/**
 * Distinctive colored badge displaying user role
 */
export function RoleBadge({ role, label }: { role: string; label?: string }) {
  let badgeStyle: React.CSSProperties = {
    backgroundColor: '#EEF2FF',
    color: '#4338CA',
    borderColor: '#C7D2FE',
  };
  if (role === 'student') {
    badgeStyle = { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' };
  } else if (role === 'faculty_hod') {
    badgeStyle = { backgroundColor: '#F0FDFA', color: '#0F766E', borderColor: '#99F6E4' };
  } else if (role === 'recruiter') {
    badgeStyle = { backgroundColor: '#FFF7ED', color: '#C2410C', borderColor: '#FFEDD5' };
  }

  return (
    <span
      style={badgeStyle}
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap"
    >
      {label || role}
    </span>
  );
}


