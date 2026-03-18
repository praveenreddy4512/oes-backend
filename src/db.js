import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../exam.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database", err);
  } else {
    console.log("Connected to SQLite database");
    initializeDatabase();
  }
});

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON");

function initializeDatabase() {
  db.serialize(() => {
    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('student', 'professor', 'admin')),
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        professor_id INTEGER NOT NULL,
        duration_minutes INTEGER DEFAULT 60,
        total_questions INTEGER DEFAULT 0,
        passing_score INTEGER DEFAULT 50,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'closed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        option_a TEXT,
        option_b TEXT,
        option_c TEXT,
        option_d TEXT,
        correct_option TEXT,
        marks INTEGER DEFAULT 1,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        is_submitted BOOLEAN DEFAULT 0,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(exam_id, student_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        selected_option TEXT,
        is_correct BOOLEAN DEFAULT 0,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        exam_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        total_marks INTEGER DEFAULT 0,
        obtained_marks INTEGER DEFAULT 0,
        percentage REAL DEFAULT 0.00,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pass', 'fail', 'pending')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, () => {
      // Insert seed data
      seedDatabase();
    });
  });
}

function seedDatabase() {
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (row && row.count === 0) {
      // Insert users first (IDs will be auto-incremented: 1-5)
      const users = [
        ['student1', 'student123', 'student', 'student1@exam.com'],
        ['student2', 'student456', 'student', 'student2@exam.com'],
        ['professor1', 'prof123', 'professor', 'professor1@exam.com'],
        ['professor2', 'prof456', 'professor', 'professor2@exam.com'],
        ['admin1', 'admin123', 'admin', 'admin@exam.com']
      ];

      let usersInserted = 0;
      users.forEach((user, idx) => {
        db.run(
          "INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)",
          user,
          function() {
            usersInserted++;
            if (usersInserted === users.length) {
              // After users are inserted, insert exams (professor_id 3 and 4)
              const exams = [
                ['Mathematics 101', 'Basic mathematics concepts', 3, 60, 'published'],
                ['Physics 201', 'Advanced physics topics', 3, 90, 'published'],
                ['Chemistry Basics', 'General chemistry principles', 4, 45, 'draft']
              ];

              let examsInserted = 0;
              exams.forEach((exam) => {
                db.run(
                  "INSERT INTO exams (title, description, professor_id, duration_minutes, status) VALUES (?, ?, ?, ?, ?)",
                  exam,
                  function() {
                    examsInserted++;
                    if (examsInserted === exams.length) {
                      // After exams, insert questions
                      const questions = [
                        [1, 'What is 2 + 2?', '3', '4', '5', '6', 'b'],
                        [1, 'What is the square root of 16?', '2', '3', '4', '5', 'c'],
                        [2, 'What is the SI unit of force?', 'kg', 'Newton', 'Joule', 'Watt', 'b'],
                        [2, 'What is the speed of light?', '3x10^8 m/s', '2x10^8 m/s', '5x10^8 m/s', '1x10^8 m/s', 'a']
                      ];

                      questions.forEach(q => {
                        db.run(
                          "INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)",
                          q
                        );
                      });

                      console.log("Database seeded with initial data");
                    }
                  }
                );
              });
            }
          }
        );
      });
    }
  });
}

// Create a pool-like interface that works with existing code
export const pool = {
  execute: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve([rows || []]);
      });
    });
  },
  query: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve([rows || []]);
      });
    });
  }
};
