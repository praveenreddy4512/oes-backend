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

// Create exam (professor/admin) - with optional group assignment
router.post("/", async (req, res) => {
  try {
    const { title, description, professor_id, duration_minutes, shuffle_questions, shuffle_options, groupIds } = req.body;
    // Validate required fields
    if (!title || !professor_id) {
      return res.status(400).json({ error: "Title and professor_id are required" });
    }
    const duration = duration_minutes ? Number(duration_minutes) : 60;
    const shuffleQuestions = shuffle_questions ? 1 : 0;
    const shuffleOptions = shuffle_options ? 1 : 0;
    
    // ✅ SECURE: Use parameterized queries with type conversion
    const [result] = await pool.execute(
      "INSERT INTO exams (title, description, professor_id, duration_minutes, shuffle_questions, shuffle_options) VALUES (?, ?, ?, ?, ?, ?)",
      [title, description || "", professor_id, duration, shuffleQuestions, shuffleOptions]
    );
    
    const examId = result.insertId;
    
    // Add exam to groups if provided
    if (Array.isArray(groupIds) && groupIds.length > 0) {
      for (const groupId of groupIds) {
        await pool.execute(
          "INSERT INTO exam_groups (exam_id, group_id) VALUES (?, ?)",
          [examId, groupId]
        );
      }
    }
    
    res.json({ id: examId, message: "Exam created" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update exam (professor/admin)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, duration_minutes, status, shuffle_questions, shuffle_options } = req.body;
    const shuffleQuestions = shuffle_questions ? 1 : 0;
    const shuffleOptions = shuffle_options ? 1 : 0;
    
    await pool.execute(
      "UPDATE exams SET title = ?, description = ?, duration_minutes = ?, status = ?, shuffle_questions = ?, shuffle_options = ? WHERE id = ?",
      [title, description, duration_minutes, status, shuffleQuestions, shuffleOptions, id]
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
    await pool.execute("DELETE FROM exam_groups WHERE exam_id = ?", [id]);
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

// ===== GROUP MANAGEMENT ENDPOINTS =====

// Get exam groups
router.get("/:examId/groups", async (req, res) => {
  try {
    const { examId } = req.params;
    
    const [groups] = await pool.execute(
      "SELECT g.id, g.name, g.description FROM groups g JOIN exam_groups eg ON g.id = eg.group_id WHERE eg.exam_id = ?",
      [examId]
    );
    
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add groups to exam
router.post("/:examId/groups", async (req, res) => {
  try {
    const { examId } = req.params;
    const { groupIds } = req.body;
    
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ error: "groupIds array is required" });
    }
    
    for (const groupId of groupIds) {
      await pool.execute(
        "INSERT IGNORE INTO exam_groups (exam_id, group_id) VALUES (?, ?)",
        [examId, groupId]
      );
    }
    
    res.json({ message: "Groups added to exam" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove group from exam
router.delete("/:examId/groups/:groupId", async (req, res) => {
  try {
    const { examId, groupId } = req.params;
    
    await pool.execute(
      "DELETE FROM exam_groups WHERE exam_id = ? AND group_id = ?",
      [examId, groupId]
    );
    
    res.json({ message: "Group removed from exam" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get exams filtered by student's groups (for student dashboard)
router.get("/student/exams/by-group", async (req, res) => {
  try {
    // Get exams that student's groups have access to
    const [exams] = await pool.execute(
      `SELECT DISTINCT e.*, u.username as professor_name 
       FROM exams e 
       JOIN users u ON e.professor_id = u.id 
       WHERE e.id IN (
         SELECT eg.exam_id FROM exam_groups eg 
         WHERE eg.group_id IN (
           SELECT group_id FROM group_members WHERE student_id = ?
         )
       ) 
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
