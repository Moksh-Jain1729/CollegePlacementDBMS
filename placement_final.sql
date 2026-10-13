-- =====================================================
-- College Placement Management System (final schema)
-- NOTE: the next line wipes any old copy of the database
-- =====================================================

DROP DATABASE IF EXISTS C_PLACEMENT;
CREATE DATABASE C_PLACEMENT;
USE C_PLACEMENT;

-- ---------- STRONG ENTITIES ----------

CREATE TABLE DEPARTMENT (
  dept_id INT AUTO_INCREMENT PRIMARY KEY,
  dept_name VARCHAR(100) NOT NULL,
  hod_name VARCHAR(100)
);

CREATE TABLE TPO (
  tpo_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE COMPANY (
  company_id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(150) NOT NULL,
  industry_type VARCHAR(100)
);

CREATE TABLE STUDENT (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  cgpa DECIMAL(4,2) CHECK (cgpa BETWEEN 0 AND 10),
  backlogs INT NOT NULL DEFAULT 0 CHECK (backlogs >= 0),
  date_of_birth DATE,
  dept_id INT NOT NULL,
  FOREIGN KEY (dept_id) REFERENCES DEPARTMENT(dept_id)
);

-- multivalued attribute phone_no
CREATE TABLE STUDENT_PHONE (
  student_id INT NOT NULL,
  phone_no VARCHAR(20) NOT NULL,
  PRIMARY KEY (student_id, phone_no),
  FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE
);

CREATE TABLE DRIVE (
  drive_id INT AUTO_INCREMENT PRIMARY KEY,
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

-- ---------- WEAK ENTITY: ELIGIBILITY_CRITERIA (1 drive : N criteria) ----------

CREATE TABLE ELIGIBILITY_CRITERIA (
  criteria_id INT NOT NULL,
  drive_id INT NOT NULL,
  min_cgpa DECIMAL(4,2),
  max_backlogs INT NOT NULL DEFAULT 0,
  PRIMARY KEY (criteria_id, drive_id),
  FOREIGN KEY (drive_id) REFERENCES DRIVE(drive_id) ON DELETE CASCADE
);

-- multivalued attribute allowed_branches (links to DEPARTMENT so it can be joined)
CREATE TABLE ELIGIBILITY_BRANCH (
  criteria_id INT NOT NULL,
  drive_id INT NOT NULL,
  dept_id INT NOT NULL,
  PRIMARY KEY (criteria_id, drive_id, dept_id),
  FOREIGN KEY (criteria_id, drive_id) REFERENCES ELIGIBILITY_CRITERIA(criteria_id, drive_id) ON DELETE CASCADE,
  FOREIGN KEY (dept_id) REFERENCES DEPARTMENT(dept_id)
);

-- ---------- APPLICATION & RELATED ----------

CREATE TABLE APPLICATION (
  application_id INT AUTO_INCREMENT PRIMARY KEY,
  applied_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'Applied',
  student_id INT NOT NULL,
  drive_id INT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES STUDENT(student_id),
  FOREIGN KEY (drive_id) REFERENCES DRIVE(drive_id),
  UNIQUE (student_id, drive_id) -- no duplicate applications
);

-- weak entity of APPLICATION
CREATE TABLE INTERVIEW_ROUND (
  round_no INT NOT NULL,
  application_id INT NOT NULL,
  round_name VARCHAR(50),
  result VARCHAR(30),
  PRIMARY KEY (round_no, application_id),
  FOREIGN KEY (application_id) REFERENCES APPLICATION(application_id) ON DELETE CASCADE
);

CREATE TABLE PLACEMENT_RECORD (
  record_id INT AUTO_INCREMENT PRIMARY KEY,
  final_package DECIMAL(5,2),
  offer_date DATE,
  application_id INT NOT NULL UNIQUE, -- 1:1 with APPLICATION
  FOREIGN KEY (application_id) REFERENCES APPLICATION(application_id)
);

-- ---------- SAMPLE DATA ----------

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
(1, '9876543210'),
(1, '9876500000'),
(2, '9123456789'),
(2, '9123400001'),
(3, '9988776655'),
(4, '9811223344'),
(5, '9820112233'),
(5, '9820998877'),
(6, '9820112234'),
(7, '9820112235'),
(8, '9820112236'),
(8, '9769001122'),
(9, '9820112237'),
(10, '9820112238'),
(11, '9820112239'),
(12, '9820112240'),
(12, '9769001140'),
(13, '9820112241'),
(14, '9820112242'),
(15, '9820112243'),
(15, '9769001143'),
(16, '9820112244'),
(17, '9820112245'),
(18, '9820112246'),
(19, '9820112247'),
(20, '9820112248'),
(20, '9769001148'),
(21, '9820112249'),
(22, '9820112250'),
(23, '9820112251'),
(24, '9820112252'),
(25, '9820112253'),
(26, '9820112254'),
(26, '9769001154'),
(27, '9820112255'),
(28, '9820112256'),
(29, '9820112257'),
(30, '9820112258'),
(31, '9820112259'),
(32, '9820112260'),
(32, '9769001160'),
(33, '9820112261'),
(34, '9820112262'),
(35, '9820112263'),
(36, '9820112264'),
(37, '9820112265'),
(38, '9820112266'),
(39, '9820112267'),
(39, '9769001167'),
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

-- Drive 1 and Drive 4 have two criteria sets (shows the 1:N weak entity)
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
(1, 1, 1), (1, 1, 2), (1, 1, 4), -- drive 1, set 1: CSE, IT, AI&DS
(2, 1, 3), (2, 1, 6),            -- drive 1, set 2: ECE, EEE (needs 9.0)
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

-- ---------- VIEWS ----------

-- age is a derived attribute, so it is computed, never stored
CREATE VIEW v_student_age AS
SELECT student_id, first_name, last_name, date_of_birth,
  TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) AS age
FROM STUDENT;

-- placement statistics per department
CREATE VIEW v_placement_stats AS
SELECT d.dept_name,
  COUNT(DISTINCT s.student_id) AS total_students,
  COUNT(DISTINCT CASE WHEN pr.record_id IS NOT NULL THEN s.student_id END) AS placed_students,
  ROUND(100 * COUNT(DISTINCT CASE WHEN pr.record_id IS NOT NULL THEN s.student_id END)
    / COUNT(DISTINCT s.student_id), 2) AS placement_percent,
  ROUND(AVG(pr.final_package), 2) AS avg_package_lpa
FROM DEPARTMENT d
JOIN STUDENT s ON s.dept_id = d.dept_id
LEFT JOIN APPLICATION a ON a.student_id = s.student_id
LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a.application_id
GROUP BY d.dept_id, d.dept_name;

-- ---------- ELIGIBILITY QUERY (the core of the project) ----------

-- Every student eligible for every drive (CGPA + backlogs + branch).
-- A student qualifies if ANY criteria set of the drive is satisfied.
SELECT DISTINCT dr.drive_id, c.company_name,
  s.student_id, s.first_name, s.last_name, s.cgpa, s.backlogs
FROM DRIVE dr
JOIN COMPANY c ON c.company_id = dr.company_id
JOIN ELIGIBILITY_CRITERIA ec ON ec.drive_id = dr.drive_id
JOIN ELIGIBILITY_BRANCH eb ON eb.criteria_id = ec.criteria_id AND eb.drive_id = ec.drive_id
JOIN STUDENT s ON s.dept_id = eb.dept_id
WHERE s.cgpa >= ec.min_cgpa
  AND s.backlogs <= ec.max_backlogs
ORDER BY dr.drive_id, s.student_id;

-- Drives open to one student (change the id)
SELECT DISTINCT dr.drive_id, c.company_name, dr.drive_date, dr.min_package_lpa, dr.max_package_lpa
FROM STUDENT s
JOIN ELIGIBILITY_BRANCH eb ON eb.dept_id = s.dept_id
JOIN ELIGIBILITY_CRITERIA ec ON ec.criteria_id = eb.criteria_id AND ec.drive_id = eb.drive_id
JOIN DRIVE dr ON dr.drive_id = ec.drive_id
JOIN COMPANY c ON c.company_id = dr.company_id
WHERE s.student_id = 1
  AND s.cgpa >= ec.min_cgpa
  AND s.backlogs <= ec.max_backlogs;

-- ---------- TRIGGER: block applications from ineligible students ----------
-- (created after sample data so the inserts above are not affected)

DELIMITER //
CREATE TRIGGER trg_check_eligibility BEFORE INSERT ON APPLICATION
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM STUDENT s
    JOIN ELIGIBILITY_CRITERIA ec ON ec.drive_id = NEW.drive_id
    JOIN ELIGIBILITY_BRANCH eb ON eb.criteria_id = ec.criteria_id
      AND eb.drive_id = ec.drive_id
      AND eb.dept_id = s.dept_id
    WHERE s.student_id = NEW.student_id
      AND s.cgpa >= ec.min_cgpa
      AND s.backlogs <= ec.max_backlogs
  ) THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Student is not eligible for this drive';
  END IF;
