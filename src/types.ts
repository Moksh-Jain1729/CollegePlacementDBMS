export interface Department {
  dept_id: number;
  dept_name: string;
  hod_name: string | null;
}

export interface Company {
  company_id: number;
  company_name: string;
  industry_type: string | null;
}

export interface Tpo {
  tpo_id: number;
  name: string;
  email: string;
}

export interface Student {
  student_id: number;
  first_name: string;
  last_name: string;
  cgpa: number;
  backlogs: number;
  date_of_birth: string | null;
  dept_id: number;
  dept_name: string;
  age: number | null;
  phones: string[];
}

export interface CriteriaBranch {
  dept_id: number;
  dept_name: string;
}

export interface EligibilityCriteria {
  criteria_id: number;
  drive_id: number;
  min_cgpa: number;
  max_backlogs: number;
  branches: CriteriaBranch[];
  dept_ids: number[];
}

export interface Drive {
  drive_id: number;
  drive_link: string | null;
  min_package_lpa: number | null;
  max_package_lpa: number | null;
  drive_date: string;
  company_id: number;
  company_name: string;
  industry_type: string | null;
  tpo_id: number;
  tpo_name: string;
  tpo_email: string;
  criteria: EligibilityCriteria[];
}

export interface InterviewRound {
  round_no: number;
  application_id: number;
  round_name: string;
  result: 'Passed' | 'Failed' | 'Pending';
}

export interface Application {
  application_id: number;
  applied_date: string;
  status: 'Applied' | 'Shortlisted' | 'Selected' | 'Rejected';
  student_id: number;
  first_name: string;
  last_name: string;
  cgpa: number;
  backlogs: number;
  dept_name: string;
  drive_id: number;
  drive_date: string;
  min_package_lpa: number | null;
  max_package_lpa: number | null;
  company_id: number;
  company_name: string;
  record_id: number | null;
  final_package: number | null;
  offer_date: string | null;
  rounds: InterviewRound[];
}

export interface DepartmentStat {
  dept_name: string;
  total_students: number;
  placed_students: number;
  placement_percent: number | null;
  avg_package_lpa: number | null;
}

export interface DashboardData {
  stats: {
    total_students: number;
    total_companies: number;
    total_drives: number;
    total_applications: number;
    placed_students: number;
    avg_package: number;
  };
  departmentStats: DepartmentStat[];
  recentApplications: {
    application_id: number;
    applied_date: string;
    status: 'Applied' | 'Shortlisted' | 'Selected' | 'Rejected';
    student_id: number;
    first_name: string;
    last_name: string;
    dept_name: string;
    drive_id: number;
    drive_date: string;
    company_name: string;
  }[];
}

export interface PlacementRecord {
  record_id: number;
  final_package: number;
  offer_date: string;
  application_id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  cgpa: number;
  dept_name: string;
  drive_id: number;
  drive_date: string;
  company_id: number;
  company_name: string;
  industry_type: string | null;
}

export interface PlacementsData {
  summary: {
    total_offers: number;
    placed_students: number;
    avg_package: number;
    highest_package: number;
    lowest_package: number;
  };
  records: PlacementRecord[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export type UserRole = 'tpo_admin' | 'faculty_hod' | 'student' | 'recruiter';

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  departmentId?: number;
  departmentName?: string;
  studentId?: number;
  companyId?: number;
  companyName?: string;
  avatarColor: string;
}

export interface UserPermissions {
  canManageDrives: boolean;
  canManageStudents: boolean;
  canApply: boolean;
  canApplyForOthers: boolean;
  canManageApplications: boolean;
  canManageRounds: boolean;
  canMarkPlaced: boolean;
  canManageMasters: boolean;
  canExecuteSql: boolean;
  canViewAnalytics: boolean;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  userRoleLabel: string;
  action: string;
  details: string;
  category: 'auth' | 'application' | 'drive' | 'student' | 'placement' | 'query' | 'master';
  ipAddress?: string;
}

