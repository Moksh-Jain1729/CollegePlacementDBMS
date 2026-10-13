import React, { useEffect, useState, useCallback } from 'react';
import { Play, Code2, Copy, Check } from 'lucide-react';
import { apiRequest } from '../api.ts';
import { TableSkeleton, EmptyState, Pagination, paginateRows } from './Common.tsx';
import { UserPersona, UserPermissions } from '../types.ts';
import { recordInteraction } from '../permissions.ts';
import { UserPersona, UserPermissions } from '../types.ts';
import { recordInteraction } from '../permissions.ts';

export interface SqlReportResult {
  id: string;
  title: string;
  category: string;
  description: string;
  sql: string;
  rows: Record<string, any>[];
}

const PRESET_SNIPPETS: { label: string; sql: string }[] = [
  {
    label: 'All Students with Age & Dept',
    sql: `SELECT s.student_id, s.first_name, s.last_name, d.dept_name, s.cgpa, s.backlogs, va.age FROM STUDENT s JOIN DEPARTMENT d ON s.dept_id = d.dept_id LEFT JOIN v_student_age va ON va.student_id = s.student_id ORDER BY s.cgpa DESC;`,
  },
  {
    label: 'Students with Multiple Phones',
    sql: `SELECT s.student_id, s.first_name, s.last_name, COUNT(sp.phone_no) AS phone_count FROM STUDENT s JOIN STUDENT_PHONE sp ON s.student_id = sp.student_id GROUP BY s.student_id, s.first_name, s.last_name HAVING COUNT(sp.phone_no) > 1;`,
  },
  {
    label: 'Drives with Multiple Criteria Sets',
    sql: `SELECT dr.drive_id, c.company_name, dr.drive_date, COUNT(ec.criteria_id) AS criteria_sets FROM DRIVE dr JOIN COMPANY c ON dr.company_id = c.company_id JOIN ELIGIBILITY_CRITERIA ec ON ec.drive_id = dr.drive_id GROUP BY dr.drive_id, c.company_name, dr.drive_date HAVING COUNT(ec.criteria_id) > 1;`,
  },
  {
    label: 'Drives Open to Student #1 (Rahul)',
    sql: `SELECT DISTINCT dr.drive_id, c.company_name, dr.drive_date, dr.min_package_lpa, dr.max_package_lpa FROM STUDENT s JOIN ELIGIBILITY_BRANCH eb ON eb.dept_id = s.dept_id JOIN ELIGIBILITY_CRITERIA ec ON ec.criteria_id = eb.criteria_id AND ec.drive_id = eb.drive_id JOIN DRIVE dr ON dr.drive_id = ec.drive_id JOIN COMPANY c ON c.company_id = dr.company_id WHERE s.student_id = 1   AND s.cgpa >= ec.min_cgpa   AND s.backlogs <= ec.max_backlogs;`,
  },
  {
    label: 'Department Placement View',
    sql: `SELECT * FROM v_placement_stats;`,
  },
];

