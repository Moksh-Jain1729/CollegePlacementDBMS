import { Router } from 'express';
import pool from '../db.ts';

const router = Router();

/**
 * Helper to fetch all criteria and allowed branches for drives
 */
async function attachCriteriaToDrives(drives: any[]) {
  if (!drives.length) return [];

  const [criteriaRows] = await pool.query(`
    SELECT criteria_id, drive_id, min_cgpa, max_backlogs
    FROM ELIGIBILITY_CRITERIA
    ORDER BY drive_id ASC, criteria_id ASC
  `);

  const [branchRows] = await pool.query(`
    SELECT eb.criteria_id, eb.drive_id, eb.dept_id, d.dept_name
    FROM ELIGIBILITY_BRANCH eb
    JOIN DEPARTMENT d ON eb.dept_id = d.dept_id
    ORDER BY eb.dept_id ASC
  `);

  const branchMap = new Map<string, { dept_id: number; dept_name: string }[]>();
  for (const b of branchRows as any[]) {
    const key = `${b.drive_id}_${b.criteria_id}`;
    if (!branchMap.has(key)) branchMap.set(key, []);
    branchMap.get(key)!.push({ dept_id: Number(b.dept_id), dept_name: b.dept_name });
  }

  const criteriaByDrive = new Map<number, any[]>();
  for (const c of criteriaRows as any[]) {
    const did = Number(c.drive_id);
    if (!criteriaByDrive.has(did)) criteriaByDrive.set(did, []);
    const key = `${c.drive_id}_${c.criteria_id}`;
    const branches = branchMap.get(key) || [];
    criteriaByDrive.get(did)!.push({
      criteria_id: Number(c.criteria_id),
      drive_id: did,
      min_cgpa: Number(c.min_cgpa),
      max_backlogs: Number(c.max_backlogs),
      branches,
      dept_ids: branches.map((br) => br.dept_id),
    });
  }

  return drives.map((dr) => ({
    ...dr,
    drive_id: Number(dr.drive_id),
    company_id: Number(dr.company_id),
    tpo_id: Number(dr.tpo_id),
    min_package_lpa: dr.min_package_lpa !== null ? Number(dr.min_package_lpa) : null,
    max_package_lpa: dr.max_package_lpa !== null ? Number(dr.max_package_lpa) : null,
    criteria: criteriaByDrive.get(Number(dr.drive_id)) || [],
  }));
}

/**
 * GET /api/drives
 * Lists all drives with company, TPO, and nested eligibility criteria sets + branches.
 */
router.get('/', async (_req, res) => {
  try {
    const [drives] = await pool.query(`
      SELECT dr.drive_id, dr.drive_link, dr.min_package_lpa, dr.max_package_lpa,
             dr.drive_date, dr.company_id, c.company_name, c.industry_type,
             dr.tpo_id, t.name AS tpo_name, t.email AS tpo_email
      FROM DRIVE dr
      JOIN COMPANY c ON dr.company_id = c.company_id
      JOIN TPO t ON dr.tpo_id = t.tpo_id
      ORDER BY dr.drive_date DESC, dr.drive_id DESC
    `);
    const enriched = await attachCriteriaToDrives(drives as any[]);
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to fetch drives' });
  }
});

/**
 * GET /api/drives/:id
 * Fetch single drive with criteria sets and branches.
 */
