import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, ExternalLink, X } from 'lucide-react';
import { apiRequest } from '../api.ts';
import { Drive, Company, Tpo, Department, EligibilityCriteria, UserPersona, UserPermissions } from '../types.ts';
import { recordInteraction } from '../permissions.ts';
import {
  TableSkeleton,
  EmptyState,
  ConfirmModal,
  SortableTh,
  sortRows,
  formatDateDDMMYYYY,
  Pagination,
  paginateRows,
} from './Common.tsx';

export default function DrivesPage({
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
  const [drives, setDrives] = useState<Drive[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tpos, setTpos] = useState<Tpo[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'drive_date',
    dir: 'asc',
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Drive Add/Edit Modal State
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [editingDrive, setEditingDrive] = useState<Drive | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [tpoId, setTpoId] = useState('');
  const [driveDate, setDriveDate] = useState('2026-06-01');
  const [minPkg, setMinPkg] = useState('8.00');
  const [maxPkg, setMaxPkg] = useState('15.00');
  const [driveLink, setDriveLink] = useState('');
  const [driveFormError, setDriveFormError] = useState<string | null>(null);
  const [submittingDrive, setSubmittingDrive] = useState(false);

  // Criteria Management Modal (for a selected drive)
  const [activeDriveForCriteria, setActiveDriveForCriteria] = useState<Drive | null>(null);
  const [editingCriteria, setEditingCriteria] = useState<EligibilityCriteria | null>(null);
  const [critMinCgpa, setCritMinCgpa] = useState('7.50');
  const [critMaxBacklogs, setCritMaxBacklogs] = useState('0');
  const [critDeptIds, setCritDeptIds] = useState<number[]>([]);
  const [critError, setCritError] = useState<string | null>(null);
  const [submittingCrit, setSubmittingCrit] = useState(false);

  // Delete Drive Confirm
  const [driveToDelete, setDriveToDelete] = useState<Drive | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [drData, compData, tpoData, deptData] = await Promise.all([
        apiRequest<Drive[]>('/api/drives'),
        apiRequest<Company[]>('/api/companies'),
        apiRequest<Tpo[]>('/api/tpos'),
        apiRequest<Department[]>('/api/departments'),
      ]);
      setDrives(drData);
      setCompanies(compData);
      setTpos(tpoData);
      setDepartments(deptData);

      // Update activeDriveForCriteria if open
      if (activeDriveForCriteria) {
        const updated = drData.find((d) => d.drive_id === activeDriveForCriteria.drive_id);
        if (updated) setActiveDriveForCriteria(updated);
      }
      onSyncSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [onSyncSuccess, showToast, activeDriveForCriteria]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTick]);

  const openAddDrive = () => {
    setEditingDrive(null);
    setCompanyId(companies[0]?.company_id ? String(companies[0].company_id) : '');
    setTpoId(tpos[0]?.tpo_id ? String(tpos[0].tpo_id) : '');
    setDriveDate('2026-06-01');
    setMinPkg('8.00');
    setMaxPkg('14.00');
    setDriveLink('https://');
    setDriveFormError(null);
    setIsDriveModalOpen(true);
  };

  const openEditDrive = (dr: Drive) => {
    setEditingDrive(dr);
    setCompanyId(String(dr.company_id));
    setTpoId(String(dr.tpo_id));
    setDriveDate(dr.drive_date);
    setMinPkg(dr.min_package_lpa !== null ? dr.min_package_lpa.toFixed(2) : '0.00');
    setMaxPkg(dr.max_package_lpa !== null ? dr.max_package_lpa.toFixed(2) : '0.00');
    setDriveLink(dr.drive_link || '');
    setDriveFormError(null);
    setIsDriveModalOpen(true);
  };

  const handleSaveDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriveFormError(null);

    const minP = Number(minPkg);
    const maxP = Number(maxPkg);

    if (!companyId || !tpoId || !driveDate) {
      setDriveFormError('Company, TPO, and Drive Date are required.');
      return;
    }
    if (isNaN(minP) || isNaN(maxP) || minP < 0) {
      setDriveFormError('Packages must be valid non-negative numbers.');
      return;
    }
    if (maxP < minP) {
      setDriveFormError('Max package must be greater than or equal to min package.');
      return;
    }

    setSubmittingDrive(true);
    try {
      const payload: any = {
        company_id: Number(companyId),
        tpo_id: Number(tpoId),
        drive_date: driveDate,
        min_package_lpa: minP,
        max_package_lpa: maxP,
        drive_link: driveLink.trim() || null,
      };

      if (editingDrive) {
        await apiRequest(`/api/drives/${editingDrive.drive_id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Placement drive updated', 'success');
        recordInteraction(
          currentUser,
          'Updated Placement Drive',
          `Updated Drive #${editingDrive.drive_id} (${editingDrive.company_name})`,
          'drive'
        );
      } else {
        // Default initial criteria set so new drive is immediately ready or editable
        payload.criteria =
          departments.length > 0
            ? [{ min_cgpa: 7.5, max_backlogs: 0, dept_ids: departments.map((d) => d.dept_id) }]
            : [];
        await apiRequest('/api/drives', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Placement drive created', 'success');
        recordInteraction(
          currentUser,
          'Scheduled Placement Drive',
          `Created drive on ${payload.drive_date} for Company #${payload.company_id}`,
          'drive'
        );
      }
      setIsDriveModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setDriveFormError(err.message);
    } finally {
      setSubmittingDrive(false);
    }
  };

  const handleConfirmDeleteDrive = async () => {
    if (!driveToDelete) return;
    try {
      await apiRequest(`/api/drives/${driveToDelete.drive_id}`, { method: 'DELETE' });
      showToast('Drive and its criteria sets deleted', 'success');
      recordInteraction(
        currentUser,
        'Deleted Placement Drive',
        `Removed Drive #${driveToDelete.drive_id} (${driveToDelete.company_name})`,
        'drive'
      );
      setDriveToDelete(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      setDriveToDelete(null);
    }
  };

  // Criteria Drawer / Modal handlers
  const openCriteriaManager = (dr: Drive) => {
    setActiveDriveForCriteria(dr);
    setEditingCriteria(null);
    setCritMinCgpa('7.50');
    setCritMaxBacklogs('0');
    setCritDeptIds(departments.map((d) => d.dept_id));
    setCritError(null);
  };

  const startEditCriteria = (c: EligibilityCriteria) => {
    setEditingCriteria(c);
    setCritMinCgpa(c.min_cgpa.toFixed(2));
    setCritMaxBacklogs(String(c.max_backlogs));
    setCritDeptIds([...c.dept_ids]);
    setCritError(null);
  };

  const resetCriteriaForm = () => {
    setEditingCriteria(null);
    setCritMinCgpa('7.50');
    setCritMaxBacklogs('0');
    setCritDeptIds(departments.map((d) => d.dept_id));
    setCritError(null);
  };

  const toggleBranchSelection = (id: number) => {
    if (critDeptIds.includes(id)) {
      setCritDeptIds(critDeptIds.filter((d) => d !== id));
    } else {
      setCritDeptIds([...critDeptIds, id]);
    }
  };

  const handleSaveCriteria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDriveForCriteria) return;
    setCritError(null);

    const cg = Number(critMinCgpa);
    const bl = Number(critMaxBacklogs);
    if (isNaN(cg) || cg < 0 || cg > 10) {
      setCritError('Min CGPA must be between 0 and 10.');
      return;
    }
    if (isNaN(bl) || bl < 0 || !Number.isInteger(bl)) {
      setCritError('Max backlogs must be 0 or greater.');
      return;
    }
    if (critDeptIds.length === 0) {
      setCritError('Select at least one allowed branch.');
      return;
    }

    setSubmittingCrit(true);
    try {
      if (editingCriteria) {
        await apiRequest(
          `/api/drives/${activeDriveForCriteria.drive_id}/criteria/${editingCriteria.criteria_id}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              min_cgpa: cg,
              max_backlogs: bl,
              dept_ids: critDeptIds,
            }),
          }
        );
        showToast(`Criteria Set #${editingCriteria.criteria_id} updated`, 'success');
        recordInteraction(
          currentUser,
          'Updated Eligibility Criteria',
          `Drive #${activeDriveForCriteria.drive_id} (${activeDriveForCriteria.company_name}) Criteria #${editingCriteria.criteria_id}`,
          'drive'
        );
      } else {
        await apiRequest(`/api/drives/${activeDriveForCriteria.drive_id}/criteria`, {
          method: 'POST',
          body: JSON.stringify({
            min_cgpa: cg,
            max_backlogs: bl,
            dept_ids: critDeptIds,
          }),
        });
        showToast('New criteria set added (MAX+1)', 'success');
        recordInteraction(
          currentUser,
          'Added Eligibility Criteria',
          `Drive #${activeDriveForCriteria.drive_id} (${activeDriveForCriteria.company_name}) Min CGPA ${cg}`,
          'drive'
        );
      }
      resetCriteriaForm();
      await fetchData();
    } catch (err: any) {
      setCritError(err.message);
    } finally {
      setSubmittingCrit(false);
    }
  };

  const handleDeleteCriteria = async (criteriaId: number) => {
    if (!activeDriveForCriteria) return;
    try {
      await apiRequest(`/api/drives/${activeDriveForCriteria.drive_id}/criteria/${criteriaId}`, {
        method: 'DELETE',
      });
      showToast(`Criteria Set #${criteriaId} removed`, 'success');
      recordInteraction(
        currentUser,
        'Deleted Eligibility Criteria',
        `Removed Criteria #${criteriaId} for Drive #${activeDriveForCriteria.drive_id}`,
        'drive'
      );
      if (editingCriteria?.criteria_id === criteriaId) {
        resetCriteriaForm();
      }
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Action Bar */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md p-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Placement Drives & Eligibility Sets</h2>
          <p className="text-xs text-slate-500">
            Each drive supports multiple weak-entity criteria sets (<span className="font-mono">criteria_id</span>{' '}
            auto-increments per drive).
          </p>
        </div>
        {permissions.canManageDrives ? (
          <button
            type="button"
            onClick={openAddDrive}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Drive
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded">
            Scheduling Restricted (TPO Admin only)
          </span>
        )}
      </div>

      {!permissions.canManageDrives && (
        <div className="bg-amber-50/70 border border-amber-200 text-amber-900 rounded-lg px-4 py-2.5 text-xs flex items-center justify-between">
          <span>
            <strong>Read-Only Mode:</strong> Interacting as <strong>{currentUser.name}</strong> ({currentUser.roleLabel}). Placement drives and criteria rules can only be created or modified by TPO Admins.
          </span>
        </div>
      )}

      {/* Drives Table */}
      {loading && drives.length === 0 ? (
        <TableSkeleton rows={4} cols={6} />
      ) : drives.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
              <tr>
                <SortableTh
                  label="ID"
                  sortKey="drive_id"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Company & TPO"
                  sortKey="company_name"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Drive Date (DD-MM-YYYY)"
                  sortKey="drive_date"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Package Range"
                  sortKey="max_package_lpa"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                  align="right"
                />
                <th className="py-3 px-4">Registration Link</th>
                <th className="py-3 px-4">Eligibility Criteria Summary</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm align-top">
              {paginateRows(sortRows(drives, sortConfig), currentPage, pageSize).map((dr) => (
                <tr key={dr.drive_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500">#{dr.drive_id}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{dr.company_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {dr.industry_type || 'General'} • TPO: {dr.tpo_name}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                    {formatDateDDMMYYYY(dr.drive_date)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    {dr.min_package_lpa?.toFixed(2)} – {dr.max_package_lpa?.toFixed(2)} LPA
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {dr.drive_link ? (
                      <a
                        href={dr.drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:underline max-w-[180px] truncate"
                      >
                        <span>{dr.drive_link.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {dr.criteria.length > 0 ? (
                      <div className="space-y-1.5">
                        {dr.criteria.map((c) => (
                          <div key={c.criteria_id} className="text-xs text-slate-700">
                            <span className="font-mono font-semibold text-slate-900">
                              Set #{c.criteria_id}:
                            </span>{' '}
                            CGPA &ge; <span className="font-mono">{c.min_cgpa.toFixed(2)}</span> • Backlogs &le;{' '}
                            <span className="font-mono">{c.max_backlogs}</span> •{' '}
                            <span className="text-slate-500">
                              {c.branches.map((b) => b.dept_name).join(', ') || 'No branches'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700">No criteria sets defined</span>
                    )}
                    <button
                      type="button"
                      onClick={() => openCriteriaManager(dr)}
                      className="mt-2 text-xs font-medium text-indigo-600 hover:underline block"
                    >
                      Manage Criteria Sets ({dr.criteria.length})
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {permissions.canManageDrives ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditDrive(dr)}
                          className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                          title="Edit Drive"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDriveToDelete(dr)}
                          className="p-1 text-slate-500 hover:text-red-600 rounded"
                          title="Delete Drive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalItems={drives.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20]}
            itemName="drives"
          />
        </div>
      ) : (
        <EmptyState
          title="No placement drives scheduled"
          description="Create a drive and configure its eligibility criteria sets."
          actionLabel="New Drive"
          onAction={openAddDrive}
        />
      )}

      {/* Add / Edit Drive Modal */}
      {isDriveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-sm max-w-lg w-full p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingDrive ? `Edit Drive #${editingDrive.drive_id}` : 'Schedule New Drive'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDriveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDrive} className="mt-4 space-y-4">
              {driveFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                  {driveFormError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Company *</label>
                  <select
                    required
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Select company...</option>
                    {companies.map((c) => (
                      <option key={c.company_id} value={String(c.company_id)}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">TPO Coordinator *</label>
                  <select
                    required
                    value={tpoId}
                    onChange={(e) => setTpoId(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Select TPO...</option>
                    {tpos.map((t) => (
                      <option key={t.tpo_id} value={String(t.tpo_id)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Drive Date *</label>
                  <input
                    type="date"
                    required
                    value={driveDate}
                    onChange={(e) => setDriveDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Min Package (LPA) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={minPkg}
                    onChange={(e) => setMinPkg(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Max Package (LPA) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={maxPkg}
                    onChange={(e) => setMaxPkg(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Registration Link</label>
                <input
                  type="url"
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="https://careers.company.com/drive2026"
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDriveModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDrive}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submittingDrive ? 'Saving...' : editingDrive ? 'Save Changes' : 'Create Drive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Criteria Sets Modal (1 Drive : N Criteria Sets + Multi-Select Allowed Branches) */}
      {activeDriveForCriteria && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-sm max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Eligibility Criteria Sets — {activeDriveForCriteria.company_name} (Drive #
                  {activeDriveForCriteria.drive_id})
                </h3>
                <p className="text-xs text-slate-500">
                  A student qualifies if ANY criteria set of this drive passes on CGPA, backlogs, and branch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDriveForCriteria(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Existing Criteria Sets Table */}
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Current Criteria Sets</h4>
              {activeDriveForCriteria.criteria.length > 0 ? (
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="py-2 px-3">Set #</th>
                        <th className="py-2 px-3 text-right">Min CGPA</th>
                        <th className="py-2 px-3 text-right">Max Backlogs</th>
                        <th className="py-2 px-3">Allowed Branches (ELIGIBILITY_BRANCH)</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeDriveForCriteria.criteria.map((c) => (
                        <tr key={c.criteria_id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono tabular-nums text-xs font-semibold text-slate-800">
                            #{c.criteria_id}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {c.min_cgpa.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{c.max_backlogs}</td>
                          <td className="py-2 px-3 text-xs text-slate-600">
                            {c.branches.map((b) => b.dept_name).join(' • ') || 'None'}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            {permissions.canManageDrives ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditCriteria(c)}
                                  className="text-xs font-medium text-indigo-600 hover:underline mr-3"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCriteria(c.criteria_id)}
                                  className="text-xs font-medium text-red-600 hover:underline"
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Read-only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded p-4 text-xs text-slate-500 text-center">
                  No criteria sets configured for this drive yet.
                </div>
              )}
            </div>

            {/* Add / Edit Criteria Set Form (Gated) */}
            {permissions.canManageDrives ? (
              <form
                onSubmit={handleSaveCriteria}
                className="mt-5 bg-slate-50 border border-slate-200 rounded-md p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-900">
                    {editingCriteria
                      ? `Edit Criteria Set #${editingCriteria.criteria_id}`
                      : 'Add New Criteria Set (criteria_id = MAX + 1)'}
                  </h4>
                {editingCriteria && (
                  <button
                    type="button"
                    onClick={resetCriteriaForm}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              {critError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                  {critError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Minimum CGPA (0–10) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    required
                    value={critMinCgpa}
                    onChange={(e) => setCritMinCgpa(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Maximum Backlogs (&ge;0) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={critMaxBacklogs}
                    onChange={(e) => setCritMaxBacklogs(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Allowed Branches (Multi-Select Departments) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {departments.map((dept) => {
                    const checked = critDeptIds.includes(dept.dept_id);
                    return (
                      <label
                        key={dept.dept_id}
                        className={`flex items-center gap-2 px-3 py-2 rounded border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-indigo-50/60 border-indigo-600 text-slate-900 font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBranchSelection(dept.dept_id)}
                          className="accent-indigo-600"
                        />
                        <span className="truncate">{dept.dept_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingCrit}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submittingCrit
                    ? 'Saving...'
                    : editingCriteria
                    ? `Update Set #${editingCriteria.criteria_id}`
                    : 'Add Criteria Set'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-5 p-4 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-500 text-center">
              Criteria rule configuration is restricted to TPO Admins.
            </div>
          )}
          </div>
        </div>
      )}

      {/* Delete Drive Confirmation */}
      {driveToDelete && (
        <ConfirmModal
          title="Delete Placement Drive"
          message={`Are you sure you want to delete the drive for ${driveToDelete.company_name} on ${driveToDelete.drive_date}? All associated eligibility criteria and allowed branch mappings will cascade delete.`}
          onConfirm={handleConfirmDeleteDrive}
          onCancel={() => setDriveToDelete(null)}
        />
      )}
    </div>
  );
}
