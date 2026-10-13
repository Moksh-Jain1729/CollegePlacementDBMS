import { Router } from 'express';
import pool from '../db.ts';

const router = Router();

/**
 * GET /api/applications
 * Lists all applications with student, department, company, drive details,
 * interview round counts, and placement record (if placed).
 */
router.get('/', async (_req, res) => {
  try {
    const [apps] = await pool.query(`
      SELECT a.application_id, a.applied_date, a.status,
             s.student_id, s.first_name, s.last_name, s.cgpa, s.backlogs,
             d.dept_name,
             dr.drive_id, dr.drive_date, dr.min_package_lpa, dr.max_package_lpa,
             c.company_id, c.company_name,
             pr.record_id, pr.final_package, pr.offer_date
      FROM APPLICATION a
      JOIN STUDENT s ON a.student_id = s.student_id
      JOIN DEPARTMENT d ON s.dept_id = d.dept_id
      JOIN DRIVE dr ON a.drive_id = dr.drive_id
      JOIN COMPANY c ON dr.company_id = c.company_id
      LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a.application_id
      ORDER BY a.applied_date DESC, a.application_id DESC
    `);

    const [rounds] = await pool.query(`
      SELECT round_no, application_id, round_name, result
      FROM INTERVIEW_ROUND
      ORDER BY application_id ASC, round_no ASC
    `);

    const roundsByApp = new Map<number, any[]>();
    for (const r of rounds as any[]) {
      const aid = Number(r.application_id);
      if (!roundsByApp.has(aid)) roundsByApp.set(aid, []);
      roundsByApp.get(aid)!.push({
        round_no: Number(r.round_no),
        application_id: aid,
        round_name: r.round_name,
        result: r.result,
      });
    }

    const formatted = (apps as any[]).map((a) => ({
      ...a,
      application_id: Number(a.application_id),
      student_id: Number(a.student_id),
      drive_id: Number(a.drive_id),
      cgpa: Number(a.cgpa),
      backlogs: Number(a.backlogs),
      min_package_lpa: a.min_package_lpa !== null ? Number(a.min_package_lpa) : null,
      max_package_lpa: a.max_package_lpa !== null ? Number(a.max_package_lpa) : null,
      record_id: a.record_id ? Number(a.record_id) : null,
      final_package: a.final_package !== null && a.final_package !== undefined ? Number(a.final_package) : null,
      rounds: roundsByApp.get(Number(a.application_id)) || [],
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to fetch applications' });
  }
});

/**
 * POST /api/applications
 * Creates an application.
 * - Catches BEFORE INSERT trigger \`trg_check_eligibility\` (SQLSTATE '45000') and returns 400 with its message.
 * - Catches UNIQUE(student_id, drive_id) violation and returns 409 { error: "Already applied" }.
 */
router.post('/', async (req, res) => {
  const { student_id, drive_id, applied_date, status } = req.body;
  if (!student_id || !drive_id) {
    return res.status(400).json({ error: 'Student and drive are required' });
  }

  const today = new Date().toISOString().split('T')[0];
  const appDate = applied_date || today;
  const appStatus = status || 'Applied';

  try {
    const [result] = await pool.execute(
      `INSERT INTO APPLICATION (applied_date, status, student_id, drive_id)
       VALUES (?, ?, ?, ?)`,
      [appDate, appStatus, Number(student_id), Number(drive_id)]
    );
    res.status(201).json({
      application_id: (result as any).insertId,
      message: 'Application submitted successfully',
    });
  } catch (err: any) {
    const msg = String(err.sqlMessage || err.message || '');
    if (err.sqlState === '45000' || msg.includes('Student is not eligible for this drive')) {
      return res.status(400).json({ error: 'Student is not eligible for this drive' });
    }
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062 || msg.includes('Duplicate') || msg.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Already applied' });
    }
    res.status(400).json({ error: msg || 'Failed to submit application' });
  }
});

/**
 * PUT /api/applications/:id
 * Updates application status (Applied / Shortlisted / Selected / Rejected).
 */
router.put('/:id', async (req, res) => {
  const appId = Number(req.params.id);
  const { status } = req.body;
  const allowed = ['Applied', 'Shortlisted', 'Selected', 'Rejected'];
  if (isNaN(appId) || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Valid status (Applied, Shortlisted, Selected, Rejected) is required' });
  }

  try {
    const [upd] = await pool.execute('UPDATE APPLICATION SET status = ? WHERE application_id = ?', [status, appId]);
    if ((upd as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json({ message: 'Status updated' });
  } catch (err: any) {
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to update application status' });
  }
});

/**
 * DELETE /api/applications/:id
 * Deletes an application (INTERVIEW_ROUND cascades; fails if PLACEMENT_RECORD exists).
 */
router.delete('/:id', async (req, res) => {
  const appId = Number(req.params.id);
  if (isNaN(appId)) return res.status(400).json({ error: 'Invalid application ID' });

  try {
    const [del] = await pool.execute('DELETE FROM APPLICATION WHERE application_id = ?', [appId]);
    if ((del as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json({ message: 'Application deleted' });
  } catch (err: any) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({
        error: 'Cannot delete an application that has a confirmed placement record.',
      });
    }
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to delete application' });
  }
});

/**
 * GET /api/applications/:id/rounds
 * Lists interview rounds for an application.
 */
router.get('/:id/rounds', async (req, res) => {
  const appId = Number(req.params.id);
  if (isNaN(appId)) return res.status(400).json({ error: 'Invalid application ID' });

  try {
    const [rows] = await pool.query(
      'SELECT round_no, application_id, round_name, result FROM INTERVIEW_ROUND WHERE application_id = ? ORDER BY round_no ASC',
      [appId]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to fetch interview rounds' });
  }
});

/**
 * POST /api/applications/:id/rounds
 * Adds an interview round with round_no auto-incremented per application (MAX(round_no) + 1).
 */
router.post('/:id/rounds', async (req, res) => {
  const appId = Number(req.params.id);
  const { round_name, result } = req.body;
  if (isNaN(appId) || !round_name?.trim()) {
    return res.status(400).json({ error: 'Round name is required' });
  }
  const roundResult = result || 'Pending';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [maxRows] = await conn.query(
      'SELECT COALESCE(MAX(round_no), 0) + 1 AS next_round FROM INTERVIEW_ROUND WHERE application_id = ?',
      [appId]
    );
    const nextRoundNo = Number((maxRows as any[])[0]?.next_round || 1);

    await conn.execute(
      'INSERT INTO INTERVIEW_ROUND (round_no, application_id, round_name, result) VALUES (?, ?, ?, ?)',
      [nextRoundNo, appId, round_name.trim(), roundResult]
    );
    await conn.commit();
    res.status(201).json({ round_no: nextRoundNo, application_id: appId, message: 'Interview round added' });
  } catch (err: any) {
    await conn.rollback();
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to add interview round' });
  } finally {
    conn.release();
  }
});

/**
 * PUT /api/applications/:id/rounds/:roundNo
 * Updates an interview round's name or result (Passed / Failed / Pending).
 */
router.put('/:id/rounds/:roundNo', async (req, res) => {
  const appId = Number(req.params.id);
  const roundNo = Number(req.params.roundNo);
  const { round_name, result } = req.body;
  if (isNaN(appId) || isNaN(roundNo) || !round_name?.trim()) {
    return res.status(400).json({ error: 'Round name and valid result are required' });
  }

  try {
    const [upd] = await pool.execute(
      'UPDATE INTERVIEW_ROUND SET round_name = ?, result = ? WHERE application_id = ? AND round_no = ?',
      [round_name.trim(), result || 'Pending', appId, roundNo]
    );
    if ((upd as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Interview round not found' });
    }
    res.json({ message: 'Interview round updated' });
  } catch (err: any) {
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to update interview round' });
  }
});

/**
 * DELETE /api/applications/:id/rounds/:roundNo
 * Deletes an interview round.
 */
router.delete('/:id/rounds/:roundNo', async (req, res) => {
  const appId = Number(req.params.id);
  const roundNo = Number(req.params.roundNo);
  try {
    const [del] = await pool.execute(
      'DELETE FROM INTERVIEW_ROUND WHERE application_id = ? AND round_no = ?',
      [appId, roundNo]
    );
    if ((del as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Interview round not found' });
    }
    res.json({ message: 'Interview round deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to delete interview round' });
  }
});

/**
 * POST /api/applications/:id/place
 * Marks an application as placed: creates PLACEMENT_RECORD (final_package, offer_date)
 * and sets APPLICATION.status = 'Selected' in one transaction.
 */
router.post('/:id/place', async (req, res) => {
  const appId = Number(req.params.id);
  const { final_package, offer_date } = req.body;
  const pkg = Number(final_package);
  if (isNaN(appId) || isNaN(pkg) || pkg <= 0 || !offer_date) {
    return res.status(400).json({ error: 'Valid final package (LPA) and offer date are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [upd] = await conn.execute(
      "UPDATE APPLICATION SET status = 'Selected' WHERE application_id = ?",
      [appId]
    );
    if ((upd as any).affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Application not found' });
    }

    const [ins] = await conn.execute(
      'INSERT INTO PLACEMENT_RECORD (final_package, offer_date, application_id) VALUES (?, ?, ?)',
      [pkg, offer_date, appId]
    );

    await conn.commit();
    res.status(201).json({
      record_id: (ins as any).insertId,
      message: 'Student marked as placed and status set to Selected',
    });
  } catch (err: any) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return res.status(409).json({ error: 'Placement record already exists for this application' });
    }
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to record placement' });
  } finally {
    conn.release();
  }
});

export default router;