router.get('/:id', async (req, res) => {
  const driveId = Number(req.params.id);
  if (isNaN(driveId)) return res.status(400).json({ error: 'Invalid drive ID' });

  try {
    const [drives] = await pool.query(
      `SELECT dr.drive_id, dr.drive_link, dr.min_package_lpa, dr.max_package_lpa,
              dr.drive_date, dr.company_id, c.company_name, c.industry_type,
              dr.tpo_id, t.name AS tpo_name, t.email AS tpo_email
       FROM DRIVE dr
       JOIN COMPANY c ON dr.company_id = c.company_id
       JOIN TPO t ON dr.tpo_id = t.tpo_id
       WHERE dr.drive_id = ?`,
      [driveId]
    );
    if (!(drives as any[]).length) {
      return res.status(404).json({ error: 'Drive not found' });
    }
    const enriched = await attachCriteriaToDrives(drives as any[]);
    res.json(enriched[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to fetch drive' });
  }
});

/**
 * POST /api/drives
 * Creates a drive and optional initial criteria sets in a transaction.
 */
router.post('/', async (req, res) => {
  const { drive_link, min_package_lpa, max_package_lpa, drive_date, company_id, tpo_id, criteria } = req.body;
  if (!drive_date || !company_id || !tpo_id) {
    return res.status(400).json({ error: 'Company, TPO, and drive date are required' });
  }

  const minPkg = Number(min_package_lpa);
  const maxPkg = Number(max_package_lpa);
  if (isNaN(minPkg) || isNaN(maxPkg) || minPkg < 0 || maxPkg < minPkg) {
    return res.status(400).json({ error: 'Maximum package must be greater than or equal to minimum package' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [insertRes] = await conn.execute(
      `INSERT INTO DRIVE (drive_link, min_package_lpa, max_package_lpa, drive_date, company_id, tpo_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [drive_link?.trim() || null, minPkg, maxPkg, drive_date, Number(company_id), Number(tpo_id)]
    );
    const driveId = (insertRes as any).insertId;

    if (Array.isArray(criteria) && criteria.length > 0) {
      let nextCriteriaId = 1;
      for (const crit of criteria) {
        const minCgpa = Number(crit.min_cgpa ?? 0);
        const maxBacklogs = Number(crit.max_backlogs ?? 0);
        if (minCgpa < 0 || minCgpa > 10 || maxBacklogs < 0) {
          throw new Error('Invalid criteria CGPA or backlogs');
        }
        await conn.execute(
          `INSERT INTO ELIGIBILITY_CRITERIA (criteria_id, drive_id, min_cgpa, max_backlogs)
           VALUES (?, ?, ?, ?)`,
          [nextCriteriaId, driveId, minCgpa, maxBacklogs]
        );

        const deptIds: number[] = Array.from(new Set((crit.dept_ids || []).map(Number).filter(Boolean)));
        for (const deptId of deptIds) {
          await conn.execute(
            `INSERT INTO ELIGIBILITY_BRANCH (criteria_id, drive_id, dept_id) VALUES (?, ?, ?)`,
            [nextCriteriaId, driveId, deptId]
          );
        }
        nextCriteriaId++;
      }
    }

    await conn.commit();
    res.status(201).json({ drive_id: driveId, message: 'Drive created' });
  } catch (err: any) {
    await conn.rollback();
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to create drive' });
  } finally {
    conn.release();
  }
});

/**
 * PUT /api/drives/:id
 * Updates a drive and optionally synchronizes its criteria sets in a transaction.
 */
router.put('/:id', async (req, res) => {
  const driveId = Number(req.params.id);
  if (isNaN(driveId)) return res.status(400).json({ error: 'Invalid drive ID' });

  const { drive_link, min_package_lpa, max_package_lpa, drive_date, company_id, tpo_id, criteria } = req.body;
  if (!drive_date || !company_id || !tpo_id) {
    return res.status(400).json({ error: 'Company, TPO, and drive date are required' });
  }

  const minPkg = Number(min_package_lpa);
  const maxPkg = Number(max_package_lpa);
  if (isNaN(minPkg) || isNaN(maxPkg) || minPkg < 0 || maxPkg < minPkg) {
    return res.status(400).json({ error: 'Maximum package must be greater than or equal to minimum package' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [updateRes] = await conn.execute(
      `UPDATE DRIVE
       SET drive_link = ?, min_package_lpa = ?, max_package_lpa = ?, drive_date = ?, company_id = ?, tpo_id = ?
       WHERE drive_id = ?`,
      [drive_link?.trim() || null, minPkg, maxPkg, drive_date, Number(company_id), Number(tpo_id), driveId]
    );

    if ((updateRes as any).affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Drive not found' });
    }

    if (Array.isArray(criteria)) {
      await conn.execute('DELETE FROM ELIGIBILITY_CRITERIA WHERE drive_id = ?', [driveId]);
      let nextCriteriaId = 1;
      for (const crit of criteria) {
        const minCgpa = Number(crit.min_cgpa ?? 0);
        const maxBacklogs = Number(crit.max_backlogs ?? 0);
        await conn.execute(
          `INSERT INTO ELIGIBILITY_CRITERIA (criteria_id, drive_id, min_cgpa, max_backlogs)
           VALUES (?, ?, ?, ?)`,
          [nextCriteriaId, driveId, minCgpa, maxBacklogs]
        );

        const deptIds: number[] = Array.from(new Set((crit.dept_ids || []).map(Number).filter(Boolean)));
        for (const deptId of deptIds) {
          await conn.execute(
            `INSERT INTO ELIGIBILITY_BRANCH (criteria_id, drive_id, dept_id) VALUES (?, ?, ?)`,
            [nextCriteriaId, driveId, deptId]
          );
        }
        nextCriteriaId++;
      }
    }

    await conn.commit();
    res.json({ drive_id: driveId, message: 'Drive updated' });
  } catch (err: any) {
    await conn.rollback();
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to update drive' });
  } finally {
    conn.release();
  }
});

/**
 * DELETE /api/drives/:id
 * Deletes a drive (ELIGIBILITY_CRITERIA and ELIGIBILITY_BRANCH cascade automatically).
 */
router.delete('/:id', async (req, res) => {
  const driveId = Number(req.params.id);
  if (isNaN(driveId)) return res.status(400).json({ error: 'Invalid drive ID' });

  try {
    const [delRes] = await pool.execute('DELETE FROM DRIVE WHERE drive_id = ?', [driveId]);
    if ((delRes as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Drive not found' });
    }
    res.json({ message: 'Drive deleted' });
  } catch (err: any) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({
        error: 'Cannot delete this drive because student applications exist for it.',
      });
    }
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to delete drive' });
  }
});

/**
 * POST /api/drives/:id/criteria
 * Adds a new criteria set to a drive. criteria_id auto-increments per drive (MAX(criteria_id) + 1).
 */
router.post('/:id/criteria', async (req, res) => {
  const driveId = Number(req.params.id);
  const { min_cgpa, max_backlogs, dept_ids } = req.body;
  if (isNaN(driveId)) return res.status(400).json({ error: 'Invalid drive ID' });

  const minCgpa = Number(min_cgpa);
  const maxBacklogs = Number(max_backlogs ?? 0);
  if (isNaN(minCgpa) || minCgpa < 0 || minCgpa > 10) {
    return res.status(400).json({ error: 'Minimum CGPA must be between 0 and 10' });
  }
  if (isNaN(maxBacklogs) || maxBacklogs < 0) {
    return res.status(400).json({ error: 'Maximum backlogs must be 0 or greater' });
  }
  if (!Array.isArray(dept_ids) || dept_ids.length === 0) {
    return res.status(400).json({ error: 'Select at least one allowed department branch' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [maxRows] = await conn.query(
      'SELECT COALESCE(MAX(criteria_id), 0) + 1 AS next_id FROM ELIGIBILITY_CRITERIA WHERE drive_id = ?',
      [driveId]
    );
    const nextCriteriaId = Number((maxRows as any[])[0]?.next_id || 1);

    await conn.execute(
      `INSERT INTO ELIGIBILITY_CRITERIA (criteria_id, drive_id, min_cgpa, max_backlogs)
       VALUES (?, ?, ?, ?)`,
      [nextCriteriaId, driveId, minCgpa, maxBacklogs]
    );

    const uniqueDepts: number[] = Array.from(new Set(dept_ids.map(Number).filter(Boolean)));
    for (const deptId of uniqueDepts) {
      await conn.execute(
        `INSERT INTO ELIGIBILITY_BRANCH (criteria_id, drive_id, dept_id) VALUES (?, ?, ?)`,
        [nextCriteriaId, driveId, deptId]
      );
    }

    await conn.commit();
    res.status(201).json({ criteria_id: nextCriteriaId, drive_id: driveId, message: 'Criteria set added' });
  } catch (err: any) {
    await conn.rollback();
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to add criteria set' });
  } finally {
    conn.release();
  }
});

/**
 * PUT /api/drives/:id/criteria/:criteriaId
 * Updates an existing criteria set and its allowed branches in a transaction.
 */
router.put('/:id/criteria/:criteriaId', async (req, res) => {
  const driveId = Number(req.params.id);
  const criteriaId = Number(req.params.criteriaId);
  const { min_cgpa, max_backlogs, dept_ids } = req.body;

  const minCgpa = Number(min_cgpa);
  const maxBacklogs = Number(max_backlogs ?? 0);
  if (isNaN(minCgpa) || minCgpa < 0 || minCgpa > 10) {
    return res.status(400).json({ error: 'Minimum CGPA must be between 0 and 10' });
  }
  if (isNaN(maxBacklogs) || maxBacklogs < 0) {
    return res.status(400).json({ error: 'Maximum backlogs must be 0 or greater' });
  }
  if (!Array.isArray(dept_ids) || dept_ids.length === 0) {
    return res.status(400).json({ error: 'Select at least one allowed department branch' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [updRes] = await conn.execute(
      `UPDATE ELIGIBILITY_CRITERIA SET min_cgpa = ?, max_backlogs = ?
       WHERE drive_id = ? AND criteria_id = ?`,
      [minCgpa, maxBacklogs, driveId, criteriaId]
    );
    if ((updRes as any).affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Criteria set not found' });
    }

    await conn.execute('DELETE FROM ELIGIBILITY_BRANCH WHERE drive_id = ? AND criteria_id = ?', [
      driveId,
      criteriaId,
    ]);

    const uniqueDepts: number[] = Array.from(new Set(dept_ids.map(Number).filter(Boolean)));
    for (const deptId of uniqueDepts) {
      await conn.execute(
        `INSERT INTO ELIGIBILITY_BRANCH (criteria_id, drive_id, dept_id) VALUES (?, ?, ?)`,
        [criteriaId, driveId, deptId]
      );
    }

    await conn.commit();
    res.json({ message: 'Criteria set updated' });
  } catch (err: any) {
    await conn.rollback();
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to update criteria set' });
  } finally {
    conn.release();
  }
});

/**
 * DELETE /api/drives/:id/criteria/:criteriaId
 * Deletes a specific criteria set from a drive (ELIGIBILITY_BRANCH cascades).
 */
router.delete('/:id/criteria/:criteriaId', async (req, res) => {
  const driveId = Number(req.params.id);
  const criteriaId = Number(req.params.criteriaId);
  try {
    const [delRes] = await pool.execute(
      'DELETE FROM ELIGIBILITY_CRITERIA WHERE drive_id = ? AND criteria_id = ?',
      [driveId, criteriaId]
    );
    if ((delRes as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Criteria set not found' });
    }
    res.json({ message: 'Criteria set deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to delete criteria set' });
  }
});

export default router;
