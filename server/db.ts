/**
 * Database Connection Pool (MySQL2 Promise Pool)
 * Uses DB_HOST, DB_USER, DB_PASSWORD, DB_NAME=C_PLACEMENT from .env
 * In environments where MySQL server is not reachable (e.g. cloud preview),
 * seamlessly falls back to an embedded SQL engine executing the exact same
 * tables, views (v_student_age, v_placement_stats), foreign keys, and
 * BEFORE INSERT trigger (trg_check_eligibility).
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

dotenv.config();

// Primary MySQL2 Promise Pool (with fast connectTimeout so cloud fallback is instant when no MySQL server is present)
const mysqlPool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'C_PLACEMENT',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 1500,
  dateStrings: true, // Return DATE columns as YYYY-MM-DD strings
  decimalNumbers: true,
});

let useFallback = false;
let sqliteDb: SqlJsDatabase | null = null;
let initPromise: Promise<void> | null = null;

const SQLITE_BOOTSTRAP_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE DEPARTMENT (
  dept_id INTEGER PRIMARY KEY AUTOINCREMENT,
  dept_name VARCHAR(100) NOT NULL,
  hod_name VARCHAR(100)
);

CREATE TABLE TPO (
  tpo_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE COMPANY (
  company_id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name VARCHAR(150) NOT NULL,
  industry_type VARCHAR(100)
);

CREATE TABLE STUDENT (
  student_id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  cgpa DECIMAL(4,2) CHECK (cgpa BETWEEN 0 AND 10),
  backlogs INT NOT NULL DEFAULT 0 CHECK (backlogs >= 0),
  date_of_birth DATE,
  dept_id INT NOT NULL,
  FOREIGN KEY (dept_id) REFERENCES DEPARTMENT(dept_id)
);

CREATE TABLE STUDENT_PHONE (
  student_id INT NOT NULL,
  phone_no VARCHAR(20) NOT NULL,
  PRIMARY KEY (student_id, phone_no),
  FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE
);

CREATE TABLE DRIVE (
  drive_id INTEGER PRIMARY KEY AUTOINCREMENT,
  drive_link VARCHAR(255),
  min_package_lpa DECIMAL(5,2),
  max_package_lpa DECIMAL(5,2),
  drive_date DATE NOT NULL,
  company_id INT NOT NULL,
  tpo_id INT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES COMPANY(company_id),
  FOREIGN KEY (tpo_id) REFERENCES TPO(tpo_id),
  CHECK (max_package_lpa >= min_package_lpa)
);

CREATE TABLE ELIGIBILITY_CRITERIA (
  criteria_id INT NOT NULL,
  drive_id INT NOT NULL,
  min_cgpa DECIMAL(4,2),
  max_backlogs INT NOT NULL DEFAULT 0,
  PRIMARY KEY (criteria_id, drive_id),
  FOREIGN KEY (drive_id) REFERENCES DRIVE(drive_id) ON DELETE CASCADE
);

CREATE TABLE ELIGIBILITY_BRANCH (
  criteria_id INT NOT NULL,
  drive_id INT NOT NULL,
  dept_id INT NOT NULL,
  PRIMARY KEY (criteria_id, drive_id, dept_id),
  FOREIGN KEY (criteria_id, drive_id) REFERENCES ELIGIBILITY_CRITERIA(criteria_id, drive_id) ON DELETE CASCADE,
  FOREIGN KEY (dept_id) REFERENCES DEPARTMENT(dept_id)
);

CREATE TABLE APPLICATION (
  application_id INTEGER PRIMARY KEY AUTOINCREMENT,
  applied_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'Applied',
  student_id INT NOT NULL,
  drive_id INT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES STUDENT(student_id),
  FOREIGN KEY (drive_id) REFERENCES DRIVE(drive_id),
  UNIQUE (student_id, drive_id)
);

CREATE TABLE INTERVIEW_ROUND (
  round_no INT NOT NULL,
  application_id INT NOT NULL,
  round_name VARCHAR(50),
  result VARCHAR(30),
  PRIMARY KEY (round_no, application_id),
  FOREIGN KEY (application_id) REFERENCES APPLICATION(application_id) ON DELETE CASCADE
);

CREATE TABLE PLACEMENT_RECORD (
  record_id INTEGER PRIMARY KEY AUTOINCREMENT,
  final_package DECIMAL(5,2),
  offer_date DATE,
  application_id INT NOT NULL UNIQUE,
  FOREIGN KEY (application_id) REFERENCES APPLICATION(application_id)
);

INSERT INTO DEPARTMENT (dept_name, hod_name) VALUES
('Computer Science and Engineering', 'Dr. Alice Smith'),
('Information Technology', 'Dr. Bob Jones'),
('Electronics and Communication', 'Dr. Carol White'),
('Artificial Intelligence and Data Science', 'Dr. Vikram Mehta'),
('Mechanical Engineering', 'Dr. Rajesh Khanna'),
('Electrical and Electronics Engineering', 'Dr. Sunita Rao'),
('Civil Engineering', 'Dr. Arvind Deshmukh');

INSERT INTO TPO (name, email) VALUES
('John Doe', 'john.doe@college.edu'),
('Jane Mary', 'jane.mary@college.edu'),
('Suresh Nair', 'suresh.nair@college.edu'),
('Kavita Krishnan', 'kavita.krishnan@college.edu');

INSERT INTO COMPANY (company_name, industry_type) VALUES
('Google', 'Technology'),
('Microsoft', 'Technology'),
('Accenture', 'IT Services'),
('Amazon', 'Cloud & E-Commerce'),
('JPMorgan Chase', 'FinTech & Banking'),
('Deloitte', 'Consulting'),
('Tata Motors', 'Core Automotive & Engineering'),
('L&T Construction', 'Infrastructure & Civil');

INSERT INTO STUDENT (first_name, last_name, cgpa, backlogs, date_of_birth, dept_id) VALUES
('Rahul', 'Sharma', 8.50, 0, '2004-03-12', 1),
('Priya', 'Patel', 9.10, 0, '2004-07-25', 1),
('Amit', 'Verma', 7.80, 1, '2003-11-02', 2),
('Neha', 'Gupta', 8.90, 0, '2004-01-18', 3),
('Aarav', 'Mehta', 9.45, 0, '2004-02-14', 1),
('Isha', 'Kulkarni', 8.75, 0, '2004-05-19', 1),
('Rohan', 'Deshmukh', 7.60, 1, '2003-09-22', 1),
('Ananya', 'Joshi', 9.20, 0, '2004-08-03', 1),
('Kabir', 'Malhotra', 6.95, 2, '2003-12-11', 1),
('Sneha', 'Iyer', 8.35, 0, '2004-04-28', 1),
('Vikram', 'Choudhary', 8.10, 0, '2004-06-15', 1),
('Pooja', 'Reddy', 9.60, 0, '2004-10-08', 1),
('Aditya', 'Nair', 7.40, 1, '2003-07-17', 1),
('Kritika', 'Bansal', 8.85, 0, '2004-01-30', 1),
('Siddharth', 'Kapoor', 9.05, 0, '2004-03-21', 2),
('Meera', 'Menon', 8.65, 0, '2004-09-12', 2),
('Karan', 'Thakur', 7.25, 1, '2003-10-05', 2),
('Tanvi', 'Shah', 8.95, 0, '2004-02-27', 2),
('Harsh', 'Agarwal', 8.15, 0, '2004-07-09', 2),
('Nisha', 'Chatterjee', 9.30, 0, '2004-11-16', 2),
('Yash', 'Tiwari', 6.80, 2, '2003-06-24', 2),
('Riya', 'Saxena', 8.40, 0, '2004-05-02', 2),
('Pranav', 'Gokhale', 7.90, 0, '2004-08-19', 2),
('Divya', 'Nambiar', 8.55, 0, '2004-04-11', 3),
('Manish', 'Pandey', 7.70, 1, '2003-12-29', 3),
('Shruti', 'Bhatia', 9.15, 0, '2004-06-07', 3),
('Arjun', 'Rao', 8.20, 0, '2004-01-05', 3),
('Aditi', 'Mishra', 7.35, 1, '2003-08-14', 3),
('Nikhil', 'Srinivasan', 9.00, 0, '2004-09-25', 3),
('Gaurav', 'Yadav', 6.70, 2, '2003-05-18', 3),
('Swati', 'Kamble', 8.45, 0, '2004-03-04', 3),
('Dev', 'Singhal', 9.50, 0, '2004-07-13', 4),
('Aishwarya', 'Shetty', 8.80, 0, '2004-10-21', 4),
('Varun', 'Bajaj', 8.25, 0, '2004-02-08', 4),
('Simran', 'Kaur', 9.10, 0, '2004-05-30', 4),
('Rishabh', 'Jain', 7.65, 1, '2003-11-19', 4),
('Tanya', 'Arora', 8.95, 0, '2004-08-26', 4),
('Kunal', 'Parekh', 8.05, 0, '2004-01-12', 4),
('Sanya', 'Mirza', 9.35, 0, '2004-04-03', 4),
('Akash', 'Dubey', 7.15, 2, '2003-09-07', 4),
('Rehan', 'Qureshi', 8.60, 0, '2004-06-22', 4),
('Saurabh', 'Chauhan', 8.30, 0, '2004-02-17', 5),
('Pallavi', 'Desai', 7.95, 0, '2004-07-01', 5),
('Deepak', 'Rathore', 7.20, 1, '2003-10-28', 5),
('Mansi', 'Bhosale', 8.70, 0, '2004-03-15', 5),
('Abhishek', 'Tripathi', 6.85, 2, '2003-08-09', 5),
('Bhavna', 'Pillai', 8.15, 0, '2004-05-23', 5),
('Chetan', 'Solanki', 7.50, 1, '2003-12-03', 5),
('Tejas', 'Shinde', 8.45, 0, '2004-09-14', 6),
('Radhika', 'Venkatesh', 8.90, 0, '2004-01-27', 6),
('Mayank', 'Dixit', 7.55, 1, '2003-07-31', 6),
('Ankita', 'Ghoshal', 8.35, 0, '2004-04-18', 6),
('Tushar', 'Pawar', 7.10, 1, '2003-11-25', 6),
('Lavanya', 'Subramanian', 9.05, 0, '2004-06-11', 6),
('Parth', 'Trivedi', 7.85, 0, '2004-02-02', 6),
('Omkar', 'Jadhav', 8.20, 0, '2004-08-08', 7),
('Sakshi', 'Upadhyay', 8.60, 0, '2004-03-29', 7),
('Naveen', 'Gowda', 7.30, 1, '2003-09-16', 7),
('Payal', 'Chawla', 7.90, 0, '2004-05-06', 7),
('Chirag', 'Soni', 6.90, 2, '2003-10-19', 7);

INSERT INTO STUDENT_PHONE (student_id, phone_no) VALUES
(1, '9876543210'), (1, '9876500000'),
(2, '9123456789'), (2, '9123400001'),
(3, '9988776655'),
(4, '9811223344'),
(5, '9820112233'), (5, '9820998877'),
(6, '9820112234'),
(7, '9820112235'),
(8, '9820112236'), (8, '9769001122'),
(9, '9820112237'),
(10, '9820112238'),
(11, '9820112239'),
(12, '9820112240'), (12, '9769001140'),
(13, '9820112241'),
(14, '9820112242'),
(15, '9820112243'), (15, '9769001143'),
(16, '9820112244'),
(17, '9820112245'),
(18, '9820112246'),
(19, '9820112247'),
(20, '9820112248'), (20, '9769001148'),
(21, '9820112249'),
(22, '9820112250'),
(23, '9820112251'),
(24, '9820112252'),
(25, '9820112253'),
(26, '9820112254'), (26, '9769001154'),
(27, '9820112255'),
(28, '9820112256'),
(29, '9820112257'),
(30, '9820112258'),
(31, '9820112259'),
(32, '9820112260'), (32, '9769001160'),
(33, '9820112261'),
(34, '9820112262'),
(35, '9820112263'),
(36, '9820112264'),
(37, '9820112265'),
(38, '9820112266'),
(39, '9820112267'), (39, '9769001167'),
(40, '9820112268'),
(41, '9820112269'),
(42, '9820112270'),
(43, '9820112271'),
(44, '9820112272'),
(45, '9820112273'),
(46, '9820112274'),
(47, '9820112275'),
(48, '9820112276'),
(49, '9820112277'),
(50, '9820112278'),
(51, '9820112279'),
(52, '9820112280'),
(53, '9820112281'),
(54, '9820112282'),
(55, '9820112283'),
(56, '9820112284'),
(57, '9820112285'),
(58, '9820112286'),
(59, '9820112287'),
(60, '9820112288');

INSERT INTO DRIVE (drive_link, min_package_lpa, max_package_lpa, drive_date, company_id, tpo_id) VALUES
('https://careers.google.com/drive2026', 12.00, 25.00, '2026-05-10', 1, 1),
('https://careers.microsoft.com/drive2026', 10.00, 20.00, '2026-05-15', 2, 1),
('https://accenture.com/drive2026', 4.50, 8.00, '2026-05-20', 3, 2),
('https://amazon.jobs/campus2026', 14.00, 28.00, '2026-05-25', 4, 3),
('https://jpmorgan.com/campus2026', 11.00, 18.00, '2026-06-02', 5, 2),
('https://deloitte.com/careers2026', 6.50, 10.50, '2026-06-08', 6, 4),
('https://tatamotors.com/get2026', 6.00, 9.50, '2026-06-14', 7, 3),
('https://lntecc.com/campus2026', 5.50, 8.50, '2026-06-20', 8, 4);

INSERT INTO ELIGIBILITY_CRITERIA (criteria_id, drive_id, min_cgpa, max_backlogs) VALUES
(1, 1, 8.00, 0),
(2, 1, 9.00, 0),
(1, 2, 7.50, 1),
(1, 3, 6.50, 2),
(1, 4, 8.20, 0),
(2, 4, 8.80, 0),
(1, 5, 7.80, 0),
(1, 6, 7.00, 1),
(1, 7, 7.20, 1),
(1, 8, 6.80, 2);

INSERT INTO ELIGIBILITY_BRANCH (criteria_id, drive_id, dept_id) VALUES
(1, 1, 1), (1, 1, 2), (1, 1, 4),
(2, 1, 3), (2, 1, 6),
(1, 2, 1), (1, 2, 2), (1, 2, 3), (1, 2, 4),
(1, 3, 1), (1, 3, 2), (1, 3, 3), (1, 3, 4), (1, 3, 5), (1, 3, 6), (1, 3, 7),
(1, 4, 1), (1, 4, 2), (1, 4, 4),
(2, 4, 3),
(1, 5, 1), (1, 5, 2), (1, 5, 3), (1, 5, 4),
(1, 6, 1), (1, 6, 2), (1, 6, 3), (1, 6, 4), (1, 6, 5), (1, 6, 6),
(1, 7, 3), (1, 7, 5), (1, 7, 6),
(1, 8, 5), (1, 8, 6), (1, 8, 7);

INSERT INTO APPLICATION (applied_date, status, student_id, drive_id) VALUES
('2026-04-01', 'Applied', 1, 1),
('2026-04-02', 'Shortlisted', 2, 1),
('2026-04-03', 'Applied', 3, 2),
('2026-04-04', 'Selected', 4, 3),
('2026-04-05', 'Selected', 5, 1),
('2026-04-05', 'Selected', 6, 2),
('2026-04-06', 'Selected', 8, 4),
('2026-04-06', 'Selected', 12, 1),
('2026-04-07', 'Shortlisted', 10, 5),
('2026-04-07', 'Rejected', 7, 2),
('2026-04-08', 'Selected', 14, 5),
('2026-04-08', 'Selected', 15, 2),
('2026-04-09', 'Selected', 16, 5),
('2026-04-09', 'Selected', 18, 4),
('2026-04-10', 'Selected', 20, 1),
('2026-04-10', 'Applied', 19, 6),
('2026-04-11', 'Selected', 22, 6),
('2026-04-11', 'Selected', 26, 2),
('2026-04-12', 'Selected', 29, 4),
('2026-04-12', 'Shortlisted', 24, 5),
('2026-04-13', 'Selected', 31, 6),
('2026-04-13', 'Selected', 32, 4),
('2026-04-14', 'Selected', 33, 5),
('2026-04-14', 'Selected', 35, 1),
('2026-04-15', 'Selected', 37, 2),
('2026-04-15', 'Selected', 39, 4),
('2026-04-16', 'Shortlisted', 41, 6),
('2026-04-16', 'Selected', 42, 7),
('2026-04-17', 'Selected', 45, 7),
('2026-04-17', 'Selected', 47, 6),
('2026-04-18', 'Selected', 49, 7),
('2026-04-18', 'Selected', 50, 7),
('2026-04-19', 'Selected', 54, 6),
('2026-04-19', 'Selected', 56, 8),
('2026-04-20', 'Selected', 57, 8),
('2026-04-20', 'Applied', 59, 8);

INSERT INTO INTERVIEW_ROUND (round_no, application_id, round_name, result) VALUES
(1, 1, 'Online Assessment', 'Passed'),
(2, 1, 'Technical Interview 1', 'Failed'),
(1, 2, 'Online Assessment', 'Passed'),
(2, 2, 'Technical Interview 1', 'Passed'),
(1, 4, 'HR Round', 'Passed'),
(1, 5, 'Online Assessment', 'Passed'),
(2, 5, 'System Design & Coding', 'Passed'),
(3, 5, 'Hiring Committee Review', 'Passed'),
(1, 6, 'Coding Test', 'Passed'),
(2, 6, 'Technical & HR', 'Passed'),
(1, 7, 'Online Assessment', 'Passed'),
(2, 7, 'Bar Raiser Round', 'Passed'),
(1, 8, 'Online Assessment', 'Passed'),
(2, 8, 'Technical Interview', 'Passed'),
(1, 9, 'Aptitude & Coding', 'Passed'),
(2, 9, 'Technical Interview', 'Pending'),
(1, 10, 'Coding Assessment', 'Failed');

INSERT INTO PLACEMENT_RECORD (final_package, offer_date, application_id) VALUES
(6.50, '2026-05-25', 4),
(22.00, '2026-05-14', 5),
(16.50, '2026-05-18', 6),
(26.00, '2026-05-28', 7),
(24.50, '2026-05-14', 8),
(15.00, '2026-06-05', 11),
(18.00, '2026-05-19', 12),
(14.50, '2026-06-06', 13),
(25.00, '2026-05-29', 14),
(21.00, '2026-05-15', 15),
(9.00, '2026-06-11', 17),
(15.50, '2026-05-20', 18),
(24.00, '2026-05-30', 19),
(8.50, '2026-06-12', 21),
(27.50, '2026-05-29', 22),
(16.00, '2026-06-06', 23),
(23.00, '2026-05-15', 24),
(17.50, '2026-05-19', 25),
(26.50, '2026-05-30', 26),
(8.20, '2026-06-18', 28),
(9.00, '2026-06-18', 29),
(7.80, '2026-06-12', 30),
(8.50, '2026-06-19', 31),
(9.20, '2026-06-19', 32),
(9.50, '2026-06-12', 33),
(7.50, '2026-06-24', 34),
(8.00, '2026-06-24', 35);

-- Views matching placement_final.sql
CREATE VIEW v_student_age AS
SELECT student_id, first_name, last_name, date_of_birth,
  CASE
    WHEN date_of_birth IS NULL OR date_of_birth = '' THEN NULL
    ELSE CAST(
      (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', date_of_birth) AS INTEGER)) -
      (CASE WHEN strftime('%m-%d', 'now') < strftime('%m-%d', date_of_birth) THEN 1 ELSE 0 END)
    AS INTEGER)
  END AS age
FROM STUDENT;

CREATE VIEW v_placement_stats AS
SELECT d.dept_name,
  COUNT(DISTINCT s.student_id) AS total_students,
  COUNT(DISTINCT CASE WHEN pr.record_id IS NOT NULL THEN s.student_id END) AS placed_students,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN pr.record_id IS NOT NULL THEN s.student_id END)
    / COUNT(DISTINCT s.student_id), 2) AS placement_percent,
  ROUND(AVG(pr.final_package), 2) AS avg_package_lpa
FROM DEPARTMENT d
JOIN STUDENT s ON s.dept_id = d.dept_id
LEFT JOIN APPLICATION a ON a.student_id = s.student_id
LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a.application_id
GROUP BY d.dept_id, d.dept_name;

-- Trigger matching trg_check_eligibility in placement_final.sql
CREATE TRIGGER trg_check_eligibility BEFORE INSERT ON APPLICATION
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM STUDENT s
      JOIN ELIGIBILITY_CRITERIA ec ON ec.drive_id = NEW.drive_id
      JOIN ELIGIBILITY_BRANCH eb ON eb.criteria_id = ec.criteria_id
        AND eb.drive_id = ec.drive_id
        AND eb.dept_id = s.dept_id
      WHERE s.student_id = NEW.student_id
        AND s.cgpa >= ec.min_cgpa
        AND s.backlogs <= ec.max_backlogs
    )
    THEN RAISE(ABORT, 'Student is not eligible for this drive')
  END;
END;
`;

async function ensureInitialized(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const hasExplicitMySqlHost = Boolean(process.env.DB_HOST && process.env.DB_HOST.trim() !== '');
    if (hasExplicitMySqlHost) {
      try {
        const conn = await mysqlPool.getConnection();
        await conn.ping();
        conn.release();
        useFallback = false;
        console.log('Connected to MySQL database:', process.env.DB_NAME || 'C_PLACEMENT');
        return;
      } catch {
        // Fall through to embedded SQL engine
      }
    }
    useFallback = true;
    const wasmCandidate = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs(
      fs.existsSync(wasmCandidate) ? { locateFile: () => wasmCandidate } : undefined
    );
    sqliteDb = new SQL.Database();
    sqliteDb.run(SQLITE_BOOTSTRAP_SQL);
    console.log('Running C_PLACEMENT schema on embedded SQL engine.');
  })();
  return initPromise;
}

function normalizeMySqlError(err: any): Error {
  const message = String(err?.message || err || 'Database error');
  const enhanced: any = new Error(message);
  if (message.includes('Student is not eligible for this drive')) {
    enhanced.sqlState = '45000';
    enhanced.code = 'ER_SIGNAL_EXCEPTION';
    enhanced.sqlMessage = 'Student is not eligible for this drive';
  } else if (message.includes('UNIQUE constraint failed: APPLICATION.student_id, APPLICATION.drive_id')) {
    enhanced.code = 'ER_DUP_ENTRY';
    enhanced.errno = 1062;
    enhanced.sqlMessage = 'Duplicate entry for key APPLICATION.student_id_drive_id';
  } else if (message.includes('UNIQUE constraint failed')) {
    enhanced.code = 'ER_DUP_ENTRY';
    enhanced.errno = 1062;
    enhanced.sqlMessage = message;
  } else if (message.includes('FOREIGN KEY constraint failed')) {
    enhanced.code = 'ER_ROW_IS_REFERENCED_2';
    enhanced.errno = 1451;
    enhanced.sqlMessage = 'Cannot delete or update a parent row: a foreign key constraint fails';
  } else if (message.includes('CHECK constraint failed')) {
    enhanced.code = 'ER_CHECK_CONSTRAINT_VIOLATED';
    enhanced.errno = 3819;
    enhanced.sqlMessage = message;
  }
  return enhanced;
}

function executeOnSqlite(sql: string, params: any[] = []): [any, any] {
  if (!sqliteDb) throw new Error('SQL database not initialized');
  sqliteDb.run('PRAGMA foreign_keys = ON;');
  // Translate CURDATE() if present in raw SQL queries
  const translatedSql = sql.replace(/CURDATE\(\)/gi, "date('now')");
  const trimmed = translatedSql.trim().toUpperCase();
  try {
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
      const stmt = sqliteDb.prepare(translatedSql);
      stmt.bind(params);
      const rows: any[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return [rows, []];
    } else {
      sqliteDb.run(translatedSql, params);
      const affectedRows = sqliteDb.getRowsModified();
      let insertId = 0;
      if (trimmed.startsWith('INSERT')) {
        const res = sqliteDb.exec('SELECT last_insert_rowid() AS id');
        if (res[0]?.values?.[0]?.[0]) {
          insertId = Number(res[0].values[0][0]);
        }
      }
      return [{ insertId, affectedRows }, undefined];
    }
  } catch (err) {
    throw normalizeMySqlError(err);
  }
}

export interface PoolConnectionLike {
  query(sql: string, params?: any[]): Promise<[any, any]>;
  execute(sql: string, params?: any[]): Promise<[any, any]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

const pool = {
  async query(sql: string, params: any[] = []): Promise<[any, any]> {
    await ensureInitialized();
    if (!useFallback) {
      return mysqlPool.query(sql, params);
    }
    return executeOnSqlite(sql, params);
  },
  async execute(sql: string, params: any[] = []): Promise<[any, any]> {
    await ensureInitialized();
    if (!useFallback) {
      return mysqlPool.execute(sql, params);
    }
    return executeOnSqlite(sql, params);
  },
  async getConnection(): Promise<PoolConnectionLike> {
    await ensureInitialized();
    if (!useFallback) {
      return mysqlPool.getConnection();
    }
    let inTx = false;
    return {
      async query(sql: string, params: any[] = []) {
        return executeOnSqlite(sql, params);
      },
      async execute(sql: string, params: any[] = []) {
        return executeOnSqlite(sql, params);
      },
      async beginTransaction() {
        if (!inTx && sqliteDb) {
          sqliteDb.run('BEGIN TRANSACTION');
          inTx = true;
        }
      },
      async commit() {
        if (inTx && sqliteDb) {
          sqliteDb.run('COMMIT');
          inTx = false;
        }
      },
      async rollback() {
        if (inTx && sqliteDb) {
          try {
            sqliteDb.run('ROLLBACK');
          } catch {
            // ignore rollback error if already rolled back
          }
          inTx = false;
        }
      },
      release() {
        if (inTx && sqliteDb) {
          try {
            sqliteDb.run('ROLLBACK');
          } catch {
            // ignore
          }
          inTx = false;
        }
      },
    };
  },
};

export default pool;
