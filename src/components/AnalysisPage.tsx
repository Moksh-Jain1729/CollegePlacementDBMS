import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../api.ts';
import { SortableTh, sortRows, TableSkeleton } from './Common.tsx';

interface StatSummary {
  count: number;
  highest: number;
  lowest: number;
  average: number;
  median: number;
  p25: number;
  p75: number;
  iqr: number;
  stdDev: number;
}

interface DeptAnalysisRow {
  dept_id: number;
  dept_name: string;
  total_students: number;
  placed_students: number;
  unplaced_students: number;
  placement_percent: number;
  avg_cgpa: number;
  median_cgpa: number;
  max_cgpa: number;
  min_cgpa: number;
  avg_package_lpa: number;
  median_package_lpa: number;
  max_package_lpa: number;
  min_package_lpa: number;
}

interface BucketItem {
  label: string;
  count: number;
  color: string;
}

interface CompanyAnalysisRow {
  company_id: number;
  company_name: string;
  industry_type: string;
  drives_count: number;
  min_offered_lpa: number;
  max_offered_lpa: number;
  total_applications: number;
  total_offers: number;
  avg_final_package: number;
}

interface AnalysisData {
  packageStats: StatSummary;
  cgpaStats: StatSummary;
  departmentComparison: DeptAnalysisRow[];
  applicationStatusBreakdown: { status: string; count: number }[];
  cgpaBuckets: BucketItem[];
  backlogDistribution: { backlogs: number; student_count: number }[];
  companyAnalysis: CompanyAnalysisRow[];
  interviewRoundStats: { result: string; count: number }[];
  packageTiers: BucketItem[];
}

/**
 * Pure SVG / CSS Donut Pie Chart
 */
