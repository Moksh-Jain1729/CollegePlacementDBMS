import { Router } from 'express';
import pool from '../db.ts';

const router = Router();

/**
 * GET /api/dashboard
 * Returns summary stat cards, placement-by-department stats (from v_placement_stats),
 * and the 5 most recent applications.
 */
router.get('/', async (_req, res) => {
  try {
    const [[studentCountRow]] = await pool.query('SELECT COUNT(*) AS count FROM STUDENT');
    const [[companyCountRow]] = await pool.query('SELECT COUNT(*) AS count FROM COMPANY');
    const [[driveCountRow]] = await pool.query('SELECT COUNT(*) AS count FROM DRIVE');
    const [[appCountRow]] = await pool.query('SELECT COUNT(*) AS count FROM APPLICATION');
    const [[placedRow]] = await pool.query(
      'SELECT COUNT(DISTINCT a.student_id) AS placed_students, ROUND(AVG(pr.final_package), 2) AS avg_package FROM PLACEMENT_RECORD pr JOIN APPLICATION a ON pr.application_id = a.application_id'
    );

    // Placement stats per department directly from v_placement_stats view
    const [departmentStats] = await pool.query('SELECT * FROM v_placement_stats');

    // 5 most recent applications
    const [recentApplications] = await pool.query(`
      SELECT a.application_id, a.applied_date, a.status,
             s.student_id, s.first_name, s.last_name, d.dept_name,
             dr.drive_id, dr.drive_date, c.company_name
      FROM APPLICATION a
      JOIN STUDENT s ON a.student_id = s.student_id
      JOIN DEPARTMENT d ON s.dept_id = d.dept_id
      JOIN DRIVE dr ON a.drive_id = dr.drive_id
      JOIN COMPANY c ON dr.company_id = c.company_id
      ORDER BY a.applied_date DESC, a.application_id DESC
      LIMIT 5
    `);

    res.json({
      stats: {
        total_students: Number(studentCountRow?.count || 0),
        total_companies: Number(companyCountRow?.count || 0),
        total_drives: Number(driveCountRow?.count || 0),
        total_applications: Number(appCountRow?.count || 0),
        placed_students: Number(placedRow?.placed_students || 0),
        avg_package: placedRow?.avg_package !== null && placedRow?.avg_package !== undefined
          ? Number(placedRow.avg_package)
          : 0,
      },
      departmentStats,
      recentApplications,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to load dashboard data' });
  }
});

export default router;
