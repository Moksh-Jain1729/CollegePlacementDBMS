import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import { apiRequest } from '../api.ts';
import { Student, Department, UserPersona, UserPermissions } from '../types.ts';
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

export default function StudentsPage({
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
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [minCgpaFilter, setMinCgpaFilter] = useState<string>('all');
  const [backlogFilter, setBacklogFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'student_id',
    dir: 'asc',
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 whenever search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, deptFilter, minCgpaFilter, backlogFilter]);

  // Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cgpa, setCgpa] = useState('8.00');
  const [backlogs, setBacklogs] = useState('0');
  const [dob, setDob] = useState('2004-01-15');
  const [deptId, setDeptId] = useState('');
  const [phones, setPhones] = useState<string[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirm state
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [stuData, deptData] = await Promise.all([
        apiRequest<Student[]>('/api/students'),
        apiRequest<Department[]>('/api/departments'),
      ]);
      setStudents(stuData);
      setDepartments(deptData);
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
    setEditingStudent(null);
    setFirstName('');
    setLastName('');
    setCgpa('8.00');
    setBacklogs('0');
    setDob('2004-05-10');
    setDeptId(departments[0]?.dept_id ? String(departments[0].dept_id) : '');
    setPhones([]);
    setPhoneInput('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (st: Student) => {
    setEditingStudent(st);
    setFirstName(st.first_name);
    setLastName(st.last_name);
    setCgpa(st.cgpa.toFixed(2));
    setBacklogs(String(st.backlogs));
    setDob(st.date_of_birth || '');
    setDeptId(String(st.dept_id));
    setPhones([...st.phones]);
    setPhoneInput('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleAddPhone = () => {
    const trimmed = phoneInput.trim();
    if (!trimmed) return;
    if (phones.includes(trimmed)) {
      setFormError('Phone number already added');
      return;
    }
    setPhones([...phones, trimmed]);
    setPhoneInput('');
    setFormError(null);
  };

  const handleRemovePhone = (phone: string) => {
    setPhones(phones.filter((p) => p !== phone));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numCgpa = Number(cgpa);
    const numBacklogs = Number(backlogs);
    if (!firstName.trim() || !lastName.trim()) {
      setFormError('First name and last name are required.');
      return;
    }
    if (isNaN(numCgpa) || numCgpa < 0 || numCgpa > 10) {
      setFormError('CGPA must be between 0.00 and 10.00.');
      return;
    }
    if (isNaN(numBacklogs) || numBacklogs < 0 || !Number.isInteger(numBacklogs)) {
      setFormError('Backlogs must be a non-negative integer (0 or more).');
      return;
    }
    if (!deptId) {
      setFormError('Please select a department.');
      return;
    }

    // Include any pending phone typed in phoneInput
    const finalPhones = [...phones];
    if (phoneInput.trim() && !finalPhones.includes(phoneInput.trim())) {
      finalPhones.push(phoneInput.trim());
    }

    setSubmitting(true);
    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        cgpa: numCgpa,
        backlogs: numBacklogs,
        date_of_birth: dob || null,
        dept_id: Number(deptId),
        phones: finalPhones,
      };

      if (editingStudent) {
        await apiRequest(`/api/students/${editingStudent.student_id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Student updated', 'success');
        recordInteraction(
          currentUser,
          'Updated Student',
          `Updated #${editingStudent.student_id} (${payload.first_name} ${payload.last_name}, CGPA ${payload.cgpa})`,
          'student'
        );
      } else {
        await apiRequest('/api/students', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Student added', 'success');
        recordInteraction(
          currentUser,
          'Added Student',
          `Registered ${payload.first_name} ${payload.last_name} in Dept #${payload.dept_id}`,
          'student'
        );
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
    if (!studentToDelete) return;
    try {
      await apiRequest(`/api/students/${studentToDelete.student_id}`, { method: 'DELETE' });
      showToast('Student deleted', 'success');
      recordInteraction(
        currentUser,
        'Deleted Student',
        `Removed #${studentToDelete.student_id} (${studentToDelete.first_name} ${studentToDelete.last_name})`,
        'student'
      );
      setStudentToDelete(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      setStudentToDelete(null);
    }
  };

  const filteredStudents = students.filter((st) => {
    const matchesDept = deptFilter === 'all' || String(st.dept_id) === deptFilter;
    const matchesCgpa = minCgpaFilter === 'all' || st.cgpa >= Number(minCgpaFilter);
    const matchesBacklogs =
      backlogFilter === 'all' ||
      (backlogFilter === '0' ? st.backlogs === 0 : st.backlogs <= Number(backlogFilter));

    const q = search.trim().toLowerCase();
    if (!q) return matchesDept && matchesCgpa && matchesBacklogs;

    const fullName = `${st.first_name} ${st.last_name}`.toLowerCase();
    const deptName = st.dept_name.toLowerCase();
    const phoneMatch = st.phones.some((p) => p.toLowerCase().includes(q));
    return (
      matchesDept &&
      matchesCgpa &&
      matchesBacklogs &&
      (fullName.includes(q) || deptName.includes(q) || phoneMatch)
    );
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, branch, phone..."
              className="w-full min-h-[40px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700 transition-colors"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Filter by Department"
            className="min-h-[40px] px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700 transition-colors"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.dept_id} value={String(d.dept_id)}>
                {d.dept_name}
              </option>
            ))}
          </select>
          <select
            value={minCgpaFilter}
            onChange={(e) => setMinCgpaFilter(e.target.value)}
            aria-label="Filter by Minimum CGPA"
            className="min-h-[40px] px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700 transition-colors"
          >
            <option value="all">Any CGPA</option>
            <option value="9">CGPA &ge; 9.0</option>
            <option value="8.5">CGPA &ge; 8.5</option>
            <option value="8">CGPA &ge; 8.0</option>
            <option value="7.5">CGPA &ge; 7.5</option>
          </select>
          <select
            value={backlogFilter}
            onChange={(e) => setBacklogFilter(e.target.value)}
            aria-label="Filter by Backlogs"
            className="min-h-[40px] px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-700 transition-colors"
          >
            <option value="all">Any Backlogs</option>
            <option value="0">0 Backlogs Only</option>
            <option value="1">&le; 1 Backlog</option>
          </select>
        </div>

        </div>

        {permissions.canManageStudents ? (
          <button
            type="button"
            onClick={openAddModal}
            style={{ backgroundColor: 'var(--color-brand)' }}
            className="min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-lg hover:opacity-95 transition-opacity whitespace-nowrap shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg whitespace-nowrap">
              Add Restricted (TPO Admin only)
            </span>
          </div>
        )}
      </div>

      {!permissions.canManageStudents && (
        <div className="bg-amber-50/70 border border-amber-200 text-amber-900 rounded-lg px-4 py-2.5 text-xs flex items-center justify-between">
          <span>
            <strong>Read-Only Mode:</strong> Interacting as <strong>{currentUser.name}</strong> ({currentUser.roleLabel}). Student records can only be created, modified, or deleted by TPO Admins.
          </span>
        </div>
      )}

      {/* Table */}
      {loading && students.length === 0 ? (
        <TableSkeleton rows={5} cols={7} />
      ) : filteredStudents.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
              <tr>
                <SortableTh
                  label="ID"
                  sortKey="student_id"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                />
                <SortableTh
                  label="Student Name"
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
                  label="CGPA"
                  sortKey="cgpa"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                  align="right"
                />
                <SortableTh
                  label="Backlogs"
                  sortKey="backlogs"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                  align="right"
                />
                <SortableTh
                  label="DOB / Age (v_student_age)"
                  sortKey="age"
                  currentSort={sortConfig}
                  onSort={(key) =>
                    setSortConfig((p) => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }))
                  }
                  align="right"
                />
                <th className="py-3 px-4">Phones (STUDENT_PHONE)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {paginateRows(sortRows(filteredStudents, sortConfig), currentPage, pageSize).map((st) => (
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
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {st.cgpa.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {st.backlogs}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                    {st.date_of_birth ? `${formatDateDDMMYYYY(st.date_of_birth)} • ` : ''}
                    <span className="font-semibold text-slate-800">
                      {st.age !== null ? `${st.age} yrs` : '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-600">
                    {st.phones.length > 0 ? st.phones.join(' • ') : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {permissions.canManageStudents ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(st)}
                          className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-500 hover:text-indigo-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit Student"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToDelete(st)}
                          className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Student"
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
            totalItems={filteredStudents.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50]}
            itemName="students"
          />
        </div>
      ) : (
        <EmptyState
          title="No matching students found"
          description="Try clearing your search filter or add a new student record."
          actionLabel="Add Student"
          onAction={openAddModal}
        />
      )}

      {/* Add / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-sm max-w-lg w-full p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingStudent ? 'Edit Student' : 'Add Student'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">CGPA (0–10) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    required
                    value={cgpa}
                    onChange={(e) => setCgpa(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Backlogs (&ge;0) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={backlogs}
                    onChange={(e) => setBacklogs(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department *</label>
                <select
                  required
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                >
                  <option value="">Select department...</option>
                  {departments.map((d) => (
                    <option key={d.dept_id} value={String(d.dept_id)}>
                      {d.dept_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Multivalued STUDENT_PHONE input */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Numbers (stored in STUDENT_PHONE)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPhone();
                      }
                    }}
                    placeholder="e.g. 9876543210"
                    className="flex-1 px-3 py-1.5 text-sm font-mono border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhone}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 whitespace-nowrap"
                  >
                    Add Phone
                  </button>
                </div>

                {phones.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {phones.map((ph) => (
                      <span
                        key={ph}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-200 text-slate-700 rounded"
                      >
                        {ph}
                        <button
                          type="button"
                          onClick={() => handleRemovePhone(ph)}
                          className="text-slate-400 hover:text-red-600"
                          title="Remove phone"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
                  {submitting ? 'Saving...' : editingStudent ? 'Update Student' : 'Create Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {studentToDelete && (
        <ConfirmModal
          title="Delete Student"
          message={`Are you sure you want to delete ${studentToDelete.first_name} ${studentToDelete.last_name}? Associated phone numbers in STUDENT_PHONE will cascade delete.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setStudentToDelete(null)}
        />
      )}
    </div>
  );
}