END//
DELIMITER ;

-- ---------- REPORT QUERIES (from your original file) ----------

SELECT first_name, last_name, cgpa FROM STUDENT WHERE cgpa >= 8.5;

SELECT AVG(cgpa) AS average_cgpa, MAX(cgpa) AS highest_cgpa, MIN(cgpa) AS lowest_cgpa FROM STUDENT;

SELECT COUNT(*) AS total_drives FROM DRIVE;

SELECT d.dept_name, COUNT(s.student_id) AS total_students
FROM DEPARTMENT d
LEFT JOIN STUDENT s ON d.dept_id = s.dept_id
GROUP BY d.dept_name;

SELECT c.company_name,
  MAX(d.max_package_lpa) AS highest_package,
  MIN(d.min_package_lpa) AS lowest_package
FROM COMPANY c
JOIN DRIVE d ON c.company_id = d.company_id
GROUP BY c.company_name;

SELECT a.status, COUNT(a.application_id) AS status_count
FROM APPLICATION a
JOIN DRIVE d ON a.drive_id = d.drive_id
WHERE d.drive_date > '2026-05-01'
GROUP BY a.status;

SELECT d.dept_name, AVG(s.cgpa) AS avg_dept_cgpa
FROM DEPARTMENT d
JOIN STUDENT s ON d.dept_id = s.dept_id
GROUP BY d.dept_name
HAVING AVG(s.cgpa) > 8.0;

