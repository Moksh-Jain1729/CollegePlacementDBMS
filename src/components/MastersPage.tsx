import React, { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2, Plus, X } from 'lucide-react';
import { apiRequest } from '../api.ts';
import { Department, Company, Tpo, UserPersona, UserPermissions } from '../types.ts';
import { recordInteraction } from '../permissions.ts';
import {
  TableSkeleton,
  EmptyState,
  ConfirmModal,
  SortableTh,
  sortRows,
  Pagination,
  paginateRows,
} from './Common.tsx';

export default function MastersPage({
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
  const [tab, setTab] = useState<'departments' | 'companies' | 'tpos'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tpos, setTpos] = useState<Tpo[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [tab]);

  const [deptSort, setDeptSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'dept_id',
    dir: 'asc',
  });
  const [compSort, setCompSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'company_id',
    dir: 'asc',
  });
  const [tpoSort, setTpoSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'tpo_id',
    dir: 'asc',
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [field1, setField1] = useState('');
  const [field2, setField2] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [deptData, compData, tpoData] = await Promise.all([
        apiRequest<Department[]>('/api/departments'),
        apiRequest<Company[]>('/api/companies'),
        apiRequest<Tpo[]>('/api/tpos'),
      ]);
      setDepartments(deptData);
      setCompanies(compData);
      setTpos(tpoData);
      onSyncSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [onSyncSuccess, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTick]);

  const openAddModal = () => {
    setEditingId(null);
    setField1('');
    setField2('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditDepartment = (d: Department) => {
    setEditingId(d.dept_id);
    setField1(d.dept_name);
    setField2(d.hod_name || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditCompany = (c: Company) => {
    setEditingId(c.company_id);
    setField1(c.company_name);
    setField2(c.industry_type || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditTpo = (t: Tpo) => {
    setEditingId(t.tpo_id);
    setField1(t.name);
    setField2(t.email);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!field1.trim()) {
      setFormError('Primary name field is required.');
      return;
    }
    if (tab === 'tpos' && !field2.trim()) {
      setFormError('TPO email is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'departments') {
        const body = JSON.stringify({ dept_name: field1.trim(), hod_name: field2.trim() || null });
        if (editingId) {
          await apiRequest(`/api/departments/${editingId}`, { method: 'PUT', body });
          showToast('Department updated', 'success');
          recordInteraction(currentUser, 'Updated Department', `Department #${editingId}: ${field1.trim()}`, 'master');
        } else {
          await apiRequest('/api/departments', { method: 'POST', body });
          showToast('Department created', 'success');
          recordInteraction(currentUser, 'Created Department', `Added department: ${field1.trim()}`, 'master');
        }
      } else if (tab === 'companies') {
        const body = JSON.stringify({ company_name: field1.trim(), industry_type: field2.trim() || null });
        if (editingId) {
          await apiRequest(`/api/companies/${editingId}`, { method: 'PUT', body });
          showToast('Company updated', 'success');
          recordInteraction(currentUser, 'Updated Company', `Company #${editingId}: ${field1.trim()}`, 'master');
        } else {
          await apiRequest('/api/companies', { method: 'POST', body });
          showToast('Company created', 'success');
          recordInteraction(currentUser, 'Created Company', `Added recruiting company: ${field1.trim()}`, 'master');
        }
      } else {
        const body = JSON.stringify({ name: field1.trim(), email: field2.trim() });
        if (editingId) {
          await apiRequest(`/api/tpos/${editingId}`, { method: 'PUT', body });
          showToast('TPO updated', 'success');
          recordInteraction(currentUser, 'Updated TPO', `TPO Coordinator #${editingId}: ${field1.trim()}`, 'master');
        } else {
          await apiRequest('/api/tpos', { method: 'POST', body });
          showToast('TPO created', 'success');
          recordInteraction(currentUser, 'Created TPO', `Added TPO coordinator: ${field1.trim()}`, 'master');
        }
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/${tab}/${deleteTarget.id}`, { method: 'DELETE' });
      showToast(`${deleteTarget.name} deleted`, 'success');
      recordInteraction(
        currentUser,
        `Deleted ${tab === 'departments' ? 'Department' : tab === 'companies' ? 'Company' : 'TPO'}`,
        `Removed #${deleteTarget.id} (${deleteTarget.name})`,
        'master'
      );
      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      // Friendly foreign-key error message shown in red toast
      showToast(err.message, 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs & Add Button */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md">
          <button
            type="button"
            onClick={() => setTab('departments')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              tab === 'departments'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Departments ({departments.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('companies')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              tab === 'companies'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Companies ({companies.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('tpos')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              tab === 'tpos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            TPOs ({tpos.length})
          </button>
        </div>

        {permissions.canManageMasters ? (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add {tab === 'departments' ? 'Department' : tab === 'companies' ? 'Company' : 'TPO'}
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded">
            Modifications Restricted (TPO Admin only)
          </span>
        )}
      </div>

      {!permissions.canManageMasters && (
        <div className="bg-amber-50/70 border border-amber-200 text-amber-900 rounded-lg px-4 py-2.5 text-xs flex items-center justify-between">
          <span>
            <strong>Read-Only Access:</strong> Interacting as <strong>{currentUser.name}</strong> ({currentUser.roleLabel}). Institutional records (Departments, Companies, and TPO Coordinators) can only be altered by TPO Admins.
          </span>
        </div>
      )}

      {/* Tab Content */}
      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : tab === 'departments' ? (
        departments.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
                <tr>
                  <SortableTh
                    label="ID"
                    sortKey="dept_id"
                    currentSort={deptSort}
                    onSort={(key) =>
                      setDeptSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  />
                  <SortableTh
                    label="Department Name"
                    sortKey="dept_name"
                    currentSort={deptSort}
                    onSort={(key) =>
                      setDeptSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  />
                  <SortableTh
                    label="Head of Department (HOD)"
                    sortKey="hod_name"
                    currentSort={deptSort}
                    onSort={(key) =>
                      setDeptSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  />
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {paginateRows(sortRows(departments, deptSort), currentPage, pageSize).map((d) => (
                  <tr key={d.dept_id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-500">
                      #{d.dept_id}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{d.dept_name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{d.hod_name || '—'}</td>
                    <td className="py-2.5 px-4 text-right">
                      {permissions.canManageMasters ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDepartment(d)}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                            title="Edit Department"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: d.dept_id, name: d.dept_name })}
                            className="p-1 text-slate-500 hover:text-red-600 rounded"
                            title="Delete Department"
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
              totalItems={departments.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 25]}
              itemName="departments"
            />
          </div>
        ) : (
          <EmptyState
            title="No departments"
            description="Add an academic department."
            actionLabel="Add Department"
            onAction={openAddModal}
          />
        )
      ) : tab === 'companies' ? (
        companies.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
                <tr>
                  <SortableTh
                    label="ID"
                    sortKey="company_id"
                    currentSort={compSort}
                    onSort={(key) =>
                      setCompSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  />
                  <SortableTh
                    label="Company Name"
                    sortKey="company_name"
                    currentSort={compSort}
                    onSort={(key) =>
                      setCompSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  />
                  <SortableTh
                    label="Industry Type"
                    sortKey="industry_type"
                    currentSort={compSort}
                    onSort={(key) =>
                      setCompSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  />
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {paginateRows(sortRows(companies, compSort), currentPage, pageSize).map((c) => (
                  <tr key={c.company_id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-500">
                      #{c.company_id}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{c.company_name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{c.industry_type || '—'}</td>
                    <td className="py-2.5 px-4 text-right">
                      {permissions.canManageMasters ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditCompany(c)}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                            title="Edit Company"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: c.company_id, name: c.company_name })}
                            className="p-1 text-slate-500 hover:text-red-600 rounded"
                            title="Delete Company"
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
              totalItems={companies.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 25]}
              itemName="companies"
            />
          </div>
        ) : (
          <EmptyState
            title="No companies"
            description="Add recruiting partner companies."
            actionLabel="Add Company"
            onAction={openAddModal}
          />
        )
      ) : tpos.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
              <tr>
                <SortableTh
                  label="ID"
                  sortKey="tpo_id"
                  currentSort={tpoSort}
                  onSort={(key) =>
                    setTpoSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="TPO Name"
                  sortKey="name"
                  currentSort={tpoSort}
                  onSort={(key) =>
                    setTpoSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Email (UNIQUE)"
                  sortKey="email"
                  currentSort={tpoSort}
                  onSort={(key) =>
                    setTpoSort((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {paginateRows(sortRows(tpos, tpoSort), currentPage, pageSize).map((t) => (
                <tr key={t.tpo_id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-500">
                    #{t.tpo_id}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{t.name}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{t.email}</td>
                  <td className="py-2.5 px-4 text-right">
                    {permissions.canManageMasters ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditTpo(t)}
                          className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                          title="Edit TPO"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: t.tpo_id, name: t.name })}
                          className="p-1 text-slate-500 hover:text-red-600 rounded"
                          title="Delete TPO"
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
            totalItems={tpos.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 25]}
            itemName="TPOs"
          />
        </div>
      ) : (
        <EmptyState
          title="No TPO records"
          description="Add Training & Placement Officers."
          actionLabel="Add TPO"
          onAction={openAddModal}
        />
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-sm max-w-md w-full p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingId ? 'Edit' : 'Add'}{' '}
                {tab === 'departments' ? 'Department' : tab === 'companies' ? 'Company' : 'TPO'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tab === 'departments'
                    ? 'Department Name *'
                    : tab === 'companies'
                    ? 'Company Name *'
                    : 'TPO Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={field1}
                  onChange={(e) => setField1(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tab === 'departments'
                    ? 'HOD Name'
                    : tab === 'companies'
                    ? 'Industry Type'
                    : 'Email Address *'}
                </label>
                <input
                  type={tab === 'tpos' ? 'email' : 'text'}
                  required={tab === 'tpos'}
                  value={field2}
                  onChange={(e) => setField2(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Confirm Delete"
          message={`Are you sure you want to delete "${deleteTarget.name}"? If referenced by other records, the database foreign key constraint will prevent deletion.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
