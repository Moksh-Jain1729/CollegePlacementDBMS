import { Router } from 'express';
import pool from '../db.ts';

const router = Router();

export interface ReportDefinition {
  id: string;
  title: string;
  category: string;
  description: string;
  sql: string;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'high_cgpa_students',
    title: 'High-Performing Students (CGPA >= 8.5)',
    category: 'Schema Report Query',
    description: 'Lists students who have maintained a CGPA of 8.50 or above.',
    sql: `SELECT first_name, last_name, cgpa FROM STUDENT WHERE cgpa >= 8.5`,
  },
  {
    id: 'cgpa_aggregates',
    title: 'Overall CGPA Summary (AVG, MAX, MIN)',
    category: 'Schema Report Query',
    description: 'Computes the average, highest, and lowest CGPA across all registered students.',
    sql: `SELECT ROUND(AVG(cgpa), 2) AS average_cgpa, MAX(cgpa) AS highest_cgpa, MIN(cgpa) AS lowest_cgpa FROM STUDENT`,
  },
  {
    id: 'total_drives',
    title: 'Total Placement Drives Count',
    category: 'Schema Report Query',
    description: 'Counts the total number of placement drives scheduled.',
    sql: `SELECT COUNT(*) AS total_drives FROM DRIVE`,
  },
  {
    id: 'students_per_dept',
    title: 'Student Strength per Department',
    category: 'Schema Report Query',
    description: 'Uses a LEFT JOIN to count total students enrolled in each department.',
    sql: `SELECT d.dept_name, COUNT(s.student_id) AS total_students FROM DEPARTMENT d LEFT JOIN STUDENT s ON d.dept_id = s.dept_id GROUP BY d.dept_name`,
  },
  {
    id: 'company_package_bounds',
    title: 'Company Package Bounds (Highest & Lowest LPA)',
    category: 'Schema Report Query',
    description: 'Groups drives by company to display the highest and lowest offered packages.',
    sql: `SELECT c.company_name,
  MAX(d.max_package_lpa) AS highest_package,
  MIN(d.min_package_lpa) AS lowest_package
FROM COMPANY c JOIN DRIVE d ON c.company_id = d.company_id GROUP BY c.company_name`,
  },
  {
    id: 'may_drive_status_counts',
    title: 'Application Status Breakdown (Drives After 2026-05-01)',
    category: 'Schema Report Query',
    description: 'Counts applications by status for drives occurring after May 1, 2026.',
    sql: `SELECT a.status, COUNT(a.application_id) AS status_count FROM APPLICATION a JOIN DRIVE d ON a.drive_id = d.drive_id WHERE d.drive_date > '2026-05-01' GROUP BY a.status`,
  },
  {
    id: 'dept_avg_cgpa_having',
    title: 'Departments with Average CGPA > 8.0 (HAVING Clause)',
    category: 'Schema Report Query',
    description: 'Filters departments whose students have an average CGPA strictly above 8.0.',
    sql: `SELECT d.dept_name, ROUND(AVG(s.cgpa), 2) AS avg_dept_cgpa FROM DEPARTMENT d JOIN STUDENT s ON d.dept_id = s.dept_id GROUP BY d.dept_name HAVING AVG(s.cgpa) > 8.0`,
  },
  {
    id: 'view_student_age',
    title: 'Derived Student Age View (v_student_age)',
    category: 'SQL View',
    description: 'Queries the v_student_age view where age is dynamically computed from date_of_birth.',
    sql: `SELECT * FROM v_student_age`,
  },
  {
    id: 'view_placement_stats',
    title: 'Department Placement Analytics View (v_placement_stats)',
    category: 'SQL View',
    description: 'Queries the v_placement_stats view for total students, placed count, placement %, and avg package.',
    sql: `SELECT * FROM v_placement_stats`,
  },
  {
    id: 'all_eligible_pairs',
    title: 'Master Eligibility Matrix (All Eligible Student Drive Pairs)',
    category: 'Core Eligibility Query',
    description: 'Finds every student eligible for every drive across all weak-entity criteria sets and branches.',
    sql: `SELECT DISTINCT dr.drive_id, c.company_name,
  s.student_id, s.first_name, s.last_name, s.cgpa, s.backlogs
FROM DRIVE dr
JOIN COMPANY c ON c.company_id = dr.company_id
JOIN ELIGIBILITY_CRITERIA ec ON ec.drive_id = dr.drive_id
JOIN ELIGIBILITY_BRANCH eb ON eb.criteria_id = ec.criteria_id AND eb.drive_id = ec.drive_id
JOIN STUDENT s ON s.dept_id = eb.dept_id
WHERE s.cgpa >= ec.min_cgpa
  AND s.backlogs <= ec.max_backlogs
ORDER BY dr.drive_id, s.student_id`,
  },
  {
    id: 'unplaced_eligible_students',
    title: 'Unplaced Students & Their Open Drives Count',
    category: 'Custom Analytical Query',
    description: 'Identifies students who do not have a placement record yet and counts how many drives they qualify for.',
    sql: `SELECT s.student_id, s.first_name, s.last_name, d.dept_name, s.cgpa, s.backlogs,
  COUNT(DISTINCT dr.drive_id) AS eligible_drives_count
FROM STUDENT s
JOIN DEPARTMENT d ON s.dept_id = d.dept_id
LEFT JOIN APPLICATION a_placed ON a_placed.student_id = s.student_id
LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a_placed.application_id
LEFT JOIN ELIGIBILITY_BRANCH eb ON eb.dept_id = s.dept_id
LEFT JOIN ELIGIBILITY_CRITERIA ec ON ec.criteria_id = eb.criteria_id
  AND ec.drive_id = eb.drive_id
  AND s.cgpa >= ec.min_cgpa
  AND s.backlogs <= ec.max_backlogs
LEFT JOIN DRIVE dr ON dr.drive_id = ec.drive_id
WHERE pr.record_id IS NULL
GROUP BY s.student_id, s.first_name, s.last_name, d.dept_name, s.cgpa, s.backlogs
ORDER BY s.cgpa DESC`,
  },
  {
    id: 'interview_funnel_summary',
    title: 'Interview Round Funnel & Pass Rate by Company',
    category: 'Custom Analytical Query',
    description: 'Summarizes total interview rounds conducted, passed rounds, and failed rounds per company.',
    sql: `SELECT c.company_name,
  COUNT(ir.round_no) AS total_rounds_conducted,
  SUM(CASE WHEN ir.result = 'Passed' THEN 1 ELSE 0 END) AS rounds_passed,
  SUM(CASE WHEN ir.result = 'Failed' THEN 1 ELSE 0 END) AS rounds_failed,
  SUM(CASE WHEN ir.result = 'Pending' THEN 1 ELSE 0 END) AS rounds_pending
FROM COMPANY c
JOIN DRIVE dr ON dr.company_id = c.company_id
JOIN APPLICATION a ON a.drive_id = dr.drive_id
JOIN INTERVIEW_ROUND ir ON ir.application_id = a.application_id
GROUP BY c.company_id, c.company_name
ORDER BY total_rounds_conducted DESC`,
  },
  {
    id: 'tpo_workload_report',
    title: 'TPO Drive Coordination & Placement Summary',
    category: 'Custom Analytical Query',
    description: 'Shows each Training & Placement Officer along with drives managed, applications received, and placements closed.',
    sql: `SELECT t.tpo_id, t.name AS tpo_name, t.email,
  COUNT(DISTINCT dr.drive_id) AS drives_managed,
  COUNT(DISTINCT a.application_id) AS total_applications,
  COUNT(DISTINCT pr.record_id) AS confirmed_placements
FROM TPO t
LEFT JOIN DRIVE dr ON dr.tpo_id = t.tpo_id
LEFT JOIN APPLICATION a ON a.drive_id = dr.drive_id
LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a.application_id
GROUP BY t.tpo_id, t.name, t.email
ORDER BY drives_managed DESC`,
  },
  {
    id: 'complete_student_dossier',
    title: 'Complete Student Application & Offer Dossier',
    category: 'Custom Analytical Query',
    description: 'Joins STUDENT, DEPARTMENT, APPLICATION, DRIVE, COMPANY, and PLACEMENT_RECORD to show end-to-end status per student.',
    sql: `SELECT s.student_id, s.first_name, s.last_name, d.dept_name, s.cgpa,
  COALESCE(c.company_name, 'No Applications') AS company_name,
  COALESCE(a.status, 'Not Applied') AS application_status,
  pr.final_package AS offer_package_lpa,
  pr.offer_date
FROM STUDENT s
JOIN DEPARTMENT d ON s.dept_id = d.dept_id
LEFT JOIN APPLICATION a ON a.student_id = s.student_id
LEFT JOIN DRIVE dr ON dr.drive_id = a.drive_id
LEFT JOIN COMPANY c ON c.company_id = dr.company_id
LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a.application_id
ORDER BY s.student_id ASC, a.applied_date DESC`,
  },
];

