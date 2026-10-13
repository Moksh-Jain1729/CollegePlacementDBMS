import { Router } from 'express';
import pool from '../db.ts';

export const departmentsRouter = Router();
export const companiesRouter = Router();
export const tposRouter = Router();

// ==================== DEPARTMENTS ====================

departmentsRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT dept_id, dept_name, hod_name FROM DEPARTMENT ORDER BY dept_id ASC');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to fetch departments' });
  }
});

departmentsRouter.post('/', async (req, res) => {
  const { dept_name, hod_name } = req.body;
  if (!dept_name?.trim()) {
    return res.status(400).json({ error: 'Department name is required' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO DEPARTMENT (dept_name, hod_name) VALUES (?, ?)',
      [dept_name.trim(), hod_name?.trim() || null]
    );
    res.status(201).json({ dept_id: (result as any).insertId, message: 'Department created' });
  } catch (err: any) {
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to create department' });
  }
});

departmentsRouter.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { dept_name, hod_name } = req.body;
  if (isNaN(id) || !dept_name?.trim()) {
    return res.status(400).json({ error: 'Valid department ID and name are required' });
  }
  try {
    const [upd] = await pool.execute(
      'UPDATE DEPARTMENT SET dept_name = ?, hod_name = ? WHERE dept_id = ?',
      [dept_name.trim(), hod_name?.trim() || null, id]
    );
    if ((upd as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json({ message: 'Department updated' });
  } catch (err: any) {
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to update department' });
  }
});

departmentsRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid department ID' });

  try {
    const [del] = await pool.execute('DELETE FROM DEPARTMENT WHERE dept_id = ?', [id]);
    if ((del as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json({ message: 'Department deleted' });
  } catch (err: any) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({
        error: 'Cannot delete this department because students or drive eligibility branches reference it.',
      });
    }
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to delete department' });
  }
});

// ==================== COMPANIES ====================

companiesRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT company_id, company_name, industry_type FROM COMPANY ORDER BY company_id ASC'
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to fetch companies' });
  }
});

companiesRouter.post('/', async (req, res) => {
  const { company_name, industry_type } = req.body;
  if (!company_name?.trim()) {
    return res.status(400).json({ error: 'Company name is required' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO COMPANY (company_name, industry_type) VALUES (?, ?)',
      [company_name.trim(), industry_type?.trim() || null]
    );
    res.status(201).json({ company_id: (result as any).insertId, message: 'Company created' });
  } catch (err: any) {
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to create company' });
  }
});

companiesRouter.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { company_name, industry_type } = req.body;
  if (isNaN(id) || !company_name?.trim()) {
    return res.status(400).json({ error: 'Valid company ID and name are required' });
  }
  try {
    const [upd] = await pool.execute(
      'UPDATE COMPANY SET company_name = ?, industry_type = ? WHERE company_id = ?',
      [company_name.trim(), industry_type?.trim() || null, id]
    );
    if ((upd as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json({ message: 'Company updated' });
  } catch (err: any) {
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to update company' });
  }
});

companiesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid company ID' });

  try {
    const [del] = await pool.execute('DELETE FROM COMPANY WHERE company_id = ?', [id]);
    if ((del as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json({ message: 'Company deleted' });
  } catch (err: any) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({
        error: 'Cannot delete this company because placement drives are associated with it.',
      });
    }
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to delete company' });
  }
});

// ==================== TPOS ====================

tposRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT tpo_id, name, email FROM TPO ORDER BY tpo_id ASC');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to fetch TPOs' });
  }
});

tposRouter.post('/', async (req, res) => {
  const { name, email } = req.body;
  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'TPO name and email are required' });
  }
  try {
    const [result] = await pool.execute('INSERT INTO TPO (name, email) VALUES (?, ?)', [
      name.trim(),
      email.trim(),
    ]);
    res.status(201).json({ tpo_id: (result as any).insertId, message: 'TPO created' });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return res.status(409).json({ error: 'A TPO with this email already exists' });
    }
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to create TPO' });
  }
});

tposRouter.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, email } = req.body;
  if (isNaN(id) || !name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Valid TPO ID, name, and email are required' });
  }
  try {
    const [upd] = await pool.execute('UPDATE TPO SET name = ?, email = ? WHERE tpo_id = ?', [
      name.trim(),
      email.trim(),
      id,
    ]);
    if ((upd as any).affectedRows === 0) {
      return res.status(404).json({ error: 'TPO not found' });
    }
    res.json({ message: 'TPO updated' });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return res.status(409).json({ error: 'A TPO with this email already exists' });
    }
    res.status(400).json({ error: err.sqlMessage || err.message || 'Failed to update TPO' });
  }
});

tposRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid TPO ID' });

  try {
    const [del] = await pool.execute('DELETE FROM TPO WHERE tpo_id = ?', [id]);
    if ((del as any).affectedRows === 0) {
      return res.status(404).json({ error: 'TPO not found' });
    }
    res.json({ message: 'TPO deleted' });
  } catch (err: any) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({
        error: 'Cannot delete this TPO because they manage one or more placement drives.',
      });
    }
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to delete TPO' });
  }
});