function DynamicResultTable({ rows }: { rows: Record<string, any>[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows]);

  if (!rows || rows.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
        Query returned 0 rows.
      </div>
    );
  }
  const columns = Object.keys(rows[0]);
  const pagedRows = paginateRows(rows, currentPage, pageSize);

  return (
    <div className="border-t border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
            <tr>
              {columns.map((col) => (
                <th key={col} className="py-2 px-3 font-mono whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {pagedRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/80">
                {columns.map((col) => {
                  const val = row[col];
                  const isNum = typeof val === 'number';
                  return (
                    <td
                      key={col}
                      className={`py-2 px-3 whitespace-nowrap ${
                        isNum ? 'font-mono tabular-nums text-slate-900 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {val === null || val === undefined ? (
                        <span className="text-slate-400 font-mono">NULL</span>
                      ) : (
                        String(val)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <Pagination
          currentPage={currentPage}
          totalItems={rows.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 25, 50]}
          itemName="rows"
          className="rounded-none border-x-0 border-b-0 border-t"
        />
      )}
    </div>
  );
}

export default function SqlQueriesPage({
  refreshTick,
  onSyncSuccess,
  showToast,
}: {
  refreshTick: number;
  onSyncSuccess: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [reports, setReports] = useState<SqlReportResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Interactive Custom SELECT Console State
  const [customSql, setCustomSql] = useState<string>(PRESET_SNIPPETS[0].sql);
  const [customRows, setCustomRows] = useState<Record<string, any>[] | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [runningCustom, setRunningCustom] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const data = await apiRequest<SqlReportResult[]>('/api/reports');
      setReports(data);
      onSyncSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [onSyncSuccess, showToast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports, refreshTick]);

  const handleRunCustomQuery = async (sqlToExecute?: string) => {
    const queryText = sqlToExecute ?? customSql;
    if (!queryText.trim()) return;
    setRunningCustom(true);
    setCustomError(null);
    try {
      const res = await apiRequest<{ sql: string; rowCount: number; rows: Record<string, any>[] }>(
        '/api/reports/run',
        {
          method: 'POST',
          body: JSON.stringify({ sql: queryText }),
        }
      );
      setCustomRows(res.rows);
    } catch (err: any) {
      setCustomError(err.message);
      setCustomRows(null);
    } finally {
      setRunningCustom(false);
    }
  };

  // Run default custom snippet on first load
  useEffect(() => {
    handleRunCustomQuery(PRESET_SNIPPETS[0].sql);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopySql = (id: string, sql: string) => {
    navigator.clipboard?.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const categories = ['all', 'Schema Report Query', 'SQL View', 'Core Eligibility Query', 'Custom Analytical Query'];

  const visibleReports =
    categoryFilter === 'all' ? reports : reports.filter((r) => r.category === categoryFilter);

  return (
    <div className="space-y-8">
      {/* Section 1: Interactive Read-Only SQL Explorer */}
      <section className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Interactive SQL Query Runner (Read-Only SELECT)
            </h2>
            <p className="text-xs text-slate-500">
              Run custom <span className="font-mono">SELECT</span> queries directly against the live{' '}
              <span className="font-mono">C_PLACEMENT</span> tables and views to inspect records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_SNIPPETS.map((snip) => (
              <button
                key={snip.label}
                type="button"
                onClick={() => {
                  setCustomSql(snip.sql);
                  handleRunCustomQuery(snip.sql);
                }}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:border-indigo-600 hover:text-indigo-600 transition-colors whitespace-nowrap"
              >
                {snip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              rows={4}
              value={customSql}
              onChange={(e) => setCustomSql(e.target.value)}
              placeholder="SELECT * FROM STUDENT;"
              className="flex-1 p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded focus:outline-none focus:bg-white focus:border-indigo-600 text-slate-900"
            />
            <div className="flex sm:flex-col justify-end gap-2">
              <button
                type="button"
                disabled={runningCustom}
                onClick={() => handleRunCustomQuery()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                {runningCustom ? 'Running...' : 'Run Query'}
              </button>
            </div>
          </div>
          {customError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs font-mono">
              {customError}
            </div>
          )}
        </div>

        {customRows !== null && (
          <div>
            <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>Query Result</span>
              <span className="font-mono tabular-nums">{customRows.length} row(s)</span>
            </div>
            <DynamicResultTable rows={customRows} />
          </div>
        )}
      </section>

      {/* Section 2: Pre-built SQL Report Queries (Schema + Analytical Queries) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Live SQL Reports & Record Queries ({visibleReports.length})
            </h2>
            <p className="text-xs text-slate-500">
              Includes all report queries from <span className="font-mono">placement_final.sql</span> plus
              recommended multi-table analytical queries.
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'all' ? 'All Queries' : cat}
              </button>
            ))}
          </div>
        </div>

        {loading && reports.length === 0 ? (
          <TableSkeleton rows={6} cols={4} />
        ) : visibleReports.length > 0 ? (
          <div className="grid grid-cols-1 gap-5">
            {visibleReports.map((rep, idx) => (
              <div
                key={rep.id}
                className="bg-white border border-slate-200 rounded-md overflow-hidden"
              >
                {/* Report Header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-indigo-600">
                        Q{String(idx + 1).padStart(2, '0')}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900">{rep.title}</h3>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">{rep.category}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{rep.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {rep.rows.length} row(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomSql(rep.sql);
                        handleRunCustomQuery(rep.sql);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 bg-white border border-slate-200 rounded hover:border-indigo-600"
                      title="Load into interactive query runner"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      Load in Runner
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopySql(rep.id, rep.sql)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:text-slate-900"
                      title="Copy SQL"
                    >
                      {copiedId === rep.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy SQL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* SQL Code Block */}
                <pre className="px-4 py-2.5 bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                  {rep.sql}
                </pre>

                {/* Live Result Table */}
                <DynamicResultTable rows={rep.rows} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No report queries in this category"
            description="Select 'All Queries' to view all SQL reports."
          />
        )}
      </section>
    </div>
  );
}
