import { Router } from 'express';
import pool from '../db.ts';

const router = Router();

/**
 * Helper to compute exact statistical metrics (Highest, Lowest, Average, Median, P25, P75, IQR, StdDev)
 * from a sorted numeric array.
 */
function computeStatisticalSummary(values: number[]) {
  if (!values || values.length === 0) {
    return {
      count: 0,
      highest: 0,
      lowest: 0,
      average: 0,
      median: 0,
      p25: 0,
      p75: 0,
      iqr: 0,
      stdDev: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const lowest = sorted[0];
  const highest = sorted[n - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const average = Number((sum / n).toFixed(2));

  const quantile = (q: number) => {
    const pos = (n - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return Number((sorted[base] + rest * (sorted[base + 1] - sorted[base])).toFixed(2));
    }
    return Number(sorted[base].toFixed(2));
  };

  const median = quantile(0.5);
  const p25 = quantile(0.25);
  const p75 = quantile(0.75);
  const iqr = Number((p75 - p25).toFixed(2));

  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - average, 2), 0) / n;
  const stdDev = Number(Math.sqrt(variance).toFixed(2));

  return {
    count: n,
    highest: Number(highest.toFixed(2)),
    lowest: Number(lowest.toFixed(2)),
    average,
    median,
    p25,
    p75,
    iqr,
    stdDev,
  };
}

/**
 * GET /api/analysis
 * Aggregates multi-dimensional placement, CGPA, backlog, company, and funnel data
 * plus Highest, Lowest, Average, Median, P25, P75, IQR, and StdDev statistics.
 */
router.get('/', async (_req, res) => {
  try {
    // 1. Raw student CGPAs & placement packages per branch for median/percentile math
    const [allStudents] = await pool.query(`
      SELECT s.student_id, s.dept_id, s.cgpa, pr.final_package
      FROM STUDENT s
      LEFT JOIN APPLICATION a ON a.student_id = s.student_id
      LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a.application_id
    `);

    const allCgpas: number[] = [];
    const allPackages: number[] = [];
    const seenStudents = new Set<number>();
    const cgpaByDept = new Map<number, number[]>();
    const pkgByDept = new Map<number, number[]>();

    for (const row of allStudents as any[]) {
      const sid = Number(row.student_id);
      const did = Number(row.dept_id);
      const cg = Number(row.cgpa);

      if (!seenStudents.has(sid)) {
        seenStudents.add(sid);
        allCgpas.push(cg);
        if (!cgpaByDept.has(did)) cgpaByDept.set(did, []);
        cgpaByDept.get(did)!.push(cg);
      }

      if (row.final_package !== null && row.final_package !== undefined) {
        const pkg = Number(row.final_package);
        allPackages.push(pkg);
        if (!pkgByDept.has(did)) pkgByDept.set(did, []);
        pkgByDept.get(did)!.push(pkg);
      }
    }

    const packageStats = computeStatisticalSummary(allPackages);
    const cgpaStats = computeStatisticalSummary(allCgpas);

    // 2. Department placement & package comparison
    const [departmentComparison] = await pool.query(`
      SELECT d.dept_id, d.dept_name,
             COUNT(DISTINCT s.student_id) AS total_students,
             COUNT(DISTINCT CASE WHEN pr.record_id IS NOT NULL THEN s.student_id END) AS placed_students,
             COUNT(DISTINCT s.student_id) - COUNT(DISTINCT CASE WHEN pr.record_id IS NOT NULL THEN s.student_id END) AS unplaced_students,
             ROUND(100.0 * COUNT(DISTINCT CASE WHEN pr.record_id IS NOT NULL THEN s.student_id END)
               / NULLIF(COUNT(DISTINCT s.student_id), 0), 2) AS placement_percent,
             ROUND(AVG(s.cgpa), 2) AS avg_cgpa,
             MAX(s.cgpa) AS max_cgpa,
             MIN(s.cgpa) AS min_cgpa,
             ROUND(AVG(pr.final_package), 2) AS avg_package_lpa,
             MAX(pr.final_package) AS max_package_lpa,
             MIN(pr.final_package) AS min_package_lpa
      FROM DEPARTMENT d
      LEFT JOIN STUDENT s ON s.dept_id = d.dept_id
      LEFT JOIN APPLICATION a ON a.student_id = s.student_id
      LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a.application_id
      GROUP BY d.dept_id, d.dept_name
      ORDER BY placement_percent DESC, total_students DESC
    `);

    // 3. Application status breakdown (for Pie/Donut chart)
    const [applicationStatusBreakdown] = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM APPLICATION
      GROUP BY status
      ORDER BY count DESC
    `);

    // 4. CGPA distribution buckets across all students
    const [cgpaDistribution] = await pool.query(`
      SELECT
        SUM(CASE WHEN cgpa >= 9.0 THEN 1 ELSE 0 END) AS tier_9_plus,
        SUM(CASE WHEN cgpa >= 8.0 AND cgpa < 9.0 THEN 1 ELSE 0 END) AS tier_8_to_9,
        SUM(CASE WHEN cgpa >= 7.0 AND cgpa < 8.0 THEN 1 ELSE 0 END) AS tier_7_to_8,
        SUM(CASE WHEN cgpa < 7.0 THEN 1 ELSE 0 END) AS tier_below_7
      FROM STUDENT
    `);

    // 5. Backlog distribution across all students
    const [backlogDistribution] = await pool.query(`
      SELECT backlogs, COUNT(*) AS student_count
      FROM STUDENT
      GROUP BY backlogs
      ORDER BY backlogs ASC
    `);

    // 6. Company-wise offers, applications, and package comparison
    const [companyAnalysis] = await pool.query(`
      SELECT c.company_id, c.company_name, c.industry_type,
             COUNT(DISTINCT dr.drive_id) AS drives_count,
             MIN(dr.min_package_lpa) AS min_offered_lpa,
             MAX(dr.max_package_lpa) AS max_offered_lpa,
             COUNT(DISTINCT a.application_id) AS total_applications,
             COUNT(DISTINCT pr.record_id) AS total_offers,
             ROUND(AVG(pr.final_package), 2) AS avg_final_package
      FROM COMPANY c
      LEFT JOIN DRIVE dr ON dr.company_id = c.company_id
      LEFT JOIN APPLICATION a ON a.drive_id = dr.drive_id
      LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a.application_id
      GROUP BY c.company_id, c.company_name, c.industry_type
      ORDER BY total_offers DESC, max_offered_lpa DESC
    `);

    // 7. Interview round result breakdown
    const [interviewRoundStats] = await pool.query(`
      SELECT result, COUNT(*) AS count
      FROM INTERVIEW_ROUND
      GROUP BY result
    `);

    // 8. Package tier distribution among placed students
    const [packageTiers] = await pool.query(`
      SELECT
        SUM(CASE WHEN final_package >= 20.0 THEN 1 ELSE 0 END) AS super_dream_20_plus,
        SUM(CASE WHEN final_package >= 12.0 AND final_package < 20.0 THEN 1 ELSE 0 END) AS dream_12_to_20,
        SUM(CASE WHEN final_package >= 8.0 AND final_package < 12.0 THEN 1 ELSE 0 END) AS tier_1_8_to_12,
        SUM(CASE WHEN final_package < 8.0 THEN 1 ELSE 0 END) AS core_below_8
      FROM PLACEMENT_RECORD
    `);

    const cgpaRow = (cgpaDistribution as any[])[0] || {};
    const pkgTierRow = (packageTiers as any[])[0] || {};

    res.json({
      packageStats,
      cgpaStats,
      departmentComparison: (departmentComparison as any[]).map((r) => {
        const did = Number(r.dept_id);
        const deptCgpaStats = computeStatisticalSummary(cgpaByDept.get(did) || []);
        const deptPkgStats = computeStatisticalSummary(pkgByDept.get(did) || []);
        return {
          ...r,
          dept_id: did,
          total_students: Number(r.total_students || 0),
          placed_students: Number(r.placed_students || 0),
          unplaced_students: Number(r.unplaced_students || 0),
          placement_percent: Number(r.placement_percent || 0),
          avg_cgpa: Number(r.avg_cgpa || 0),
          median_cgpa: deptCgpaStats.median,
          max_cgpa: Number(r.max_cgpa || 0),
          min_cgpa: Number(r.min_cgpa || 0),
          avg_package_lpa: r.avg_package_lpa !== null ? Number(r.avg_package_lpa) : 0,
          median_package_lpa: deptPkgStats.median,
          max_package_lpa: r.max_package_lpa !== null ? Number(r.max_package_lpa) : 0,
          min_package_lpa: r.min_package_lpa !== null ? Number(r.min_package_lpa) : 0,
        };
      }),
      applicationStatusBreakdown: (applicationStatusBreakdown as any[]).map((r) => ({
        status: String(r.status),
        count: Number(r.count || 0),
      })),
      cgpaBuckets: [
        { label: '9.00 – 10.00 (Distinction)', count: Number(cgpaRow.tier_9_plus || 0), color: '#4f46e5' },
        { label: '8.00 – 8.99 (First Class+)', count: Number(cgpaRow.tier_8_to_9 || 0), color: '#0284c7' },
        { label: '7.00 – 7.99 (First Class)', count: Number(cgpaRow.tier_7_to_8 || 0), color: '#10b981' },
        { label: 'Below 7.00 (Second Class)', count: Number(cgpaRow.tier_below_7 || 0), color: '#f59e0b' },
      ],
      backlogDistribution: (backlogDistribution as any[]).map((r) => ({
        backlogs: Number(r.backlogs || 0),
        student_count: Number(r.student_count || 0),
      })),
      companyAnalysis: (companyAnalysis as any[]).map((r) => ({
        company_id: Number(r.company_id),
        company_name: r.company_name,
        industry_type: r.industry_type || 'General',
        drives_count: Number(r.drives_count || 0),
        min_offered_lpa: r.min_offered_lpa !== null ? Number(r.min_offered_lpa) : 0,
        max_offered_lpa: r.max_offered_lpa !== null ? Number(r.max_offered_lpa) : 0,
        total_applications: Number(r.total_applications || 0),
        total_offers: Number(r.total_offers || 0),
        avg_final_package: r.avg_final_package !== null ? Number(r.avg_final_package) : 0,
      })),
      interviewRoundStats: (interviewRoundStats as any[]).map((r) => ({
        result: String(r.result),
        count: Number(r.count || 0),
      })),
      packageTiers: [
        { label: '20+ LPA (Super Dream)', count: Number(pkgTierRow.super_dream_20_plus || 0), color: '#4f46e5' },
        { label: '12 – 19.9 LPA (Dream)', count: Number(pkgTierRow.dream_12_to_20 || 0), color: '#0ea5e9' },
        { label: '8 – 11.9 LPA (Tier 1)', count: Number(pkgTierRow.tier_1_8_to_12 || 0), color: '#10b981' },
        { label: 'Below 8 LPA (Standard)', count: Number(pkgTierRow.core_below_8 || 0), color: '#64748b' },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.sqlMessage || err.message || 'Failed to compute analysis data' });
  }
});

export default router;
