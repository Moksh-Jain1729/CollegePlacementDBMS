import { UserPersona, UserRole, UserPermissions, ActivityEvent } from './types.ts';
import { apiRequest } from './api.ts';

export const PRESET_PERSONAS: UserPersona[] = [
  {
    id: 'user_tpo_john',
    name: 'John Doe',
    email: 'john.doe@college.edu',
    role: 'tpo_admin',
    roleLabel: 'TPO Admin (Full Access)',
    avatarColor: '#4338CA', // Indigo
  },
  {
    id: 'user_hod_alice',
    name: 'Dr. Alice Smith',
    email: 'alice.smith@college.edu',
    role: 'faculty_hod',
    roleLabel: 'Faculty HOD (CSE)',
    departmentId: 1,
    departmentName: 'Computer Science and Engineering',
    avatarColor: '#0D9488', // Teal
  },
  {
    id: 'user_student_rahul',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@student.edu',
    role: 'student',
    roleLabel: 'Student (CSE #1)',
    studentId: 1,
    departmentId: 1,
    departmentName: 'Computer Science and Engineering',
    avatarColor: '#2563EB', // Blue
  },
  {
    id: 'user_student_priya',
    name: 'Priya Patel',
    email: 'priya.patel@student.edu',
    role: 'student',
    roleLabel: 'Student (CSE #2)',
    studentId: 2,
    departmentId: 1,
    departmentName: 'Computer Science and Engineering',
    avatarColor: '#7C3AED', // Violet
  },
  {
    id: 'user_recruiter_google',
    name: 'Sarah Connor',
    email: 'campus-hiring@google.com',
    role: 'recruiter',
    roleLabel: 'Recruiter (Google)',
    companyId: 1,
    companyName: 'Google',
    avatarColor: '#EA580C', // Orange
  },
];

export function getPermissionsForRole(role: UserRole): UserPermissions {
  switch (role) {
    case 'tpo_admin':
      return {
        canManageDrives: true,
        canManageStudents: true,
        canApply: true,
        canApplyForOthers: true,
        canManageApplications: true,
        canManageRounds: true,
        canMarkPlaced: true,
        canManageMasters: true,
        canExecuteSql: true,
        canViewAnalytics: true,
      };
    case 'faculty_hod':
      return {
        canManageDrives: false,
        canManageStudents: false,
        canApply: false,
        canApplyForOthers: false,
        canManageApplications: false,
        canManageRounds: false,
        canMarkPlaced: false,
        canManageMasters: false,
        canExecuteSql: true,
        canViewAnalytics: true,
      };
    case 'student':
      return {
        canManageDrives: false,
        canManageStudents: false,
        canApply: true,
        canApplyForOthers: false,
        canManageApplications: false,
        canManageRounds: false,
        canMarkPlaced: false,
        canManageMasters: false,
        canExecuteSql: false,
        canViewAnalytics: true,
      };
    case 'recruiter':
      return {
        canManageDrives: false,
        canManageStudents: false,
        canApply: false,
        canApplyForOthers: false,
        canManageApplications: true,
        canManageRounds: true,
        canMarkPlaced: false,
        canManageMasters: false,
        canExecuteSql: false,
        canViewAnalytics: true,
      };
    default:
      return {
        canManageDrives: false,
        canManageStudents: false,
        canApply: false,
        canApplyForOthers: false,
        canManageApplications: false,
        canManageRounds: false,
        canMarkPlaced: false,
        canManageMasters: false,
        canExecuteSql: false,
        canViewAnalytics: true,
      };
  }
}

/**
 * Send an activity log event to the backend server
 */
export async function recordInteraction(
  user: UserPersona,
  action: string,
  details: string,
  category: ActivityEvent['category']
): Promise<void> {
  try {
    await apiRequest('/api/activity', {
      method: 'POST',
      body: JSON.stringify({
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        userRoleLabel: user.roleLabel,
        action,
        details,
        category,
      }),
    });
  } catch {
    // Non-blocking interaction recording
  }
}
