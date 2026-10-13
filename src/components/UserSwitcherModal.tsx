import React, { useState } from 'react';
import { X, Check, ShieldCheck, ShieldAlert, User, Briefcase, GraduationCap, Building2 } from 'lucide-react';
import { UserPersona, Student } from '../types.ts';
import { PRESET_PERSONAS, getPermissionsForRole } from '../permissions.ts';

export default function UserSwitcherModal({
  currentUser,
  allStudents,
  onSelectUser,
  onClose,
}: {
  currentUser: UserPersona;
  allStudents: Student[];
  onSelectUser: (user: UserPersona) => void;
  onClose: () => void;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const currentPermissions = getPermissionsForRole(currentUser.role);

  const permissionItems = [
    { label: 'Manage Drives & Eligibility Sets', granted: currentPermissions.canManageDrives },
    { label: 'Manage Student Profiles & Phones', granted: currentPermissions.canManageStudents },
    { label: 'Submit Drive Applications', granted: currentPermissions.canApply },
    { label: 'Apply on Behalf of Other Students', granted: currentPermissions.canApplyForOthers },
    { label: 'Update Application Pipeline Status', granted: currentPermissions.canManageApplications },
    { label: 'Conduct & Score Interview Rounds', granted: currentPermissions.canManageRounds },
    { label: 'Verify & Mark Placed Offers', granted: currentPermissions.canMarkPlaced },
    { label: 'Manage Master Data (Depts, Companies, TPOs)', granted: currentPermissions.canManageMasters },
    { label: 'Execute Custom SQL Engine Queries', granted: currentPermissions.canExecuteSql },
    { label: 'View Department Placement Analytics', granted: currentPermissions.canViewAnalytics },
  ];

  const handleSelectStudentPersona = (studentIdStr: string) => {
    const sId = Number(studentIdStr);
    const stu = allStudents.find((s) => s.student_id === sId);
    if (!stu) return;

    const studentPersona: UserPersona = {
      id: `user_student_${stu.student_id}`,
      name: `${stu.first_name} ${stu.last_name}`,
      email: `${stu.first_name.toLowerCase()}.${stu.last_name.toLowerCase()}@student.edu`,
      role: 'student',
      roleLabel: `Student (${stu.dept_name.split(' ')[0]} #${stu.student_id})`,
      studentId: stu.student_id,
      departmentId: stu.dept_id,
      departmentName: stu.dept_name,
      avatarColor: '#2563EB',
    };
    onSelectUser(studentPersona);
    onClose();
  };

  const getRoleIcon = (role: UserPersona['role']) => {
    switch (role) {
      case 'tpo_admin':
        return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
      case 'faculty_hod':
        return <Building2 className="w-4 h-4 text-teal-600" />;
      case 'student':
        return <GraduationCap className="w-4 h-4 text-blue-600" />;
      case 'recruiter':
        return <Briefcase className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-700" />
              <h2 className="text-lg font-bold text-slate-900">User Identity & Access Management</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select who is interacting with the campus placement portal to enforce real-time role-based permissions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-md"
            aria-label="Close user switcher"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active User Callout */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0"
              style={{ backgroundColor: currentUser.avatarColor }}
            >
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{currentUser.name}</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-slate-200 text-slate-700">
                  {currentUser.roleLabel}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">{currentUser.email}</div>
            </div>
          </div>

          <div className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md w-fit">
            Active Session Interacting Now
          </div>
        </div>

        {/* Personas Selection Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Switch Interacting Persona
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRESET_PERSONAS.map((persona) => {
              const isSelected = persona.id === currentUser.id;
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => {
                    onSelectUser(persona);
                    onClose();
                  }}
                  className={`text-left p-3.5 rounded-lg border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5 shadow-xs"
                    style={{ backgroundColor: persona.avatarColor }}
                  >
                    {persona.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900 truncate">{persona.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-600">
                      {getRoleIcon(persona.role)}
                      <span className="truncate">{persona.roleLabel}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      {persona.email}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Student Switcher */}
        {allStudents.length > 0 && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Or Interact as any Registered Student ({allStudents.length} available):
            </label>
            <div className="flex gap-2">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="flex-1 min-h-[38px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-indigo-700 font-medium"
              >
                <option value="">Select a student from C_PLACEMENT...</option>
                {allStudents.map((s) => (
                  <option key={s.student_id} value={String(s.student_id)}>
                    #{s.student_id} {s.first_name} {s.last_name} ({s.dept_name} • CGPA {s.cgpa.toFixed(2)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedStudentId}
                onClick={() => handleSelectStudentPersona(selectedStudentId)}
                className="min-h-[38px] px-4 py-1.5 text-xs font-semibold text-white bg-indigo-700 rounded-md hover:bg-indigo-800 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                Switch to Student
              </button>
            </div>
          </div>
        )}

        {/* Permissions Breakdown for Selected Role */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Permissions for {currentUser.name} ({currentUser.roleLabel})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {permissionItems.map((item) => (
              <div
                key={item.label}
                className={`flex items-center justify-between p-2.5 rounded border transition-colors ${
                  item.granted
                    ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <span className="font-medium pr-2">{item.label}</span>
                {item.granted ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded text-[11px] shrink-0">
                    <Check className="w-3.5 h-3.5" /> Allowed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded text-[11px] shrink-0">
                    <ShieldAlert className="w-3.5 h-3.5" /> Restricted
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
