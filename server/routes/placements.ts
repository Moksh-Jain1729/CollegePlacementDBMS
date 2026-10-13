import { Router } from 'express';
import pool from '../db.ts';

const router = Router();

/**
 * GET /api/placements
 * Returns placement records (student, department, company, package, offer date)
 * plus summary statistics (total placed, avg package, highest package, lowest package).
 */
router.get('/', async (_req, res) => {
  try {
    const [records] = await pool.query(`
      SELECT pr.record_id, pr.final_package, pr.offer_date, pr.application_id,
             s.student_id, s.first_name, s.last_name, s.cgpa,
             d.dept_name,
             dr.drive_id, dr.drive_date,
             c.company_id, c.company_name, c.industry_type
      FROM PLACEMENT_RECORD pr
      JOIN APPLICATION a ON pr.application_id = a.application_id
      JOIN STUDENT s ON a.student_id = s.student_id
      JOIN DEPARTMENT d ON s.dept_id = d.dept_id
      JOIN DRIVE dr ON a.drive_id = dr.drive_id
      JOIN COMPANY c ON dr.company_id = c.company_id
      ORDER BY pr.offer_date DESC, pr.record_id DESC
    `);

    const [[summaryRow]] = await pool.query(`
      SELECT COUNT(*) AS total_offers,
             COUNT(DISTINCT a.student_id) AS placed_students,
             ROUND(AVG(pr.final_package), 2) AS avg_package,
             MAX(pr.final_package) AS highest_package,
             MIN(pr.final_package) AS lowest_package
      FROM PLACEMENT_RECORD pr
      JOIN APPLICATION a ON pr.application_id = a.application_id
    `);

    res.json({
      summary: {
        total_offers: Number(summaryRow?.total_offers || 0),
        placed_students: Number(summaryRow?.placed_students || 0),
        avg_package: summaryRow?.avg_package !== null && summaryRow?.avg_package !== undefined
          ? Number(summaryRow.avg_package)
          : 0,
        highest_package: summaryRow?.highest_package !== null && summaryRow?.highest_package !== undefined
          ? Number(summaryRow.highest_package)
          : 0,
        lowest_package: summaryRow?.lowest_package !== null && summaryRow?.lowest_package !== undefined
          ? Number(summaryRow.lowest_package)
          : 0,
      },
      records: (records as any[]).map((r) => ({
        ...r,
        record_id: Number(r.record_id),
        application_id: Number(r.application_id),
        student_id: Number(r.student_id),
        drive_id: Number(r.drive_id),
        company_id: Number(r.company_id),
        cgpa: Number(r.cgpa),
        final_package: Number(r.final_package),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to fetch placements' });
  }
});

export default router;
