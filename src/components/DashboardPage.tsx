import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../api.ts';
import { DashboardData } from '../types.ts';
import { StatusBadge, TableSkeleton, EmptyState, formatDateDDMMYYYY, SortableTh, sortRows } from './Common.tsx';

export default function DashboardPage({
  refreshTick,
  onSyncSuccess,
  onNavigate,
}: {
  refreshTick: number;
  onSyncSuccess: () => void;
  onNavigate: (page: string) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deptSort, setDeptSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'placement_percent',
    dir: 'desc',
  });

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiRequest<DashboardData>('/api/dashboard');
      setData(res);
      setError(null);
      onSyncSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onSyncSuccess]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard, refreshTick]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-md p-4 h-20 animate-pulse" />
          ))}
        </div>
        <TableSkeleton rows={4} cols={5} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
        {error}
      </div>
    );
  }

  const stats = data?.stats || {
    total_students: 0,
    total_companies: 0,
    total_drives: 0,
    total_applications: 0,
    placed_students: 0,
    avg_package: 0,
  };

  const placementPct =
    stats.total_students > 0
      ? ((stats.placed_students / stats.total_students) * 100).toFixed(1)
      : '0.0';

  const statItems = [
    { label: 'Total Students', value: stats.total_students, target: 'students' },
    { label: 'Placement Drives', value: stats.total_drives, target: 'drives' },
    { label: 'Applications', value: stats.total_applications, target: 'applications' },
    { label: 'Placed Students', value: stats.placed_students, target: 'placements' },
    { label: 'Placement %', value: `${placementPct}%`, target: 'analysis' },
    {
      label: 'Avg Package',
      value: stats.avg_package ? `${stats.avg_package.toFixed(2)} LPA` : '0.00 LPA',
      target: 'placements',
    },
  ];

  return (
    <div className="space-y-8">
      {/* 6 Stat Cards */}
      <section aria-label="Summary Metrics">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {statItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.target)}
              className="text-left bg-white border border-slate-200 rounded-lg p-5 shadow-xs hover:border-indigo-700 transition-colors"
            >
              <div className="text-xs font-medium text-slate-500 tracking-tight">{item.label}</div>
              <div className="mt-2 font-display text-2xl font-semibold text-slate-900 tabular-nums">
                {item.value}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Placement by Department Table (from v_placement_stats view) with plain CSS progress bar */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Placement by Department</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live aggregation from SQL view <span className="font-mono">v_placement_stats</span>
            </p>
          </div>
        </div>

        {data?.departmentStats && data.departmentStats.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
                <tr>
                  <SortableTh
                    label="Department"
                    sortKey="dept_name"
                    currentSort={deptSort}
                    onSort={(key) =>
                      setDeptSort((p) => ({ key, dir: p.key === key && p.dir === 'desc' ? 'asc' : 'desc' }))
                    }
                  />
                  <SortableTh
                    label="Students"
                    sortKey="total_students"
                    currentSort={deptSort}
                    onSort={(key) =>
                      setDeptSort((p) => ({ key, dir: p.key === key && p.dir === 'desc' ? 'asc' : 'desc' }))
                    }
                    align="right"
                  />
                  <SortableTh
                    label="Placed"
                    sortKey="placed_students"
                    currentSort={deptSort}
                    onSort={(key) =>
                      setDeptSort((p) => ({ key, dir: p.key === key && p.dir === 'desc' ? 'asc' : 'desc' }))
                    }
                    align="right"
                  />
                  <SortableTh
                    label="Placement Rate"
                    sortKey="placement_percent"
                    currentSort={deptSort}
                    onSort={(key) =>
                      setDeptSort((p) => ({ key, dir: p.key === key && p.dir === 'desc' ? 'asc' : 'desc' }))
                    }
                    className="w-72"
                  />
                  <SortableTh
                    label="Avg Package"
                    sortKey="avg_package_lpa"
                    currentSort={deptSort}
                    onSort={(key) =>
                      setDeptSort((p) => ({ key, dir: p.key === key && p.dir === 'desc' ? 'asc' : 'desc' }))
                    }
                    align="right"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {sortRows(data.departmentStats, deptSort).map((dept) => {
                  const pct = Number(dept.placement_percent || 0);
                  const clampedPct = Math.max(0, Math.min(100, pct));
                  return (
                    <tr key={dept.dept_name} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">{dept.dept_name}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {dept.total_students}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {dept.placed_students}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className="h-full rounded-l-full"
                              style={{
                                width: `${clampedPct}%`,
                                backgroundColor: 'var(--color-brand)',
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-700 w-12 text-right font-medium">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {dept.avg_package_lpa !== null && dept.avg_package_lpa !== undefined
                          ? `${Number(dept.avg_package_lpa).toFixed(2)} LPA`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No department statistics yet"
            description="Add departments and students to see placement progress by branch."
            actionLabel="Manage Students"
            onAction={() => onNavigate('students')}
          />
        )}
      </section>

      {/* 5 Most Recent Applications */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent Applications</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest 5 student applications across scheduled placement drives
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('applications')}
            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:underline"
          >
            View all applications
          </button>
        </div>

        {data?.recentApplications && data.recentApplications.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Applied Date (DD-MM-YYYY)</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {data.recentApplications.map((app) => (
                  <tr key={app.application_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {app.first_name} {app.last_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{app.dept_name}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{app.company_name}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600">
                      {formatDateDDMMYYYY(app.applied_date)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={app.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No applications recorded"
            description="Create an application from Eligibility or Applications to see activity here."
            actionLabel="Go to Applications"
            onAction={() => onNavigate('applications')}
          />
        )}
      </section>
    </div>
  );
}
