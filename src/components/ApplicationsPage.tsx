import React, { useEffect, useState, useCallback } from 'react';
import { Plus, ListChecks, Award, Trash2, X, Pencil, Search, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api.ts';
import { Application, Student, Drive, InterviewRound, UserPersona, UserPermissions } from '../types.ts';
import { recordInteraction } from '../permissions.ts';
import {
  StatusBadge,
  TableSkeleton,
  EmptyState,
  ConfirmModal,
  SortableTh,
  sortRows,
  formatDateDDMMYYYY,
  Pagination,
  paginateRows,
} from './Common.tsx';

/**
 * Helper that computes a friendly, specific reason if a student is not eligible for a drive
 * (e.g., "Not eligible: CGPA below 9.00 for Electronics and Communication")
 */
function getIneligibilityReason(student?: Student, drive?: Drive): string | null {
  if (!student || !drive) return null;
  if (!drive.criteria || drive.criteria.length === 0) {
    return 'Not eligible: No eligibility criteria sets have been configured for this drive.';
  }

  // Check if ANY criteria set passes
  const qualifies = drive.criteria.some(
    (c) =>
      c.dept_ids.includes(student.dept_id) &&
      student.cgpa >= c.min_cgpa &&
      student.backlogs <= c.max_backlogs
  );

  if (qualifies) return null;

  // Find criteria sets that allow the student's branch to give a specific CGPA/backlog message
  const branchMatchingSets = drive.criteria.filter((c) => c.dept_ids.includes(student.dept_id));
  if (branchMatchingSets.length === 0) {
    return `Not eligible: ${student.dept_name} branch is not in the allowed branches for ${drive.company_name}.`;
  }

  const reasons: string[] = [];
  for (const c of branchMatchingSets) {
    const sub: string[] = [];
    if (student.cgpa < c.min_cgpa) {
      sub.push(`CGPA ${student.cgpa.toFixed(2)} is below required ${c.min_cgpa.toFixed(2)}`);
    }
    if (student.backlogs > c.max_backlogs) {
      sub.push(`Backlogs (${student.backlogs}) exceed maximum allowed (${c.max_backlogs})`);
    }
    if (sub.length > 0) {
      reasons.push(sub.join(' and '));
    }
  }

  return `Not eligible: ${reasons.join('; ')}.`;
}

export default function ApplicationsPage({
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
  const [applications, setApplications] = useState<Application[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter state for Applications Table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDriveId, setFilterDriveId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'application_id',
    dir: 'desc',
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 on filter or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDriveId, filterStatus, filterDept]);

  // New Application Form State
  const [studentId, setStudentId] = useState('');
  const [driveId, setDriveId] = useState('');
  const [appliedDate, setAppliedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submittingApp, setSubmittingApp] = useState(false);

  // Side Panel for Interview Rounds
  const [activeAppForRounds, setActiveAppForRounds] = useState<Application | null>(null);
  const [editingRound, setEditingRound] = useState<InterviewRound | null>(null);
  const [roundName, setRoundName] = useState('');
  const [roundResult, setRoundResult] = useState<'Passed' | 'Failed' | 'Pending'>('Pending');
  const [savingRound, setSavingRound] = useState(false);

  // Mark Placed Modal State
  const [appToPlace, setAppToPlace] = useState<Application | null>(null);
  const [finalPackage, setFinalPackage] = useState('');
  const [offerDate, setOfferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [placingError, setPlacingError] = useState<string | null>(null);
  const [submittingPlace, setSubmittingPlace] = useState(false);

  // Delete application confirm
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [appData, stData, drData] = await Promise.all([
        apiRequest<Application[]>('/api/applications'),
        apiRequest<Student[]>('/api/students'),
        apiRequest<Drive[]>('/api/drives'),
      ]);
      setApplications(appData);
      setStudents(stData);
      setDrives(drData);
      if (currentUser.role === 'student' && currentUser.studentId) {
        setStudentId(String(currentUser.studentId));
      } else if (!studentId && stData.length > 0) {
        setStudentId(String(stData[0].student_id));
      }
      if (!driveId && drData.length > 0) setDriveId(String(drData[0].drive_id));

      if (activeAppForRounds) {
        const refreshed = appData.find((a) => a.application_id === activeAppForRounds.application_id);
        if (refreshed) setActiveAppForRounds(refreshed);
      }
      onSyncSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [onSyncSuccess, showToast, studentId, driveId, activeAppForRounds, currentUser]);

  useEffect(() => {
    if (currentUser.role === 'student' && currentUser.studentId) {
      setStudentId(String(currentUser.studentId));
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTick]);

  const selectedStudentObj = students.find((s) => String(s.student_id) === studentId);
  const selectedDriveObj = drives.find((d) => String(d.drive_id) === driveId);
  const ineligibilityDetail = getIneligibilityReason(selectedStudentObj, selectedDriveObj);

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !driveId) {
      showToast('Select both a student and a drive', 'error');
      return;
    }
    setSubmittingApp(true);
    try {
      await apiRequest('/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          student_id: Number(studentId),
          drive_id: Number(driveId),
          applied_date: appliedDate,
        }),
      });
      showToast('Application submitted successfully', 'success');
      recordInteraction(
        currentUser,
        'Submitted Application',
        `${selectedStudentObj ? `${selectedStudentObj.first_name} ${selectedStudentObj.last_name}` : `Student #${studentId}`} applied to ${selectedDriveObj ? selectedDriveObj.company_name : `Drive #${driveId}`}`,
        'application'
      );
      await fetchData();
    } catch (err: any) {
      // Combine DB trigger message with specific CGPA/backlog/branch explanation if applicable
      const friendlyMsg =
        ineligibilityDetail && err.message.includes('not eligible')
          ? `${err.message} (${ineligibilityDetail})`
          : err.message;
      showToast(friendlyMsg, 'error');
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleStatusChange = async (appId: number, newStatus: string) => {
    try {
      await apiRequest(`/api/applications/${appId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(`Status updated to ${newStatus}`, 'success');
      recordInteraction(
        currentUser,
        'Updated Application Status',
        `Application #${appId} changed to ${newStatus}`,
        'application'
      );
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const openRoundsPanel = (app: Application) => {
    setActiveAppForRounds(app);
    setEditingRound(null);
    setRoundName('');
    setRoundResult('Pending');
  };

  const startEditRound = (r: InterviewRound) => {
    setEditingRound(r);
    setRoundName(r.round_name);
    setRoundResult(r.result);
  };

  const handleSaveRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppForRounds || !roundName.trim()) return;
    setSavingRound(true);
    try {
      if (editingRound) {
        await apiRequest(
          `/api/applications/${activeAppForRounds.application_id}/rounds/${editingRound.round_no}`,
          {
            method: 'PUT',
            body: JSON.stringify({ round_name: roundName.trim(), result: roundResult }),
          }
        );
        showToast(`Round #${editingRound.round_no} updated`, 'success');
        recordInteraction(
          currentUser,
          'Updated Interview Round',
          `App #${activeAppForRounds.application_id} Round #${editingRound.round_no} (${roundName.trim()} -> ${roundResult})`,
          'application'
        );
      } else {
        await apiRequest(`/api/applications/${activeAppForRounds.application_id}/rounds`, {
          method: 'POST',
          body: JSON.stringify({ round_name: roundName.trim(), result: roundResult }),
        });
        showToast('Interview round added', 'success');
        recordInteraction(
          currentUser,
          'Added Interview Round',
          `App #${activeAppForRounds.application_id} Round: ${roundName.trim()} (${roundResult})`,
          'application'
        );
      }
      setEditingRound(null);
      setRoundName('');
      setRoundResult('Pending');
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingRound(false);
    }
  };

  const handleDeleteRound = async (roundNo: number) => {
    if (!activeAppForRounds) return;
    try {
      await apiRequest(`/api/applications/${activeAppForRounds.application_id}/rounds/${roundNo}`, {
        method: 'DELETE',
      });
      showToast(`Round #${roundNo} deleted`, 'success');
      recordInteraction(
        currentUser,
        'Deleted Interview Round',
        `App #${activeAppForRounds.application_id} Round #${roundNo}`,
        'application'
      );
      if (editingRound?.round_no === roundNo) {
        setEditingRound(null);
        setRoundName('');
      }
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const openMarkPlacedModal = (app: Application) => {
    setAppToPlace(app);
    setFinalPackage(app.min_package_lpa ? app.min_package_lpa.toFixed(2) : '10.00');
    setOfferDate(new Date().toISOString().split('T')[0]);
    setPlacingError(null);
  };

  const handleConfirmMarkPlaced = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appToPlace) return;
    setPlacingError(null);

    const pkg = Number(finalPackage);
    if (isNaN(pkg) || pkg <= 0) {
      setPlacingError('Final package must be a positive number (LPA).');
      return;
    }
    if (!offerDate) {
      setPlacingError('Offer date is required.');
      return;
    }

    setSubmittingPlace(true);
    try {
      await apiRequest(`/api/applications/${appToPlace.application_id}/place`, {
        method: 'POST',
        body: JSON.stringify({ final_package: pkg, offer_date: offerDate }),
      });
      showToast('Student marked placed and status set to Selected', 'success');
      recordInteraction(
        currentUser,
        'Recorded Placement Offer',
        `Candidate #${appToPlace.student_id} (${appToPlace.first_name} ${appToPlace.last_name}) placed at ${appToPlace.company_name} for ${pkg.toFixed(2)} LPA`,
        'placement'
      );
      setAppToPlace(null);
      await fetchData();
    } catch (err: any) {
      setPlacingError(err.message);
    } finally {
      setSubmittingPlace(false);
    }
  };

  const handleConfirmDeleteApp = async () => {
    if (!appToDelete) return;
    try {
      await apiRequest(`/api/applications/${appToDelete.application_id}`, { method: 'DELETE' });
      showToast('Application deleted', 'success');
      recordInteraction(
        currentUser,
        'Deleted Application',
        `App #${appToDelete.application_id} (${appToDelete.first_name} ${appToDelete.last_name})`,
        'application'
      );
      setAppToDelete(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      setAppToDelete(null);
    }
  };

  const uniqueDepts = Array.from(new Set(applications.map((a) => a.dept_name))).sort();

  const filteredApplications = applications.filter((app) => {
    const matchesDrive = filterDriveId === 'all' || String(app.drive_id) === filterDriveId;
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    const matchesDept = filterDept === 'all' || app.dept_name === filterDept;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesDrive && matchesStatus && matchesDept;

    const studentName = `${app.first_name} ${app.last_name}`.toLowerCase();
    const compName = app.company_name.toLowerCase();
    return (
      matchesDrive &&
      matchesStatus &&
      matchesDept &&
      (studentName.includes(q) || compName.includes(q) || app.dept_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Create Application Card (Gated) */}
      {permissions.canApply ? (
        <form
          onSubmit={handleCreateApplication}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Submit New Application</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Validated by MySQL trigger <span className="font-mono">trg_check_eligibility</span> and{' '}
                <span className="font-mono">UNIQUE(student_id, drive_id)</span>
              </p>
            </div>
            {currentUser.role === 'student' && (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Applying as yourself: #{currentUser.studentId}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Student {currentUser.role === 'student' ? '(Locked to your active persona)' : ''}
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={currentUser.role === 'student' && !permissions.canApplyForOthers}
                className="w-full min-h-[40px] px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700 disabled:opacity-80 disabled:cursor-not-allowed"
              >
                {students.map((st) => (
                  <option key={st.student_id} value={String(st.student_id)}>
                    {st.first_name} {st.last_name} ({st.dept_name} • CGPA {st.cgpa.toFixed(2)} • Backlogs{' '}
                    {st.backlogs})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Placement Drive</label>
              <select
                value={driveId}
                onChange={(e) => setDriveId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700"
              >
                {drives.map((dr) => (
                  <option key={dr.drive_id} value={String(dr.drive_id)}>
                    Drive #{dr.drive_id} • {dr.company_name} ({formatDateDDMMYYYY(dr.drive_date)})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Applied Date</label>
                <input
                  type="date"
                  value={appliedDate}
                  onChange={(e) => setAppliedDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700"
                />
              </div>
              <button
                type="submit"
                disabled={submittingApp}
                style={{ backgroundColor: 'var(--color-brand)' }}
                className="self-end min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg hover:opacity-95 disabled:opacity-50 whitespace-nowrap shadow-xs"
              >
                <Plus className="w-4 h-4" />
                {submittingApp ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </div>

          {/* Friendly Inline Eligibility Warning (still allows clicking Apply to test the DB trigger toast) */}
          {ineligibilityDetail && (
            <div
              style={{
                backgroundColor: 'var(--status-warning-bg)',
                color: 'var(--status-warning-text)',
                borderColor: 'var(--status-warning-border)',
              }}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {ineligibilityDetail} (Submitting will trigger the database{' '}
                <span className="font-mono">BEFORE INSERT</span> error.)
              </span>
            </div>
          )}
        </form>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-center justify-between">
          <span>
            <strong>Application Submission Restricted:</strong> Interacting as <strong>{currentUser.name}</strong> ({currentUser.roleLabel}). Applications can only be submitted by registered Students or TPO Admins.
          </span>
        </div>
      )}

      {/* Filter Bar for Applications Table */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or company..."
              className="w-full min-h-[40px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700"
            />
          </div>
          <select
            value={filterDriveId}
            onChange={(e) => setFilterDriveId(e.target.value)}
            aria-label="Filter by Drive"
            className="min-h-[40px] px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700"
          >
            <option value="all">All Drives</option>
            {drives.map((dr) => (
              <option key={dr.drive_id} value={String(dr.drive_id)}>
                Drive #{dr.drive_id} • {dr.company_name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by Status"
            className="min-h-[40px] px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700"
          >
            <option value="all">All Statuses</option>
            <option value="Applied">Applied</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Selected">Selected</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            aria-label="Filter by Department"
            className="min-h-[40px] px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700"
          >
            <option value="all">All Departments</option>
            {uniqueDepts.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs font-mono text-slate-500">
          Showing {filteredApplications.length} of {applications.length} applications
        </div>
      </div>

      {/* Applications Table */}
      {loading && applications.length === 0 ? (
        <TableSkeleton rows={5} cols={6} />
      ) : filteredApplications.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
              <tr>
                <SortableTh
                  label="ID"
                  sortKey="application_id"
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
                  label="Company & Drive"
                  sortKey="company_name"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Applied Date (DD-MM-YYYY)"
                  sortKey="applied_date"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Status"
                  sortKey="status"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <th className="py-3 px-4">Interview Rounds</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {paginateRows(sortRows(filteredApplications, sortConfig), currentPage, pageSize).map((app) => (
                <tr key={app.application_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500">
                    #{app.application_id}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      <span>{app.first_name} {app.last_name}</span>
                      {currentUser.studentId === app.student_id && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                          You (Active)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {app.dept_name} • CGPA <span className="font-mono">{app.cgpa.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{app.company_name}</div>
                    <div className="text-xs text-slate-500 font-mono">Drive #{app.drive_id}</div>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                    {formatDateDDMMYYYY(app.applied_date)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={app.status} />
                      {permissions.canManageApplications && (
                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.application_id, e.target.value)}
                          aria-label="Change application status"
                          className="min-h-[34px] text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-700"
                        >
                          <option value="Applied">Applied</option>
                          <option value="Shortlisted">Shortlisted</option>
                          <option value="Selected">Selected</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => openRoundsPanel(app)}
                      className="min-h-[34px] inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:underline"
                    >
                      <ListChecks className="w-4 h-4" />
                      <span>Rounds ({app.rounds.length})</span>
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      {app.record_id ? (
                        <StatusBadge status={`Placed • ${app.final_package?.toFixed(2)} LPA`} />
                      ) : permissions.canMarkPlaced ? (
                        <button
                          type="button"
                          onClick={() => openMarkPlacedModal(app)}
                          className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                        >
                          <Award className="w-3.5 h-3.5" />
                          Mark Placed
                        </button>
                      ) : null}
                      {permissions.canManageApplications && (
                        <button
                          type="button"
                          onClick={() => setAppToDelete(app)}
                          className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Application"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredApplications.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50]}
            itemName="applications"
          />
        </div>
      ) : (
        <EmptyState
          title="No matching applications found"
          description="Try clearing your search or status filter, or submit a new application above."
        />
      )}

      {/* Side Panel for Interview Rounds */}
      {activeAppForRounds && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-[1px]">
          <div className="bg-white border-l border-slate-200 w-full max-w-md h-full flex flex-col justify-between overflow-y-auto p-6 shadow-xl">
            <div className="space-y-6">
              <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Interview Rounds</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {activeAppForRounds.first_name} {activeAppForRounds.last_name} •{' '}
                    {activeAppForRounds.company_name} (App #{activeAppForRounds.application_id})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAppForRounds(null)}
                  className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-slate-700">
                  Recorded Rounds (round_no auto-increments)
                </h4>
                {activeAppForRounds.rounds.length > 0 ? (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    {activeAppForRounds.rounds.map((r) => (
                      <div key={r.round_no} className="p-3.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            <span className="font-mono text-xs text-slate-500 mr-1.5">#{r.round_no}</span>
                            {r.round_name}
                          </div>
                          <div className="mt-1.5">
                            <StatusBadge status={r.result} />
                          </div>
                        </div>
                        {permissions.canManageRounds && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditRound(r)}
                              className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center text-slate-500 hover:text-indigo-700 rounded-md"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRound(r.round_no)}
                              className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center text-slate-500 hover:text-red-600 rounded-md"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-xs text-slate-500 text-center">
                    No interview rounds logged for this application yet.
                  </div>
                )}
              </div>

              {permissions.canManageRounds ? (
                <form
                  onSubmit={handleSaveRound}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3.5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-900">
                      {editingRound ? `Edit Round #${editingRound.round_no}` : 'Add Interview Round'}
                    </h4>
                    {editingRound && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRound(null);
                          setRoundName('');
                          setRoundResult('Pending');
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Round Name *</label>
                    <input
                      type="text"
                      required
                      value={roundName}
                      onChange={(e) => setRoundName(e.target.value)}
                      placeholder="e.g. Online Assessment, Technical Interview 1"
                      className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-indigo-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Result *</label>
                    <select
                      value={roundResult}
                      onChange={(e) => setRoundResult(e.target.value as any)}
                      className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-indigo-700"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Passed">Passed</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={savingRound}
                    style={{ backgroundColor: 'var(--color-brand)' }}
                    className="w-full min-h-[40px] py-2 text-xs font-semibold text-white rounded-md hover:opacity-95 disabled:opacity-50"
                  >
                    {savingRound
                      ? 'Saving...'
                      : editingRound
                      ? `Update Round #${editingRound.round_no}`
                      : 'Add Round'}
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                  Interview round scoring and additions are restricted to Recruiters and TPO Admins.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveAppForRounds(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {appToPlace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Mark Student Placed</h3>
              <button
                type="button"
                onClick={() => setAppToPlace(null)}
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmMarkPlaced} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Creates a <span className="font-mono">PLACEMENT_RECORD</span> for{' '}
                <span className="font-semibold text-slate-900">
                  {appToPlace.first_name} {appToPlace.last_name}
                </span>{' '}
                at <span className="font-semibold text-slate-900">{appToPlace.company_name}</span> and sets
                status to <span className="font-semibold">Selected</span> in one transaction.
              </p>

              {placingError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs">
                  {placingError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Final Package (LPA) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  required
                  value={finalPackage}
                  onChange={(e) => setFinalPackage(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:border-indigo-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Offer Date *</label>
                <input
                  type="date"
                  required
                  value={offerDate}
                  onChange={(e) => setOfferDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:border-indigo-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAppToPlace(null)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPlace}
                  style={{ backgroundColor: 'var(--color-brand)' }}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white rounded-md hover:opacity-95 disabled:opacity-50"
                >
                  {submittingPlace ? 'Recording...' : 'Confirm Placement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {appToDelete && (
        <ConfirmModal
          title="Delete Application"
          message={`Delete application #${appToDelete.application_id} for ${appToDelete.first_name} ${appToDelete.last_name} (${appToDelete.company_name})?`}
          onConfirm={handleConfirmDeleteApp}
          onCancel={() => setAppToDelete(null)}
        />
      )}
    </div>
  );
}
