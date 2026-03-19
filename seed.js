import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Try to use cPanel server IP if localhost fails
const dbHost = process.env.DB_HOST === 'localhost' ? '202.88.252.190' : process.env.DB_HOST;

const pool = mysql.createPool({
  host: dbHost,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function seedDatabase() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("✓ Connected to database");

    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('student', 'professor', 'admin') NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Users table ready");

    // Create exams table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS exams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        professor_id INT NOT NULL,
        duration_minutes INT NOT NULL,
        status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES users(id)
      )
    `);
    console.log("✓ Exams table ready");

    // Create questions table
    await connection.execute(`
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
      )
    `);
    console.log("✓ Questions table ready");

    // Create submissions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        exam_id INT NOT NULL,
        student_id INT NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        submitted_at TIMESTAMP NULL,
        is_submitted BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (exam_id) REFERENCES exams(id),
        FOREIGN KEY (student_id) REFERENCES users(id)
      )
    `);
    console.log("✓ Submissions table ready");

    // Create answers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS answers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submission_id INT NOT NULL,
        question_id INT NOT NULL,
        selected_option CHAR(1),
        is_correct BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES submissions(id),
        FOREIGN KEY (question_id) REFERENCES questions(id)
      )
    `);
    console.log("✓ Answers table ready");

    // Create results table
    await connection.execute(`
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
      )
    `);
    console.log("✓ Results table ready");

    // Clear existing data
    await connection.execute("DELETE FROM results");
    await connection.execute("DELETE FROM answers");
    await connection.execute("DELETE FROM submissions");
    await connection.execute("DELETE FROM questions");
    await connection.execute("DELETE FROM exams");
    await connection.execute("DELETE FROM users");
    console.log("✓ Cleared existing data");

    // Seed users (plaintext passwords for demo)
    const users = [
      { username: "student1", password: "student123", role: "student", email: "student1@example.com" },
      { username: "student2", password: "student123", role: "student", email: "student2@example.com" },
      { username: "professor1", password: "prof123", role: "professor", email: "prof1@example.com" },
      { username: "professor2", password: "prof123", role: "professor", email: "prof2@example.com" },
      { username: "admin", password: "admin123", role: "admin", email: "admin@example.com" },
    ];

    for (const user of users) {
      await connection.execute(
        "INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)",
        [user.username, user.password, user.role, user.email]
      );
    }
    console.log(`✓ Inserted ${users.length} users`);

    // Get professor IDs
    const [professors] = await connection.execute(
      "SELECT id FROM users WHERE role = 'professor' LIMIT 2"
    );
    const prof1Id = professors[0].id;
    const prof2Id = professors[1].id;

    // Seed exams
    const exams = [
      {
        title: "Mathematics - Chapter 1",
        description: "Basic Algebra and Equations",
        professor_id: prof1Id,
        duration_minutes: 60,
      },
      {
        title: "Physics - Mechanics",
        description: "Newton's Laws and Motion",
        professor_id: prof1Id,
        duration_minutes: 90,
      },
      {
        title: "Chemistry - Periodic Table",
        description: "Elements and Compounds",
        professor_id: prof2Id,
        duration_minutes: 75,
      },
    ];

    const insertedExams = [];
    for (const exam of exams) {
      const [result] = await connection.execute(
        "INSERT INTO exams (title, description, professor_id, duration_minutes, status) VALUES (?, ?, ?, ?, 'published')",
        [exam.title, exam.description, exam.professor_id, exam.duration_minutes]
      );
      insertedExams.push(result.insertId);
    }
    console.log(`✓ Inserted ${exams.length} exams`);

    // Seed questions for each exam
    const questionsData = [
      // Exam 1: Math
      {
        exam_id: insertedExams[0],
        question_text: "What is 5 + 3?",
        option_a: "7",
        option_b: "8",
        option_c: "9",
        option_d: "10",
        correct_option: "b",
        marks: 1,
      },
      {
        exam_id: insertedExams[0],
        question_text: "Solve for x: 2x + 5 = 13",
        option_a: "2",
        option_b: "3",
        option_c: "4",
        option_d: "5",
        correct_option: "c",
        marks: 2,
      },
      // Exam 2: Physics
      {
        exam_id: insertedExams[1],
        question_text: "Newton's first law is about:",
        option_a: "Gravity",
        option_b: "Inertia",
        option_c: "Energy",
        option_d: "Momentum",
        correct_option: "b",
        marks: 1,
      },
      {
        exam_id: insertedExams[1],
        question_text: "What is the SI unit of force?",
        option_a: "Newton",
        option_b: "Joule",
        option_c: "Watt",
        option_d: "Pascal",
        correct_option: "a",
        marks: 1,
      },
      // Exam 3: Chemistry
      {
        exam_id: insertedExams[2],
        question_text: "What is the atomic number of Carbon?",
        option_a: "4",
        option_b: "6",
        option_c: "8",
        option_d: "12",
        correct_option: "b",
        marks: 1,
      },
      {
        exam_id: insertedExams[2],
        question_text: "Which element has the highest atomic mass?",
        option_a: "Uranium",
        option_b: "Gold",
        option_c: "Iron",
        option_d: "Oxygen",
        correct_option: "a",
        marks: 2,
      },
    ];

    const insertedQuestions = [];
    for (const q of questionsData) {
      const [result] = await connection.execute(
        "INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [q.exam_id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks]
      );
      insertedQuestions.push(result.insertId);
    }
    console.log(`✓ Inserted ${questionsData.length} questions`);

    // Get student IDs
    const [students] = await connection.execute(
      "SELECT id FROM users WHERE role = 'student' LIMIT 2"
    );
    const student1Id = students[0].id;
    const student2Id = students[1].id;

    // Seed sample submissions
    const [submission1] = await connection.execute(
      "INSERT INTO submissions (exam_id, student_id, is_submitted) VALUES (?, ?, TRUE)",
      [insertedExams[0], student1Id]
    );
    const submission1Id = submission1.insertId;

    const [submission2] = await connection.execute(
      "INSERT INTO submissions (exam_id, student_id, is_submitted) VALUES (?, ?, TRUE)",
      [insertedExams[1], student2Id]
    );
    const submission2Id = submission2.insertId;

    console.log("✓ Inserted 2 sample submissions");

    // Seed sample answers for submission 1
    await connection.execute(
      "INSERT INTO answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?)",
      [submission1Id, insertedQuestions[0], "b", true]
    );
    await connection.execute(
      "INSERT INTO answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?)",
      [submission1Id, insertedQuestions[1], "d", false]
    );
    console.log("✓ Inserted sample answers");

    // Seed sample results
    await connection.execute(
      "INSERT INTO results (submission_id, exam_id, student_id, total_marks, obtained_marks, percentage, status) VALUES (?, ?, ?, ?, ?, ?, 'completed')",
      [submission1Id, insertedExams[0], student1Id, 3, 1, 33.33]
    );
    await connection.execute(
      "INSERT INTO results (submission_id, exam_id, student_id, total_marks, obtained_marks, percentage, status) VALUES (?, ?, ?, ?, ?, ?, 'completed')",
      [submission2Id, insertedExams[1], student2Id, 2, 1, 50.00]
    );
    console.log("✓ Inserted sample results");

    console.log("\n✅ Database seeded successfully!");
    console.log("\n📊 Seed Summary:");
    console.log("  - Users: 5 (2 students, 2 professors, 1 admin)");
    console.log("  - Exams: 3");
    console.log("  - Questions: 6");
    console.log("  - Submissions: 2");
    console.log("  - Answers: 2");
    console.log("  - Results: 2");
    console.log("\n🔐 Demo Credentials (plaintext for testing):");
    console.log("  - Student: student1 / student123");
    console.log("  - Professor: professor1 / prof123");
    console.log("  - Admin: admin / admin123");

  } catch (error) {
    console.error("❌ Seeding error:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDatabase();
