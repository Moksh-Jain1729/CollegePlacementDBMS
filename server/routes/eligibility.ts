import { Router } from 'express';
import pool from '../db.ts';

const router = Router();

/**
 * GET /api/eligibility/drive/:id
 * Mode A: Pick a drive and see all eligible students using the exact eligibility JOIN
 * from placement_final.sql (student qualifies if ANY criteria set of the drive is satisfied).
 * Also checks whether the student has already applied to this drive.
 */
router.get('/drive/:id', async (req, res) => {
  const driveId = Number(req.params.id);
  if (isNaN(driveId)) return res.status(400).json({ error: 'Invalid drive ID' });

  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT dr.drive_id, c.company_name,
              s.student_id, s.first_name, s.last_name, s.cgpa, s.backlogs,
              d.dept_name,
              a.application_id, a.status AS application_status
       FROM DRIVE dr
       JOIN COMPANY c ON c.company_id = dr.company_id
       JOIN ELIGIBILITY_CRITERIA ec ON ec.drive_id = dr.drive_id
       JOIN ELIGIBILITY_BRANCH eb ON eb.criteria_id = ec.criteria_id AND eb.drive_id = ec.drive_id
       JOIN STUDENT s ON s.dept_id = eb.dept_id
       JOIN DEPARTMENT d ON d.dept_id = s.dept_id
       LEFT JOIN APPLICATION a ON a.student_id = s.student_id AND a.drive_id = dr.drive_id
       WHERE dr.drive_id = ?
         AND s.cgpa >= ec.min_cgpa
         AND s.backlogs <= ec.max_backlogs
       ORDER BY s.student_id ASC`,
      [driveId]
    );

    const formatted = (rows as any[]).map((r) => ({
      ...r,
      drive_id: Number(r.drive_id),
      student_id: Number(r.student_id),
      cgpa: Number(r.cgpa),
      backlogs: Number(r.backlogs),
      application_id: r.application_id ? Number(r.application_id) : null,
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to compute eligible students' });
  }
});

/**
 * GET /api/eligibility/student/:id
 * Mode B: Pick a student and see all drives open to them using the exact eligibility JOIN
 * from placement_final.sql.
 */
router.get('/student/:id', async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) return res.status(400).json({ error: 'Invalid student ID' });

  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT dr.drive_id, c.company_name, dr.drive_date,
              dr.min_package_lpa, dr.max_package_lpa, dr.drive_link,
              a.application_id, a.status AS application_status
       FROM STUDENT s
       JOIN ELIGIBILITY_BRANCH eb ON eb.dept_id = s.dept_id
       JOIN ELIGIBILITY_CRITERIA ec ON ec.criteria_id = eb.criteria_id AND ec.drive_id = eb.drive_id
       JOIN DRIVE dr ON dr.drive_id = ec.drive_id
       JOIN COMPANY c ON c.company_id = dr.company_id
       LEFT JOIN APPLICATION a ON a.student_id = s.student_id AND a.drive_id = dr.drive_id
       WHERE s.student_id = ?
         AND s.cgpa >= ec.min_cgpa
         AND s.backlogs <= ec.max_backlogs
       ORDER BY dr.drive_date DESC, dr.drive_id DESC`,
      [studentId]
    );

    const formatted = (rows as any[]).map((r) => ({
      ...r,
      drive_id: Number(r.drive_id),
      min_package_lpa: r.min_package_lpa !== null ? Number(r.min_package_lpa) : null,
      max_package_lpa: r.max_package_lpa !== null ? Number(r.max_package_lpa) : null,
      application_id: r.application_id ? Number(r.application_id) : null,
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to compute eligible drives' });
  }
});

export default router;
