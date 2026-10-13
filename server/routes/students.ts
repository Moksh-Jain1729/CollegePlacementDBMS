import { Router } from 'express';
import pool from '../db.ts';

const router = Router();

/**
 * GET /api/students
 * Lists all students with department name, computed age from v_student_age view,
 * and multivalued phone numbers from STUDENT_PHONE.
 */
router.get('/', async (_req, res) => {
  try {
    const [students] = await pool.query(`
      SELECT s.student_id, s.first_name, s.last_name, s.cgpa, s.backlogs,
             s.date_of_birth, s.dept_id, d.dept_name, va.age
      FROM STUDENT s
      JOIN DEPARTMENT d ON s.dept_id = d.dept_id
      LEFT JOIN v_student_age va ON va.student_id = s.student_id
      ORDER BY s.student_id ASC
    `);

    const [phones] = await pool.query('SELECT student_id, phone_no FROM STUDENT_PHONE ORDER BY phone_no ASC');
    const phoneMap = new Map<number, string[]>();
    for (const row of phones as any[]) {
      const sid = Number(row.student_id);
      if (!phoneMap.has(sid)) phoneMap.set(sid, []);
      phoneMap.get(sid)!.push(row.phone_no);
    }

    const result = (students as any[]).map((st) => ({
      ...st,
      cgpa: Number(st.cgpa),
      backlogs: Number(st.backlogs),
      age: st.age !== null && st.age !== undefined ? Number(st.age) : null,
      phones: phoneMap.get(Number(st.student_id)) || [],
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to fetch students' });
  }
});

/**
 * GET /api/students/:id
 * Fetch a single student with age from v_student_age and phone numbers.
 */
router.get('/:id', async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) return res.status(400).json({ error: 'Invalid student ID' });

  try {
    const [rows] = await pool.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.cgpa, s.backlogs,
              s.date_of_birth, s.dept_id, d.dept_name, va.age
       FROM STUDENT s
       JOIN DEPARTMENT d ON s.dept_id = d.dept_id
       LEFT JOIN v_student_age va ON va.student_id = s.student_id
       WHERE s.student_id = ?`,
      [studentId]
    );

    if (!(rows as any[]).length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const [phones] = await pool.query(
      'SELECT phone_no FROM STUDENT_PHONE WHERE student_id = ? ORDER BY phone_no ASC',
      [studentId]
    );

    const st = (rows as any[])[0];
    res.json({
      ...st,
      cgpa: Number(st.cgpa),
      backlogs: Number(st.backlogs),
      age: st.age !== null && st.age !== undefined ? Number(st.age) : null,
      phones: (phones as any[]).map((p) => p.phone_no),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to fetch student' });
  }
});

/**
 * POST /api/students
 * Creates a student and inserts multivalued phone numbers inside a transaction.
 */
router.post('/', async (req, res) => {
  const { first_name, last_name, cgpa, backlogs, date_of_birth, dept_id, phones } = req.body;
  if (!first_name?.trim() || !last_name?.trim() || !dept_id) {
    return res.status(400).json({ error: 'First name, last name, and department are required' });
  }

  const numCgpa = Number(cgpa);
  const numBacklogs = Number(backlogs ?? 0);
  if (isNaN(numCgpa) || numCgpa < 0 || numCgpa > 10) {
    return res.status(400).json({ error: 'CGPA must be between 0 and 10' });
  }
  if (isNaN(numBacklogs) || numBacklogs < 0) {
    return res.status(400).json({ error: 'Backlogs must be 0 or greater' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [insertRes] = await conn.execute(
      `INSERT INTO STUDENT (first_name, last_name, cgpa, backlogs, date_of_birth, dept_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [first_name.trim(), last_name.trim(), numCgpa, numBacklogs, date_of_birth || null, Number(dept_id)]
    );
    const studentId = (insertRes as any).insertId;

    const uniquePhones: string[] = Array.from(
      new Set((Array.isArray(phones) ? phones : []).map((p: any) => String(p).trim()).filter(Boolean))
    );
    for (const phone of uniquePhones) {
      await conn.execute('INSERT INTO STUDENT_PHONE (student_id, phone_no) VALUES (?, ?)', [studentId, phone]);
    }

    await conn.commit();
    res.status(201).json({ student_id: studentId, message: 'Student created' });
  } catch (err: any) {
    await conn.rollback();
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to create student' });
  } finally {
    conn.release();
  }
});

/**
 * PUT /api/students/:id
 * Updates a student and replaces STUDENT_PHONE records inside a transaction.
 */
router.put('/:id', async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) return res.status(400).json({ error: 'Invalid student ID' });

  const { first_name, last_name, cgpa, backlogs, date_of_birth, dept_id, phones } = req.body;
  if (!first_name?.trim() || !last_name?.trim() || !dept_id) {
    return res.status(400).json({ error: 'First name, last name, and department are required' });
  }

  const numCgpa = Number(cgpa);
  const numBacklogs = Number(backlogs ?? 0);
  if (isNaN(numCgpa) || numCgpa < 0 || numCgpa > 10) {
    return res.status(400).json({ error: 'CGPA must be between 0 and 10' });
  }
  if (isNaN(numBacklogs) || numBacklogs < 0) {
    return res.status(400).json({ error: 'Backlogs must be 0 or greater' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [updateRes] = await conn.execute(
      `UPDATE STUDENT
       SET first_name = ?, last_name = ?, cgpa = ?, backlogs = ?, date_of_birth = ?, dept_id = ?
       WHERE student_id = ?`,
      [first_name.trim(), last_name.trim(), numCgpa, numBacklogs, date_of_birth || null, Number(dept_id), studentId]
    );

    if ((updateRes as any).affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Student not found' });
    }

    await conn.execute('DELETE FROM STUDENT_PHONE WHERE student_id = ?', [studentId]);
    const uniquePhones: string[] = Array.from(
      new Set((Array.isArray(phones) ? phones : []).map((p: any) => String(p).trim()).filter(Boolean))
    );
    for (const phone of uniquePhones) {
      await conn.execute('INSERT INTO STUDENT_PHONE (student_id, phone_no) VALUES (?, ?)', [studentId, phone]);
    }

    await conn.commit();
    res.json({ student_id: studentId, message: 'Student updated' });
  } catch (err: any) {
    await conn.rollback();
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to update student' });
  } finally {
    conn.release();
  }
});

/**
 * DELETE /api/students/:id
 * Deletes a student (STUDENT_PHONE cascades; APPLICATION blocks if referenced).
 */
router.delete('/:id', async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) return res.status(400).json({ error: 'Invalid student ID' });

  try {
    const [delRes] = await pool.execute('DELETE FROM STUDENT WHERE student_id = ?', [studentId]);
    if ((delRes as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted' });
  } catch (err: any) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({
        error: 'Cannot delete this student because they have existing drive applications.',
      });
    }
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to delete student' });
  }
});

export default router;