function DonutPieChart({
  title,
  subtitle,
  centerValue,
  centerLabel,
  slices,
}: {
  title: string;
  subtitle: string;
  centerValue: string | number;
  centerLabel: string;
  slices: { label: string; value: number; color: string }[];
}) {
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  let cumulativePercent = 0;

  const segments = slices.map((slice) => {
    const pct = total > 0 ? (slice.value / total) * 100 : 0;
    const offset = 25 - cumulativePercent;
    cumulativePercent += pct;
    return {
      ...slice,
      pct,
      dashArray: `${pct} ${100 - pct}`,
      dashOffset: offset,
    };
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="my-5 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative w-36 h-36 shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full">
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth="4.2"
            />
            {segments.map((seg) =>
              seg.pct > 0 ? (
                <circle
                  key={seg.label}
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth="4.2"
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                />
              ) : null
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-xl font-semibold text-slate-900 tabular-nums">
              {centerValue}
            </span>
            <span className="text-[11px] text-slate-500">{centerLabel}</span>
          </div>
        </div>
        <div className="flex-1 w-full space-y-2">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-slate-700 truncate">{seg.label}</span>
              </div>
              <div className="font-mono tabular-nums text-slate-900 font-medium whitespace-nowrap">
                {seg.value}{' '}
                <span className="text-slate-400 font-normal">({seg.pct.toFixed(1)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const DEPT_COLORS = [
  '#4338ca',
  '#0284c7',
  '#0d9488',
  '#7c3aed',
  '#ea580c',
  '#db2777',
  '#475569',
];

const STATUS_COLOR_MAP: Record<string, string> = {
  Selected: '#10b981',
  Shortlisted: '#f59e0b',
  Applied: '#3b82f6',
  Rejected: '#ef4444',
};

export default function AnalysisPage({
  refreshTick,
  onSyncSuccess,
  showToast,
}: {
  refreshTick: number;
  onSyncSuccess: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deptAId, setDeptAId] = useState<number>(1);
  const [deptBId, setDeptBId] = useState<number>(4);

  // Sorting state for Branch Statistical Summary Table
  const [deptSort, setDeptSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'placement_percent',
    dir: 'desc',
  });

  // Sorting state for Company Package Spectrum
  const [compSortKey, setCompSortKey] = useState<
    'total_offers' | 'avg_final_package' | 'max_offered_lpa' | 'total_applications'
  >('total_offers');

  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await apiRequest<AnalysisData>('/api/analysis');
      setData(res);
      onSyncSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [onSyncSuccess, showToast]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis, refreshTick]);

  const handleDeptSort = (key: string) => {
    setDeptSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  if (!data) return null;

  const totalStudents = data.departmentComparison.reduce((s, d) => s + d.total_students, 0);
  const totalPlaced = data.departmentComparison.reduce((s, d) => s + d.placed_students, 0);
  const totalApps = data.applicationStatusBreakdown.reduce((s, a) => s + a.count, 0);
  const maxCompanyPkg = Math.max(...data.companyAnalysis.map((c) => c.max_offered_lpa), 30);

  const sortedDeptComparison = sortRows(data.departmentComparison, deptSort);
  const sortedCompanyAnalysis = [...data.companyAnalysis].sort(
    (a, b) => Number(b[compSortKey] || 0) - Number(a[compSortKey] || 0)
  );

  // Slices for Pie Charts
  const deptStudentSlices = data.departmentComparison.map((d, idx) => ({
    label: d.dept_name,
    value: d.total_students,
    color: DEPT_COLORS[idx % DEPT_COLORS.length],
  }));

  const statusSlices = data.applicationStatusBreakdown.map((s) => ({
    label: s.status,
    value: s.count,
    color: STATUS_COLOR_MAP[s.status] || '#64748b',
  }));

  const cgpaSlices = data.cgpaBuckets.map((b) => ({
    label: b.label,
    value: b.count,
    color: b.color,
  }));

  const packageTierSlices = data.packageTiers.map((t) => ({
    label: t.label,
    value: t.count,
    color: t.color,
  }));

  const deptA =
    data.departmentComparison.find((d) => d.dept_id === deptAId) || data.departmentComparison[0];
  const deptB =
    data.departmentComparison.find((d) => d.dept_id === deptBId) ||
    data.departmentComparison[1] ||
    data.departmentComparison[0];

  const pkg = data.packageStats;
  const cg = data.cgpaStats;

  return (
    <div className="space-y-8">
      {/* Row 0: Statistical Summary Panels (Highest, Lowest, Average, Median, P25, P75, IQR, StdDev) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Compensation Package (LPA) Statistical Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Compensation Package Statistics (LPA)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribution across {pkg.count} confirmed placement offers
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
              IQR: {pkg.iqr.toFixed(2)} LPA
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Highest</div>
              <div className="text-lg font-bold font-mono tabular-nums text-teal-700 mt-0.5">
                {pkg.highest.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400">Max LPA</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Lowest</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {pkg.lowest.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400">Min LPA</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Average (Mean)</div>
              <div className="text-lg font-bold font-mono tabular-nums text-indigo-700 mt-0.5">
                {pkg.average.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400">StdDev ±{pkg.stdDev.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Median (P50)</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {pkg.median.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400">
                P25: {pkg.p25.toFixed(1)} | P75: {pkg.p75.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Box-Plot / Quartile Visual Bar */}
          {pkg.highest > 0 && (
            <div className="pt-1 space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>Min: {pkg.lowest.toFixed(2)} LPA</span>
                <span>P25: {pkg.p25.toFixed(2)}</span>
                <span className="font-semibold text-indigo-700">Median: {pkg.median.toFixed(2)}</span>
                <span>P75: {pkg.p75.toFixed(2)}</span>
                <span>Max: {pkg.highest.toFixed(2)} LPA</span>
              </div>
              <div className="relative h-3 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-indigo-200 border-x border-indigo-600"
                  style={{
                    left: `${(pkg.p25 / pkg.highest) * 100}%`,
                    width: `${Math.max(2, ((pkg.p75 - pkg.p25) / pkg.highest) * 100)}%`,
                  }}
                  title={`Interquartile Range (P25–P75): ${pkg.p25} to ${pkg.p75} LPA`}
                />
                <div
                  className="absolute top-0 bottom-0 w-1 bg-indigo-700"
                  style={{ left: `${(pkg.median / pkg.highest) * 100}%` }}
                  title={`Median: ${pkg.median} LPA`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Academic CGPA Statistical Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Student CGPA Statistical Summary (0–10 Scale)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Academic distribution across all {cg.count} registered students
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-md">
              IQR: {cg.iqr.toFixed(2)} CGPA
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Highest CGPA</div>
              <div className="text-lg font-bold font-mono tabular-nums text-teal-700 mt-0.5">
                {cg.highest.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400">Batch Topper</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Lowest CGPA</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {cg.lowest.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400">Batch Minimum</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Average (Mean)</div>
              <div className="text-lg font-bold font-mono tabular-nums text-indigo-700 mt-0.5">
                {cg.average.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400">StdDev ±{cg.stdDev.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Median (P50)</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {cg.median.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400">
                P25: {cg.p25.toFixed(2)} | P75: {cg.p75.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="pt-1 space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>Min: {cg.lowest.toFixed(2)}</span>
              <span>P25: {cg.p25.toFixed(2)}</span>
              <span className="font-semibold text-teal-700">Median: {cg.median.toFixed(2)}</span>
              <span>P75: {cg.p75.toFixed(2)}</span>
              <span>Max: {cg.highest.toFixed(2)}</span>
            </div>
            <div className="relative h-3 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-teal-200 border-x border-teal-600"
                style={{
                  left: `${(cg.p25 / 10) * 100}%`,
                  width: `${Math.max(2, ((cg.p75 - cg.p25) / 10) * 100)}%`,
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-teal-700"
                style={{ left: `${(cg.median / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Row 1: Sortable Branch-wise Statistical Breakdown Table (Highest, Lowest, Average, Median) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Sortable Branch Statistical Matrix (Highest, Lowest, Average & Median)
            </h2>
            <p className="text-xs text-slate-500">
              Click any column header to sort departments by placement rate, CGPA metrics, or package metrics
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <SortableTh
                  label="Department"
                  sortKey="dept_name"
                  currentSort={deptSort}
                  onSort={handleDeptSort}
                />
                <SortableTh
                  label="Students"
                  sortKey="total_students"
                  currentSort={deptSort}
                  onSort={handleDeptSort}
                  align="right"
                />
                <SortableTh
                  label="Placed"
                  sortKey="placed_students"
                  currentSort={deptSort}
                  onSort={handleDeptSort}
                  align="right"
                />
                <SortableTh
                  label="Placement %"
                  sortKey="placement_percent"
                  currentSort={deptSort}
                  onSort={handleDeptSort}
                  align="right"
                />
                <SortableTh
                  label="Avg CGPA"
                  sortKey="avg_cgpa"
                  currentSort={deptSort}
                  onSort={handleDeptSort}
                  align="right"
                />
                <SortableTh
                  label="Median CGPA"
                  sortKey="median_cgpa"
                  currentSort={deptSort}
                  onSort={handleDeptSort}
                  align="right"
                />
                <SortableTh
                  label="Lowest LPA"
                  sortKey="min_package_lpa"
                  currentSort={deptSort}
                  onSort={handleDeptSort}
                  align="right"
                />
                <SortableTh
                  label="Median LPA"
                  sortKey="median_package_lpa"
                  currentSort={deptSort}
                  onSort={handleDeptSort}
                  align="right"
                />
                <SortableTh
                  label="Avg LPA"
                  sortKey="avg_package_lpa"
                  currentSort={deptSort}
                  onSort={handleDeptSort}
                  align="right"
                />
                <SortableTh
                  label="Highest LPA"
                  sortKey="max_package_lpa"
                  currentSort={deptSort}
                  onSort={handleDeptSort}
                  align="right"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {sortedDeptComparison.map((dept) => (
                <tr key={dept.dept_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900">{dept.dept_name}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {dept.total_students}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {dept.placed_students}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-indigo-700">
                    {dept.placement_percent.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {dept.avg_cgpa.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {dept.median_cgpa.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {dept.min_package_lpa ? `${dept.min_package_lpa.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                    {dept.median_package_lpa ? `${dept.median_package_lpa.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-indigo-700">
                    {dept.avg_package_lpa ? `${dept.avg_package_lpa.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-teal-700">
                    {dept.max_package_lpa ? `${dept.max_package_lpa.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Row 2: 4 Donut Pie Charts */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Distribution & Composition Pie Charts
          </h2>
          <p className="text-xs text-slate-500">
            Proportional breakdown of student enrollment, application pipeline, CGPA tiers, and offer packages
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DonutPieChart
            title="Student Enrollment by Branch"
            subtitle="Share of students across all 7 engineering departments"
            centerValue={totalStudents}
            centerLabel="Students"
            slices={deptStudentSlices}
          />
          <DonutPieChart
            title="Application Pipeline Status"
            subtitle="Proportion of Selected, Shortlisted, Applied, and Rejected applications"
            centerValue={totalApps}
            centerLabel="Applications"
            slices={statusSlices}
          />
          <DonutPieChart
            title="Student CGPA Tier Breakdown"
            subtitle="Academic grade distribution across the batch"
            centerValue={totalStudents}
            centerLabel="Students"
            slices={cgpaSlices}
          />
          <DonutPieChart
            title="Placement Offers by Package Tier"
            subtitle="Distribution of confirmed placement offers by CTC bracket"
            centerValue={totalPlaced}
            centerLabel="Offers"
            slices={packageTierSlices}
          />
        </div>
      </section>

      {/* Row 3: Company Package Spectrum with Sort Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Company Package Spectrum (Lowest – Avg – Highest LPA) & Offer Count
            </h2>
            <p className="text-xs text-slate-500">
              Visualizes each company’s offered salary band alongside actual average final package and offers extended
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Sort companies by:</label>
            <select
              value={compSortKey}
              onChange={(e) => setCompSortKey(e.target.value as any)}
              className="min-h-[34px] px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-700"
            >
              <option value="total_offers">Total Offers</option>
              <option value="avg_final_package">Average Final Package</option>
              <option value="max_offered_lpa">Highest Offered LPA</option>
              <option value="total_applications">Total Applications</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {sortedCompanyAnalysis.map((comp) => {
            const leftPct = Math.min(100, (comp.min_offered_lpa / maxCompanyPkg) * 100);
            const widthPct = Math.max(
              2,
              Math.min(100 - leftPct, ((comp.max_offered_lpa - comp.min_offered_lpa) / maxCompanyPkg) * 100)
            );
            const avgPct = comp.avg_final_package
              ? Math.min(98, (comp.avg_final_package / maxCompanyPkg) * 100)
              : null;

            return (
              <div key={comp.company_id} className="grid grid-cols-1 md:grid-cols-12 items-center gap-3">
                <div className="md:col-span-3">
                  <div className="text-sm font-semibold text-slate-900">{comp.company_name}</div>
                  <div className="text-xs text-slate-500">
                    {comp.industry_type} • {comp.total_offers} offer(s) / {comp.total_applications} app(s)
                  </div>
                </div>
                <div className="md:col-span-6">
                  <div className="relative h-4 bg-slate-100 border border-slate-200 rounded">
                    <div
                      className="absolute top-0.5 bottom-0.5 bg-indigo-200 border border-indigo-500 rounded-xs"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    />
                    {avgPct !== null && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-teal-600 border border-white shadow-xs"
                        style={{ left: `calc(${avgPct}% - 5px)` }}
                        title={`Avg Offer: ${comp.avg_final_package.toFixed(2)} LPA`}
                      />
                    )}
                  </div>
                </div>
                <div className="md:col-span-3 text-right font-mono tabular-nums text-xs text-slate-700">
                  <span>
                    {comp.min_offered_lpa.toFixed(1)}–{comp.max_offered_lpa.toFixed(1)} LPA
                  </span>
                  {comp.avg_final_package > 0 && (
                    <span className="ml-2 text-teal-700 font-semibold">
                      (Avg {comp.avg_final_package.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Row 4: Interactive Head-to-Head Branch Comparator & Backlog Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {deptA && deptB && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Head-to-Head Branch Comparator
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Compare Highest, Lowest, Average, and Median metrics between any two branches
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Branch A</label>
                <select
                  value={deptA.dept_id}
                  onChange={(e) => setDeptAId(Number(e.target.value))}
                  className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-700"
                >
                  {data.departmentComparison.map((d) => (
                    <option key={d.dept_id} value={d.dept_id}>
                      {d.dept_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Branch B</label>
                <select
                  value={deptB.dept_id}
                  onChange={(e) => setDeptBId(Number(e.target.value))}
                  className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-700"
                >
                  {data.departmentComparison.map((d) => (
                    <option key={d.dept_id} value={d.dept_id}>
                      {d.dept_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 font-medium">Metric</th>
                  <th className="py-2 text-right font-semibold text-indigo-700 truncate max-w-[120px]">
                    {deptA.dept_name.split(' ')[0]}
                  </th>
                  <th className="py-2 text-right font-semibold text-teal-700 truncate max-w-[120px]">
                    {deptB.dept_name.split(' ')[0]}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                <tr>
                  <td className="py-2 font-sans text-slate-700">Total / Placed Students</td>
                  <td className="py-2 text-right font-semibold text-slate-900">
                    {deptA.placed_students} / {deptA.total_students} ({deptA.placement_percent.toFixed(1)}%)
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-900">
                    {deptB.placed_students} / {deptB.total_students} ({deptB.placement_percent.toFixed(1)}%)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-slate-700">Average / Median CGPA</td>
                  <td className="py-2 text-right text-slate-900">
                    {deptA.avg_cgpa.toFixed(2)} / {deptA.median_cgpa.toFixed(2)}
                  </td>
                  <td className="py-2 text-right text-slate-900">
                    {deptB.avg_cgpa.toFixed(2)} / {deptB.median_cgpa.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-slate-700">Highest / Lowest CGPA</td>
                  <td className="py-2 text-right text-slate-900">
                    {deptA.max_cgpa.toFixed(2)} / {deptA.min_cgpa.toFixed(2)}
                  </td>
                  <td className="py-2 text-right text-slate-900">
                    {deptB.max_cgpa.toFixed(2)} / {deptB.min_cgpa.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-slate-700">Average Package</td>
                  <td className="py-2 text-right font-semibold text-indigo-700">
                    {deptA.avg_package_lpa.toFixed(2)} LPA
                  </td>
                  <td className="py-2 text-right font-semibold text-indigo-700">
                    {deptB.avg_package_lpa.toFixed(2)} LPA
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-slate-700">Median Package</td>
                  <td className="py-2 text-right font-semibold text-slate-900">
                    {deptA.median_package_lpa.toFixed(2)} LPA
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-900">
                    {deptB.median_package_lpa.toFixed(2)} LPA
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-slate-700">Highest / Lowest Package</td>
                  <td className="py-2 text-right text-teal-700 font-semibold">
                    {deptA.max_package_lpa.toFixed(2)} / {deptA.min_package_lpa.toFixed(2)} LPA
                  </td>
                  <td className="py-2 text-right text-teal-700 font-semibold">
                    {deptB.max_package_lpa.toFixed(2)} / {deptB.min_package_lpa.toFixed(2)} LPA
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Backlog & Interview Round Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Backlog Distribution & Interview Round Outcomes
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Impact of active backlogs on eligibility and pass rate across technical/HR interview rounds
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-700">Students by Backlog Count</h4>
            {data.backlogDistribution.map((b) => {
              const pct = totalStudents > 0 ? (b.student_count / totalStudents) * 100 : 0;
              return (
                <div key={b.backlogs} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {b.backlogs === 0
                        ? '0 Backlogs (Clear Record)'
                        : `${b.backlogs} Active Backlog${b.backlogs > 1 ? 's' : ''}`}
                    </span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {b.student_count} students ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 border border-slate-200 rounded overflow-hidden">
                    <div
                      className={`h-full ${
                        b.backlogs === 0
                          ? 'bg-emerald-600'
                          : b.backlogs === 1
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-3">
            <h4 className="text-xs font-semibold text-slate-700">Interview Round Outcomes</h4>
            <div className="grid grid-cols-3 gap-3">
              {data.interviewRoundStats.map((ir) => (
                <div
                  key={ir.result}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center"
                >
                  <div className="text-xs text-slate-500">{ir.result}</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {ir.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
