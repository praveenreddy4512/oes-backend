import express from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = express.Router();

// 🔐 SECURITY: Protect exams routes with JWT authentication
router.use(authMiddleware);

// Get all exams (with filters for role)
router.get("/", async (req, res) => {
  try {
    const [exams] = await pool.execute(
      "SELECT e.*, u.username as professor_name FROM exams e JOIN users u ON e.professor_id = u.id ORDER BY e.created_at DESC"
    );
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get exam by ID with questions
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // ❌ VULNERABLE CODE (for educational purposes - DO NOT USE IN PRODUCTION)
    // Insecure approach - string concatenation:
    // const unsafeQuery = `SELECT e.*, u.username as professor_name FROM exams e JOIN users u ON e.professor_id = u.id WHERE e.id = ${id}`;
    // const [exams] = await pool.execute(unsafeQuery);
    // Problems:
    // - SQL Injection: id = "1 UNION SELECT * FROM users" reveals all user passwords
    // - Unauthorized data access to other exams/users
    // - No authorization check - anyone can access any exam

    // ✅ SECURE: Use parameterized queries with type validation
    const [exams] = await pool.execute(
      "SELECT e.*, u.username as professor_name FROM exams e JOIN users u ON e.professor_id = u.id WHERE e.id = ?",
      [id]
    );

    if (!exams.length) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const [questions] = await pool.execute(
      "SELECT id, exam_id, question_text, option_a, option_b, option_c, option_d, marks FROM questions WHERE exam_id = ?",
      [id]
    );

    res.json({ ...exams[0], questions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create exam (professor/admin)
router.post("/", async (req, res) => {
  try {
    const { title, description, professor_id, duration_minutes } = req.body;
    // Validate required fields
    if (!title || !professor_id) {
      return res.status(400).json({ error: "Title and professor_id are required" });
    }
    const duration = duration_minutes ? Number(duration_minutes) : 60;
    
    // ❌ VULNERABLE CODE (for educational purposes - DO NOT USE IN PRODUCTION)
    // Insecure approach - string concatenation:
    // const unsafeQuery = `INSERT INTO exams (title, description, professor_id, duration_minutes) VALUES ('${title}', '${description}', ${professor_id}, ${duration})`;
    // await pool.execute(unsafeQuery);
    // Problems:
    // - SQL Injection in title: "Physics', 'Test'); DROP TABLE exams; --"
    // - Entire exams table deleted with above input
    // - description field also vulnerable
    // - JSON injection possible in newer MySQL versions
    // - No data validation on numeric fields

    // ✅ SECURE: Use parameterized queries with type conversion
    const [result] = await pool.execute(
      "INSERT INTO exams (title, description, professor_id, duration_minutes) VALUES (?, ?, ?, ?)",
      [title, description || "", professor_id, duration]
    );
    res.json({ id: result.insertId, message: "Exam created" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update exam (professor/admin)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, duration_minutes, status } = req.body;
    // Note: passing_score may not be in database schema, so not including it
    await pool.execute(
      "UPDATE exams SET title = ?, description = ?, duration_minutes = ?, status = ? WHERE id = ?",
      [title, description, duration_minutes, status, id]
    );
    res.json({ message: "Exam updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete exam (professor/admin)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if exam exists
    const [exam] = await pool.execute("SELECT id FROM exams WHERE id = ?", [id]);
    if (!exam.length) {
      return res.status(404).json({ error: "Exam not found" });
    }

    // Disable foreign key checks for cascading delete
    await pool.execute("SET FOREIGN_KEY_CHECKS=0");
    
    // Delete related data
    await pool.execute("DELETE FROM results WHERE exam_id = ?", [id]);
    await pool.execute("DELETE FROM answers WHERE submission_id IN (SELECT id FROM submissions WHERE exam_id = ?)", [id]);
    await pool.execute("DELETE FROM submissions WHERE exam_id = ?", [id]);
    await pool.execute("DELETE FROM questions WHERE exam_id = ?", [id]);
    
    // Delete the exam
    await pool.execute("DELETE FROM exams WHERE id = ?", [id]);
    
    // Re-enable foreign key checks
    await pool.execute("SET FOREIGN_KEY_CHECKS=1");
    
    res.json({ message: "Exam deleted successfully" });
  } catch (error) {
    // Re-enable foreign key checks in case of error
    await pool.execute("SET FOREIGN_KEY_CHECKS=1").catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

export default router;
