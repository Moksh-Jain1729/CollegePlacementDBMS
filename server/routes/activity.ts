import { Router } from 'express';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  userRole: 'tpo_admin' | 'faculty_hod' | 'student' | 'recruiter';
  userRoleLabel: string;
  action: string;
  details: string;
  category: 'auth' | 'application' | 'drive' | 'student' | 'placement' | 'query' | 'master';
  ipAddress?: string;
}

const router = Router();

// In-memory persistent activity log with realistic seed events
const activityLog: ActivityEvent[] = [
  {
    id: 'act_seed_1',
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    userName: 'John Doe',
    userEmail: 'john.doe@college.edu',
    userRole: 'tpo_admin',
    userRoleLabel: 'TPO Admin',
    action: 'Drive Verified',
    details: 'Verified criteria sets for Google Campus Recruitment Drive 2026',
    category: 'drive',
  },
  {
    id: 'act_seed_2',
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    userName: 'Rahul Sharma',
    userEmail: 'rahul.sharma@student.edu',
    userRole: 'student',
    userRoleLabel: 'Student (CSE)',
    action: 'Application Submitted',
    details: 'Applied to Google Campus Drive (Application #1)',
    category: 'application',
  },
  {
    id: 'act_seed_3',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    userName: 'Dr. Alice Smith',
    userEmail: 'alice.smith@college.edu',
    userRole: 'faculty_hod',
    userRoleLabel: 'Faculty HOD (CSE)',
    action: 'Report Inspected',
    details: 'Inspected Department Placement Analytics View (v_placement_stats)',
    category: 'query',
  },
  {
    id: 'act_seed_4',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    userName: 'Google Campus Lead',
    userEmail: 'campus-hiring@google.com',
    userRole: 'recruiter',
    userRoleLabel: 'Recruiter (Google)',
    action: 'Interview Round Logged',
    details: 'Marked System Design & Coding passed for candidate Aarav Mehta',
    category: 'application',
  },
  {
    id: 'act_seed_5',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    userName: 'John Doe',
    userEmail: 'john.doe@college.edu',
    userRole: 'tpo_admin',
    userRoleLabel: 'TPO Admin',
    action: 'Offer Recorded',
    details: 'Recorded confirmed placement offer for Aarav Mehta at 22.00 LPA',
    category: 'placement',
  },
];

/**
 * GET /api/activity
 * Returns list of recent interactions and active sessions
 */
router.get('/', (_req, res) => {
  res.json({
    activities: activityLog.slice(0, 50),
    totalInteractions: activityLog.length,
    activeSessionsCount: Math.min(6, new Set(activityLog.slice(0, 10).map((a) => a.userName)).size + 1),
  });
});

/**
 * POST /api/activity
 * Logs a new user interaction
 */
router.post('/', (req, res) => {
  const { userName, userEmail, userRole, userRoleLabel, action, details, category } = req.body;

  if (!userName || !action) {
    return res.status(400).json({ error: 'User name and action are required' });
  }

  const newEvent: ActivityEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    userName: String(userName),
    userEmail: String(userEmail || ''),
    userRole: userRole || 'tpo_admin',
    userRoleLabel: userRoleLabel || 'TPO Admin',
    action: String(action),
    details: String(details || ''),
    category: category || 'application',
    ipAddress: req.ip || '127.0.0.1',
  };

  // Add to top of list
  activityLog.unshift(newEvent);

  // Keep last 150 items
  if (activityLog.length > 150) {
    activityLog.length = 150;
  }

  res.status(201).json(newEvent);
});

export default router;