/**
 * GET /api/reports
 * Executes all predefined SQL report queries and returns their SQL + live row sets.
 */
router.get('/', async (_req, res) => {
  try {
    const results = [];
    for (const def of REPORT_DEFINITIONS) {
      const [rows] = await pool.query(def.sql);
      results.push({
        ...def,
        rows: rows as Record<string, any>[],
      });
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to execute report queries' });
  }
});

/**
 * POST /api/reports/run
 * Executes a read-only SELECT query on C_PLACEMENT so users can inspect records directly.
 */
router.post('/run', async (req, res) => {
  const rawSql = String(req.body?.sql || '').trim();
  if (!rawSql) {
    return res.status(400).json({ error: 'SQL query is required' });
  }

  // Strip SQL comments for inspection and enforce read-only SELECT
  const cleaned = rawSql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();

  if (!/^(SELECT|WITH)\b/i.test(cleaned)) {
    return res.status(400).json({
      error: 'Only read-only SELECT queries are allowed in the interactive query runner.',
    });
  }

  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE)\b/i.test(cleaned)) {
    return res.status(400).json({
      error: 'Mutating statements are not allowed here. Use the app forms or MySQL Workbench.',
    });
  }

  try {
    const [rows] = await pool.query(cleaned);
    res.json({
      sql: cleaned,
      rowCount: Array.isArray(rows) ? rows.length : 0,
      rows: Array.isArray(rows) ? rows : [],
    });
  } catch (err: any) {
    res.status(400).json({ error: err.sqlMessage || err.message || 'Query execution failed' });
  }
});

export default router;