-- new report queries
SELECT * FROM v_student_age;
SELECT * FROM v_placement_stats;

-- Test the trigger: Neha (ECE, CGPA 8.9) is not eligible for drive 1 (needs 9.0)
-- INSERT INTO APPLICATION (applied_date, student_id, drive_id) VALUES ('2026-04-10', 4, 1);

-- ---------- ADDITIONAL ANALYTICAL QUERIES ----------

-- 1. Unplaced students & count of drives they are eligible for
SELECT s.student_id, s.first_name, s.last_name, d.dept_name, s.cgpa, s.backlogs,
  COUNT(DISTINCT dr.drive_id) AS eligible_drives_count
FROM STUDENT s
JOIN DEPARTMENT d ON s.dept_id = d.dept_id
LEFT JOIN APPLICATION a_placed ON a_placed.student_id = s.student_id
LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a_placed.application_id
LEFT JOIN ELIGIBILITY_BRANCH eb ON eb.dept_id = s.dept_id
LEFT JOIN ELIGIBILITY_CRITERIA ec ON ec.criteria_id = eb.criteria_id
  AND ec.drive_id = eb.drive_id
  AND s.cgpa >= ec.min_cgpa
  AND s.backlogs <= ec.max_backlogs
LEFT JOIN DRIVE dr ON dr.drive_id = ec.drive_id
WHERE pr.record_id IS NULL
GROUP BY s.student_id, s.first_name, s.last_name, d.dept_name, s.cgpa, s.backlogs
ORDER BY s.cgpa DESC;

-- 2. Interview round funnel & pass/fail breakdown per company
SELECT c.company_name,
  COUNT(ir.round_no) AS total_rounds_conducted,
  SUM(CASE WHEN ir.result = 'Passed' THEN 1 ELSE 0 END) AS rounds_passed,
  SUM(CASE WHEN ir.result = 'Failed' THEN 1 ELSE 0 END) AS rounds_failed,
  SUM(CASE WHEN ir.result = 'Pending' THEN 1 ELSE 0 END) AS rounds_pending
FROM COMPANY c
JOIN DRIVE dr ON dr.company_id = c.company_id
JOIN APPLICATION a ON a.drive_id = dr.drive_id
JOIN INTERVIEW_ROUND ir ON ir.application_id = a.application_id
GROUP BY c.company_id, c.company_name
ORDER BY total_rounds_conducted DESC;

-- 3. TPO workload & placement conversion report
SELECT t.tpo_id, t.name AS tpo_name, t.email,
  COUNT(DISTINCT dr.drive_id) AS drives_managed,
  COUNT(DISTINCT a.application_id) AS total_applications,
  COUNT(DISTINCT pr.record_id) AS confirmed_placements
FROM TPO t
LEFT JOIN DRIVE dr ON dr.tpo_id = t.tpo_id
LEFT JOIN APPLICATION a ON a.drive_id = dr.drive_id
LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a.application_id
GROUP BY t.tpo_id, t.name, t.email
ORDER BY drives_managed DESC;

-- 4. Complete student application & placement offer dossier
SELECT s.student_id, s.first_name, s.last_name, d.dept_name, s.cgpa,
  COALESCE(c.company_name, 'No Applications') AS company_name,
  COALESCE(a.status, 'Not Applied') AS application_status,
  pr.final_package AS offer_package_lpa,
  pr.offer_date
FROM STUDENT s
JOIN DEPARTMENT d ON s.dept_id = d.dept_id
LEFT JOIN APPLICATION a ON a.student_id = s.student_id
LEFT JOIN DRIVE dr ON dr.drive_id = a.drive_id
LEFT JOIN COMPANY c ON c.company_id = dr.company_id
LEFT JOIN PLACEMENT_RECORD pr ON pr.application_id = a.application_id
ORDER BY s.student_id ASC, a.applied_date DESC;
