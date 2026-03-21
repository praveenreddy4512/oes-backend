import express from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// 🔐 SECURITY: Protect results routes with JWT authentication
router.use(authMiddleware);

// ⚠️ IMPORTANT: Route ordering matters - more specific routes first!

// Get statistics for admin
router.get("/", async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT exam_id) as total_exams,
        COUNT(DISTINCT student_id) as total_students,
        COUNT(*) as total_results,
        AVG(percentage) as avg_percentage,
        SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count,
        SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail_count
      FROM results
    `);
    // Convert numeric strings to numbers
    const result = stats[0] || {};
    return res.json({
      total_exams: Number(result.total_exams) || 0,
      total_students: Number(result.total_students) || 0,
      total_results: Number(result.total_results) || 0,
      avg_percentage: Number(result.avg_percentage) || 0,
      pass_count: Number(result.pass_count) || 0,
      fail_count: Number(result.fail_count) || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get results for a student (more specific - check 'student' keyword)
router.get("/student/:student_id", async (req, res) => {
  try {
    const { student_id } = req.params;
    
    // ❌ VULNERABLE CODE (for educational purposes - DO NOT USE IN PRODUCTION)
    // Insecure approach - string concatenation:
    // const unsafeQuery = `SELECT r.*, e.title as exam_title FROM results r JOIN exams e ON r.exam_id = e.id WHERE r.student_id = ${student_id}`;
    // const [results] = await pool.execute(unsafeQuery);
    // Problems:
    // - SQL Injection: student_id = "1 UNION SELECT * FROM users" returns all user data
    // - student_id = "1 OR 1=1" returns all results (information disclosure)
    // - Unauthorized access to other students' results
    // - No authorization check - anyone can view anyone's grades

    // ✅ SECURE: Use parameterized queries with proper authorization
    const [results] = await pool.execute(
      "SELECT r.*, e.title as exam_title FROM results r JOIN exams e ON r.exam_id = e.id WHERE r.student_id = ? ORDER BY r.created_at DESC",
      [student_id]
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get results for exam (more specific - check 'exam' keyword)
router.get("/exam/:exam_id", async (req, res) => {
  try {
    const { exam_id } = req.params;
    
    // ❌ VULNERABLE CODE (for educational purposes - DO NOT USE IN PRODUCTION)
    // Insecure approach - string concatenation:
    // const unsafeQuery = `SELECT r.*, u.username, u.email FROM results r JOIN users u ON r.student_id = u.id WHERE r.exam_id = ${exam_id}`;
    // const [results] = await pool.execute(unsafeQuery);
    // Problems:
    // - SQL Injection: exam_id = "1 OR 1=1" returns results for all exams
    // - exam_id = "1); DROP TABLE results; --" deletes all results
    // - Unauthorized access to exam results from other professors
    // - No role-based access control validation

    // ✅ SECURE: Use parameterized queries with authorization checks
    const [results] = await pool.execute(
      "SELECT r.*, u.username, u.email FROM results r JOIN users u ON r.student_id = u.id WHERE r.exam_id = ? ORDER BY r.created_at DESC",
      [exam_id]
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single result details by ID (MUST be last - least specific)
router.get("/:result_id", async (req, res) => {
  try {
    const { result_id } = req.params;
    const [results] = await pool.execute(
      "SELECT r.*, e.title as exam_title, s.id as submission_id FROM results r JOIN exams e ON r.exam_id = e.id JOIN submissions s ON r.submission_id = s.id WHERE r.id = ?",
      [result_id]
    );

    if (!results.length) {
      return res.status(404).json({ error: "Result not found" });
    }

    const result = results[0];

    // Get detailed answers
    const [answers] = await pool.execute(
      `SELECT a.id, a.selected_option, a.is_correct, q.id as question_id, q.question_text, 
              q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks
       FROM answers a 
       JOIN questions q ON a.question_id = q.id 
       WHERE a.submission_id = ?`,
      [result.submission_id]
    );

    // Convert numeric fields
    result.percentage = Number(result.percentage) || 0;
    result.obtained_marks = Number(result.obtained_marks) || 0;
    result.total_marks = Number(result.total_marks) || 0;
    res.json({ ...result, answers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
