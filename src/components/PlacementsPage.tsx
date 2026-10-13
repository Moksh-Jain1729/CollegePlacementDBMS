import React, { useEffect, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { apiRequest } from '../api.ts';
import { PlacementsData } from '../types.ts';
import {
  TableSkeleton,
  EmptyState,
  SortableTh,
  sortRows,
  formatDateDDMMYYYY,
  Pagination,
  paginateRows,
} from './Common.tsx';

export default function PlacementsPage({
  refreshTick,
  onSyncSuccess,
  showToast,
}: {
  refreshTick: number;
  onSyncSuccess: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [data, setData] = useState<PlacementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'final_package',
    dir: 'desc',
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const fetchPlacements = useCallback(async () => {
    try {
      const res = await apiRequest<PlacementsData>('/api/placements');
      setData(res);
      onSyncSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [onSyncSuccess, showToast]);

  useEffect(() => {
    fetchPlacements();
  }, [fetchPlacements, refreshTick]);

  const summary = data?.summary || {
    total_offers: 0,
    placed_students: 0,
    avg_package: 0,
    highest_package: 0,
    lowest_package: 0,
  };

  // Compute median package from records
  const sortedPackages = (data?.records || [])
    .map((r) => Number(r.final_package))
    .sort((a, b) => a - b);
  const medianPackage =
    sortedPackages.length > 0
      ? sortedPackages.length % 2 === 1
        ? sortedPackages[Math.floor(sortedPackages.length / 2)]
        : (sortedPackages[sortedPackages.length / 2 - 1] + sortedPackages[sortedPackages.length / 2]) / 2
      : 0;

  const filteredRecords = (data?.records || []).filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
    return (
      fullName.includes(q) ||
      r.company_name.toLowerCase().includes(q) ||
      r.dept_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards: Total Offers, Highest, Lowest, Average, Median */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Offers</div>
          <div className="mt-2 font-display text-2xl font-semibold text-slate-900 tabular-nums">
            {summary.total_offers}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Placed Students</div>
          <div className="mt-2 font-display text-2xl font-semibold text-slate-900 tabular-nums">
            {summary.placed_students}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Highest Package</div>
          <div className="mt-2 font-display text-2xl font-semibold text-teal-700 tabular-nums">
            {summary.highest_package.toFixed(2)} LPA
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Lowest Package</div>
          <div className="mt-2 font-display text-2xl font-semibold text-slate-900 tabular-nums">
            {summary.lowest_package.toFixed(2)} LPA
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Average Package</div>
          <div className="mt-2 font-display text-2xl font-semibold text-indigo-700 tabular-nums">
            {summary.avg_package.toFixed(2)} LPA
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Median Package</div>
          <div className="mt-2 font-display text-2xl font-semibold text-slate-900 tabular-nums">
            {medianPackage.toFixed(2)} LPA
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, branch, or company..."
            className="w-full min-h-[40px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700"
          />
        </div>
        <div className="text-xs font-mono text-slate-500">
          Showing {filteredRecords.length} of {data?.records.length || 0} placement records
        </div>
      </div>

      {/* Placement Records Table */}
      {loading && !data ? (
        <TableSkeleton rows={4} cols={6} />
      ) : filteredRecords.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
              <tr>
                <SortableTh
                  label="Record ID"
                  sortKey="record_id"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Student"
                  sortKey="first_name"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Department"
                  sortKey="dept_name"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Company"
                  sortKey="company_name"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Final Package"
                  sortKey="final_package"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'desc' ? 'asc' : 'desc' }))
                  }
                  align="right"
                />
                <SortableTh
                  label="Offer Date (DD-MM-YYYY)"
                  sortKey="offer_date"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {paginateRows(sortRows(filteredRecords, sortConfig), currentPage, pageSize).map((rec) => (
                <tr key={rec.record_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500">
                    #{rec.record_id}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {rec.first_name} {rec.last_name}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{rec.dept_name}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {rec.company_name}
                    {rec.industry_type && (
                      <span className="text-xs text-slate-500 font-normal"> • {rec.industry_type}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-teal-700">
                    {rec.final_package.toFixed(2)} LPA
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600">
                    {formatDateDDMMYYYY(rec.offer_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredRecords.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50]}
            itemName="records"
          />
        </div>
      ) : (
        <EmptyState
          title="No placement records yet"
          description="Use the 'Mark Placed' action on the Applications page to record confirmed placement offers."
        />
      )}
    </div>
  );
}
