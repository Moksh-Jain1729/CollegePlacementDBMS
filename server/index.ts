/**
 * Express API Server for College Placement Manager
 * Mounts all /api/* routes and serves the frontend on PORT (default 3000).
 * Dynamically imports Vite only in development mode so production deployments
 * run cleanly without requiring dev-server middleware.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import dashboardRouter from './routes/dashboard.ts';
import studentsRouter from './routes/students.ts';
import drivesRouter from './routes/drives.ts';
import eligibilityRouter from './routes/eligibility.ts';
import applicationsRouter from './routes/applications.ts';
import { departmentsRouter, companiesRouter, tposRouter } from './routes/masters.ts';
import placementsRouter from './routes/placements.ts';
import reportsRouter from './routes/reports.ts';
import analysisRouter from './routes/analysis.ts';
import activityRouter from './routes/activity.ts';

dotenv.config();

export async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  // Healthcheck endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // REST JSON API Routes
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/drives', drivesRouter);
  app.use('/api/eligibility', eligibilityRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/departments', departmentsRouter);
  app.use('/api/companies', companiesRouter);
  app.use('/api/tpos', tposRouter);
  app.use('/api/placements', placementsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/analysis', analysisRouter);
  app.use('/api/activity', activityRouter);

  // Unknown API route handler
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  const distPath = path.join(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`College Placement Manager running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
