CREATE DATABASE IF NOT EXISTS online_exam_db;
USE online_exam_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'professor', 'admin') NOT NULL,
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  professor_id INT NOT NULL,
  duration_minutes INT DEFAULT 60,
  total_questions INT DEFAULT 0,
  passing_score INT DEFAULT 50,
  status ENUM('draft', 'published', 'closed') DEFAULT 'draft',
  shuffle_questions BOOLEAN DEFAULT FALSE COMMENT 'Shuffle question order for each student',
  shuffle_options BOOLEAN DEFAULT FALSE COMMENT 'Shuffle answer options for each question',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (professor_id) REFERENCES users(id) ON DELETE CASCADE
);

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
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  is_submitted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_exam_student (exam_id, student_id)
);

CREATE TABLE IF NOT EXISTS answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_option CHAR(1),
  is_correct BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  total_marks INT DEFAULT 0,
  obtained_marks INT DEFAULT 0,
  percentage DECIMAL(5,2) DEFAULT 0.00,
  status ENUM('pass', 'fail', 'pending') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Intentionally plaintext passwords for this insecure demonstration step.
INSERT INTO users (username, password, role, email) VALUES
  ('student1', 'student123', 'student', 'student1@exam.com'),
  ('student2', 'student456', 'student', 'student2@exam.com'),
  ('professor1', 'prof123', 'professor', 'professor1@exam.com'),
  ('professor2', 'prof456', 'professor', 'professor2@exam.com'),
  ('admin1', 'admin123', 'admin', 'admin@exam.com')
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  role = VALUES(role),
  email = VALUES(email);

-- Seed some exams
INSERT INTO exams (title, description, professor_id, duration_minutes, total_questions, passing_score, status) VALUES
  ('Mathematics 101', 'Basic mathematics concepts', 1, 60, 10, 50, 'published'),
  ('Physics 201', 'Advanced physics topics', 1, 90, 15, 60, 'published'),
  ('Chemistry Basics', 'General chemistry principles', 2, 45, 8, 55, 'draft')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  status = VALUES(status);

-- Seed some questions
INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) VALUES
  (1, 'What is 2 + 2?', '3', '4', '5', '6', 'b', 1),
  (1, 'What is the square root of 16?', '2', '3', '4', '5', 'c', 1),
  (2, 'What is the SI unit of force?', 'kg', 'Newton', 'Joule', 'Watt', 'b', 1),
  (2, 'What is the speed of light?', '3x10^8 m/s', '2x10^8 m/s', '5x10^8 m/s', '1x10^8 m/s', 'a', 1)
ON DUPLICATE KEY UPDATE
  question_text = VALUES(question_text);
