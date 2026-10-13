# College Placement Manager

A full-stack college placement management application built on the `C_PLACEMENT` MySQL schema using raw parameterized SQL queries (`mysql2/promise`), transactions, views (`v_student_age`, `v_placement_stats`), and database triggers (`trg_check_eligibility`).

## Project Structure

- `/placement_final.sql` — MySQL schema, seed data, views (`v_student_age`, `v_placement_stats`), and eligibility trigger (`trg_check_eligibility`).
- `/server` — Express + `mysql2/promise` backend (`db.ts`, `index.ts`, and `/routes`).
- `/src` — React + Vite + Tailwind CSS single-page application.
- `/server.ts` — Unified server entry point.
- `/.env.example` — Environment variable template.

## Getting Started

### 1. Load the MySQL Schema
Run `placement_final.sql` in MySQL Workbench or via the MySQL CLI:
```bash
mysql -u root -p < placement_final.sql
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your MySQL credentials:
```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=C_PLACEMENT
PORT=3000
```

### 3. Install Dependencies & Run (Single Unified Command)
Install dependencies from the root `package.json` and start the application:
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. Both the `/api/*` backend routes and the React frontend are served together on `PORT` (default `3000`).

### Production Build & Start
```bash
npm run build
npm start
```
