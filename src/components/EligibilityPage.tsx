import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../api.ts';
import { Drive, Student, UserPersona, UserPermissions } from '../types.ts';
import { recordInteraction } from '../permissions.ts';
import {
  StatusBadge,
  TableSkeleton,
  EmptyState,
  SortableTh,
  sortRows,
  formatDateDDMMYYYY,
  Pagination,
  paginateRows,
} from './Common.tsx';

interface EligibleStudentRow {
  drive_id: number;
  company_name: string;
  student_id: number;
  first_name: string;
  last_name: string;
  cgpa: number;
  backlogs: number;
  dept_name: string;
  application_id: number | null;
  application_status: string | null;
}

interface EligibleDriveRow {
  drive_id: number;
  company_name: string;
  drive_date: string;
  min_package_lpa: number | null;
  max_package_lpa: number | null;
  drive_link: string | null;
  application_id: number | null;
  application_status: string | null;
}

export default function EligibilityPage({
  refreshTick,
  onSyncSuccess,
  showToast,
  currentUser,
  permissions,
}: {
  refreshTick: number;
  onSyncSuccess: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  currentUser: UserPersona;
  permissions: UserPermissions;
}) {
  const [mode, setMode] = useState<'by-drive' | 'by-student'>('by-drive');
  const [drives, setDrives] = useState<Drive[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudentRow[]>([]);
  const [eligibleDrives, setEligibleDrives] = useState<EligibleDriveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page when mode or selection changes
  useEffect(() => {
    setCurrentPage(1);
  }, [mode, selectedDriveId, selectedStudentId]);

  const [stuSort, setStuSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'cgpa',
    dir: 'desc',
  });
  const [drSort, setDrSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'drive_date',
    dir: 'asc',
  });

  const fetchMasters = useCallback(async () => {
    try {
      const [drData, stData] = await Promise.all([
        apiRequest<Drive[]>('/api/drives'),
        apiRequest<Student[]>('/api/students'),
      ]);
      setDrives(drData);
      setStudents(stData);
      if (!selectedDriveId && drData.length > 0) {
        setSelectedDriveId(String(drData[0].drive_id));
      }
      if (!selectedStudentId && stData.length > 0) {
        setSelectedStudentId(String(stData[0].student_id));
      }
      onSyncSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [onSyncSuccess, showToast, selectedDriveId, selectedStudentId]);

  const fetchEligibilityResults = useCallback(async () => {
    try {
      if (mode === 'by-drive' && selectedDriveId) {
        const res = await apiRequest<EligibleStudentRow[]>(`/api/eligibility/drive/${selectedDriveId}`);
        setEligibleStudents(res);
      } else if (mode === 'by-student' && selectedStudentId) {
        const res = await apiRequest<EligibleDriveRow[]>(`/api/eligibility/student/${selectedStudentId}`);
        setEligibleDrives(res);
      }
      onSyncSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }, [mode, selectedDriveId, selectedStudentId, onSyncSuccess, showToast]);

  useEffect(() => {
    fetchMasters();
  }, [fetchMasters, refreshTick]);

  useEffect(() => {
    fetchEligibilityResults();
  }, [fetchEligibilityResults, refreshTick]);

  useEffect(() => {
    if (currentUser.role === 'student' && currentUser.studentId) {
      setMode('by-student');
      setSelectedStudentId(String(currentUser.studentId));
    }
  }, [currentUser]);

  const handleApply = async (studentId: number, driveId: number) => {
    if (!permissions.canApply) {
      showToast('Application submission is restricted for your persona.', 'error');
      return;
    }
    if (currentUser.role === 'student' && !permissions.canApplyForOthers && studentId !== currentUser.studentId) {
      showToast('You can only submit applications for your own student profile.', 'error');
      return;
    }
    const key = `${studentId}_${driveId}`;
    setApplyingKey(key);
    try {
      await apiRequest('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, drive_id: driveId }),
      });
      showToast('Application submitted', 'success');
      recordInteraction(
        currentUser,
        'Applied to Drive via Eligibility Explorer',
        `Student #${studentId} applied to Drive #${driveId}`,
        'application'
      );
      await fetchEligibilityResults();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setApplyingKey(null);
    }
  };

  const currentDrive = drives.find((d) => String(d.drive_id) === selectedDriveId);
  const currentStudent = students.find((s) => String(s.student_id) === selectedStudentId);

  return (
    <div className="space-y-4">
      {/* Mode Switcher & Selector Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
          <button
            type="button"
            onClick={() => setMode('by-drive')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              mode === 'by-drive'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mode A: Eligible Students for a Drive
          </button>
          <button
            type="button"
            onClick={() => setMode('by-student')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              mode === 'by-student'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mode B: Drives Open to a Student
          </button>
        </div>

        <div className="flex items-center gap-3">
          {mode === 'by-drive' ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Select Drive:</label>
              <select
                value={selectedDriveId}
                onChange={(e) => setSelectedDriveId(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
              >
                {drives.map((dr) => (
                  <option key={dr.drive_id} value={String(dr.drive_id)}>
                    #{dr.drive_id} • {dr.company_name} ({formatDateDDMMYYYY(dr.drive_date)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Select Student:</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
              >
                {students.map((st) => (
                  <option key={st.student_id} value={String(st.student_id)}>
                    #{st.student_id} • {st.first_name} {st.last_name} ({st.dept_name}, CGPA {st.cgpa.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Contextual Summary Banner */}
      {mode === 'by-drive' && currentDrive && (
        <div className="bg-white border border-slate-200 rounded-md p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-900">{currentDrive.company_name}</span> • Drive Date:{' '}
            <span className="font-mono">{formatDateDDMMYYYY(currentDrive.drive_date)}</span> • Package:{' '}
            <span className="font-mono">
              {currentDrive.min_package_lpa?.toFixed(2)} – {currentDrive.max_package_lpa?.toFixed(2)} LPA
            </span>
          </div>
          <div className="text-slate-500">
            {currentDrive.criteria.map((c) => (
              <span key={c.criteria_id} className="mr-3">
                Set #{c.criteria_id}: CGPA &ge; {c.min_cgpa.toFixed(2)}, Backlogs &le; {c.max_backlogs} (
                {c.branches.map((b) => b.dept_name).join(', ')})
              </span>
            ))}
          </div>
        </div>
      )}

      {mode === 'by-student' && currentStudent && (
        <div className="bg-white border border-slate-200 rounded-md p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-900">
              {currentStudent.first_name} {currentStudent.last_name}
            </span>{' '}
            • Department: <span className="font-medium text-slate-800">{currentStudent.dept_name}</span>
          </div>
          <div className="font-mono">
            CGPA: <span className="font-semibold text-slate-900">{currentStudent.cgpa.toFixed(2)}</span> |
            Backlogs: <span className="font-semibold text-slate-900">{currentStudent.backlogs}</span>
          </div>
        </div>
      )}

      {/* Results Table */}
      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : mode === 'by-drive' ? (
        eligibleStudents.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
                <tr>
                  <SortableTh
                    label="Student ID"
                    sortKey="student_id"
                    currentSort={stuSort}
                    onSort={(key) =>
                      setStuSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  />
                  <SortableTh
                    label="Student Name"
                    sortKey="first_name"
                    currentSort={stuSort}
                    onSort={(key) =>
                      setStuSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  />
                  <SortableTh
                    label="Department"
                    sortKey="dept_name"
                    currentSort={stuSort}
                    onSort={(key) =>
                      setStuSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  />
                  <SortableTh
                    label="CGPA"
                    sortKey="cgpa"
                    currentSort={stuSort}
                    onSort={(key) =>
                      setStuSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                    align="right"
                  />
                  <SortableTh
                    label="Backlogs"
                    sortKey="backlogs"
                    currentSort={stuSort}
                    onSort={(key) =>
                      setStuSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                    align="right"
                  />
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {paginateRows(sortRows(eligibleStudents, stuSort), currentPage, pageSize).map((st) => {
                  const key = `${st.student_id}_${st.drive_id}`;
                  return (
                    <tr key={st.student_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500">
                        #{st.student_id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{st.first_name} {st.last_name}</span>
                          {currentUser.studentId === st.student_id && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              You (Active)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{st.dept_name}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {st.cgpa.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {st.backlogs}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {st.application_id ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs text-slate-500">Applied:</span>
                            <StatusBadge status={st.application_status || 'Applied'} />
                          </div>
                        ) : !permissions.canApply ? (
                          <span className="text-xs text-slate-400 italic">Apply restricted</span>
                        ) : currentUser.role === 'student' && !permissions.canApplyForOthers && st.student_id !== currentUser.studentId ? (
                          <span className="text-xs text-slate-400 italic">Self-only</span>
                        ) : (
                          <button
                            type="button"
                            disabled={applyingKey === key}
                            onClick={() => handleApply(st.student_id, st.drive_id)}
                            style={{ backgroundColor: 'var(--color-brand)' }}
                            className="min-h-[34px] px-3.5 py-1.5 text-xs font-semibold text-white rounded-md hover:opacity-95 disabled:opacity-50"
                          >
                            {applyingKey === key ? 'Applying...' : 'Apply'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <Pagination
              currentPage={currentPage}
              totalItems={eligibleStudents.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50]}
              itemName="eligible students"
            />
          </div>
        ) : (
          <EmptyState
            title="No eligible students for this drive"
            description="None of the students currently satisfy the CGPA, backlog, and branch criteria sets of this drive."
          />
        )
      ) : eligibleDrives.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
              <tr>
                <SortableTh
                  label="Drive ID"
                  sortKey="drive_id"
                  currentSort={drSort}
                  onSort={(key) =>
                    setDrSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Company"
                  sortKey="company_name"
                  currentSort={drSort}
                  onSort={(key) =>
                    setDrSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Drive Date (DD-MM-YYYY)"
                  sortKey="drive_date"
                  currentSort={drSort}
                  onSort={(key) =>
                    setDrSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Package Range"
                  sortKey="max_package_lpa"
                  currentSort={drSort}
                  onSort={(key) =>
                    setDrSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                  align="right"
                />
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {paginateRows(sortRows(eligibleDrives, drSort), currentPage, pageSize).map((dr) => {
                const stId = Number(selectedStudentId);
                const key = `${stId}_${dr.drive_id}`;
                return (
                  <tr key={dr.drive_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500">
                      #{dr.drive_id}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{dr.company_name}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600">
                      {formatDateDDMMYYYY(dr.drive_date)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {dr.min_package_lpa?.toFixed(2)} – {dr.max_package_lpa?.toFixed(2)} LPA
                    </td>
                      <td className="py-2.5 px-4 text-right">
                        {dr.application_id ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs text-slate-500">Applied:</span>
                            <StatusBadge status={dr.application_status || 'Applied'} />
                          </div>
                        ) : !permissions.canApply ? (
                          <span className="text-xs text-slate-400 italic">Apply restricted</span>
                        ) : currentUser.role === 'student' && !permissions.canApplyForOthers && stId !== currentUser.studentId ? (
                          <span className="text-xs text-slate-400 italic">Self-only</span>
                        ) : (
                          <button
                            type="button"
                            disabled={applyingKey === key}
                            onClick={() => handleApply(stId, dr.drive_id)}
                            className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {applyingKey === key ? 'Applying...' : 'Apply'}
                          </button>
                        )}
                      </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalItems={eligibleDrives.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20]}
            itemName="eligible drives"
          />
        </div>
      ) : (
        <EmptyState
          title="No open drives for this student"
          description="This student does not currently meet the eligibility criteria for any scheduled placement drive."
        />
      )}
    </div>
  );
}
