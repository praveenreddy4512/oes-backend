-- Online Examination System Database Seed Script
-- Run this in cPanel phpMyAdmin for freshmil_oes database

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'professor', 'admin') NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create exams table
CREATE TABLE IF NOT EXISTS exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  professor_id INT NOT NULL,
  duration_minutes INT NOT NULL,
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (professor_id) REFERENCES users(id)
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  question_text TEXT NOT NULL,
  option_a VARCHAR(255),
  option_b VARCHAR(255),
  option_c VARCHAR(255),
  option_d VARCHAR(255),
  correct_option CHAR(1),
  marks INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id)
);

-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  is_submitted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (student_id) REFERENCES users(id)
);

-- Create answers table
CREATE TABLE IF NOT EXISTS answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_option CHAR(1),
  is_correct BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Create results table
CREATE TABLE IF NOT EXISTS results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  total_marks INT DEFAULT 0,
  obtained_marks INT DEFAULT 0,
  percentage DECIMAL(5,2) DEFAULT 0,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (student_id) REFERENCES users(id)
);

-- Clear existing data
DELETE FROM results;
DELETE FROM answers;
DELETE FROM submissions;
DELETE FROM questions;
DELETE FROM exams;
DELETE FROM users;

-- Insert users (plaintext passwords for demo/testing)
INSERT INTO users (username, password, role, email) VALUES
('student1', 'student123', 'student', 'student1@example.com'),
('student2', 'student123', 'student', 'student2@example.com'),
('professor1', 'prof123', 'professor', 'prof1@example.com'),
('professor2', 'prof123', 'professor', 'prof2@example.com'),
('admin', 'admin123', 'admin', 'admin@example.com');

-- Insert exams
INSERT INTO exams (title, description, professor_id, duration_minutes, status) VALUES
('Mathematics - Chapter 1', 'Basic Algebra and Equations', 3, 60, 'published'),
('Physics - Mechanics', 'Newton\'s Laws and Motion', 3, 90, 'published'),
('Chemistry - Periodic Table', 'Elements and Compounds', 4, 75, 'published');

-- Insert questions for exam 1 (Math)
INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) VALUES
(1, 'What is 5 + 3?', '7', '8', '9', '10', 'b', 1),
(1, 'Solve for x: 2x + 5 = 13', '2', '3', '4', '5', 'c', 2);

-- Insert questions for exam 2 (Physics)
INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) VALUES
(2, 'Newton\'s first law is about:', 'Gravity', 'Inertia', 'Energy', 'Momentum', 'b', 1),
(2, 'What is the SI unit of force?', 'Newton', 'Joule', 'Watt', 'Pascal', 'a', 1);

-- Insert questions for exam 3 (Chemistry)
INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) VALUES
(3, 'What is the atomic number of Carbon?', '4', '6', '8', '12', 'b', 1),
(3, 'Which element has the highest atomic mass?', 'Uranium', 'Gold', 'Iron', 'Oxygen', 'a', 2);

-- Insert sample submissions
INSERT INTO submissions (exam_id, student_id, is_submitted) VALUES
(1, 1, TRUE),
(2, 2, TRUE);

-- Insert sample answers
INSERT INTO answers (submission_id, question_id, selected_option, is_correct) VALUES
(1, 1, 'b', TRUE),
(1, 2, 'd', FALSE),
(2, 3, 'b', TRUE),
(2, 4, 'a', TRUE);

-- Insert sample results
INSERT INTO results (submission_id, exam_id, student_id, total_marks, obtained_marks, percentage, status) VALUES
(1, 1, 1, 3, 1, 33.33, 'completed'),
(2, 2, 2, 2, 2, 100.00, 'completed');

-- Display summary
SELECT 'Database Seeded Successfully!' AS status;
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_exams FROM exams;
SELECT COUNT(*) as total_questions FROM questions;
SELECT COUNT(*) as total_submissions FROM submissions;
SELECT COUNT(*) as total_results FROM results;
