import express from "express";
import { pool } from "../db.js";
import { authMiddleware, preventIDOR } from "../middleware/auth.js";

const router = express.Router();

/**
 * Helper function to get the professor_id for an exam
 * Used by preventIDOR middleware for exam results access
 */
async function getExamProfessor(examId) {
  try {
    const [rows] = await pool.execute(
      "SELECT professor_id FROM exams WHERE id = ?",
      [examId]
    );
    return rows.length ? rows[0].professor_id : null;
  } catch (err) {
    console.error(`Error getting exam professor: ${err.message}`);
    return null;
  }
}

async function getResultStudent(resultId) {
  try {
    const [rows] = await pool.execute(
      "SELECT student_id FROM results WHERE id = ?",
      [resultId]
    );
    return rows.length ? rows[0].student_id : null;
  } catch (err) {
    console.error(`Error getting result student: ${err.message}`);
    return null;
  }
}

// 🔐 SECURITY: Protect results routes with JWT authentication
router.use(authMiddleware);

// ⚠️ IMPORTANT: Route ordering matters - more specific routes first!

// Get statistics for admin
// 🔐 SECURITY: Admin-only access to global statistics
router.get("/", 
  (req, res, next) => {
    // Only admins can view global statistics
    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Access denied. Only administrators can view global statistics.",
      });
    }
    next();
  },
  async (req, res) => {
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
  }
);

// Middleware to check student results ownership
const studentResultsOwnershipMiddleware = async (req, res, next) => {
  try {
    const { student_id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins and professors can view results for any student
    if (userRole === "admin" || userRole === "professor") {
      return next();
    }

    // Students can only view their own results
    if (userRole === "student") {
      if (parseInt(student_id) === parseInt(userId)) {
        return next();
      }
      console.warn(
        `[SECURITY] IDOR ATTEMPT BLOCKED: Student ${userId} tried to access results for student ${student_id}`
      );
      return res.status(403).json({
        error: "Access denied. You can only view your own results.",
      });
    }

    return res.status(403).json({ error: "Access denied" });
  } catch (error) {
    console.error(`[ERROR] Student results ownership check failed: ${error.message}`);
    res.status(500).json({ error: "Access control check failed" });
  }
};

// Get results for a student (more specific - check 'student' keyword)
// 🔐 SECURITY: IDOR protection - students can only view own results, professors/admins can view any
router.get("/student/:student_id", studentResultsOwnershipMiddleware, async (req, res) => {
  try {
    const { student_id } = req.params;
    
    // ✅ SECURE: Parameterized queries + ownership middleware
    const [results] = await pool.execute(
      "SELECT r.*, e.title as exam_title FROM results r JOIN exams e ON r.exam_id = e.id WHERE r.student_id = ? ORDER BY r.created_at DESC",
      [student_id]
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware to check exam ownership for professors
const examOwnershipMiddleware = async (req, res, next) => {
  try {
    const { exam_id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins can view results for any exam
    if (userRole === "admin") {
      return next();
    }

    // Professors can only view results for their own exams
    if (userRole === "professor") {
      const professorId = await getExamProfessor(exam_id);
      if (parseInt(professorId) === parseInt(userId)) {
        return next();
      }
      console.warn(
        `[SECURITY] IDOR ATTEMPT BLOCKED: Professor ${userId} tried to access results for exam ${exam_id} owned by professor ${professorId}`
      );
      return res.status(403).json({
        error: "Access denied. Professors can only view results for their own exams.",
      });
    }

    // Students cannot view exam results
    console.warn(
      `[SECURITY] UNAUTHORIZED ACCESS: Student ${userId} tried to access exam results for exam ${exam_id}`
    );
    return res.status(403).json({
      error: "Access denied. Students cannot view exam statistics.",
    });
  } catch (error) {
    console.error(`[ERROR] Exam ownership check failed: ${error.message}`);
    res.status(500).json({ error: "Access control check failed" });
  }
};

// Get results for exam (more specific - check 'exam' keyword)
// 🔐 SECURITY: Only exam professor or admins can view exam results
router.get("/exam/:exam_id", examOwnershipMiddleware, async (req, res) => {
  try {
    const { exam_id } = req.params;
    
    // ✅ SECURE: Parameterized queries + ownership middleware
    const [results] = await pool.execute(
      "SELECT r.*, u.username, u.email FROM results r JOIN users u ON r.student_id = u.id WHERE r.exam_id = ? ORDER BY r.created_at DESC",
      [exam_id]
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware to check result ownership
const resultOwnershipMiddleware = async (req, res, next) => {
  try {
    const { result_id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins can view any result
    if (userRole === "admin") {
      return next();
    }

    // Get result and exam info
    const [resultRows] = await pool.execute(
      "SELECT r.student_id, r.exam_id FROM results r WHERE r.id = ?",
      [result_id]
    );

    if (!resultRows.length) {
      return res.status(404).json({ error: "Result not found" });
    }

    const { student_id, exam_id } = resultRows[0];

    // Students can only view their own results
    if (userRole === "student") {
      if (parseInt(student_id) === parseInt(userId)) {
        return next();
      }
      console.warn(
        `[SECURITY] IDOR ATTEMPT BLOCKED: Student ${userId} tried to access result ${result_id} owned by student ${student_id}`
      );
      return res.status(403).json({
        error: "Access denied. You can only view your own results.",
      });
    }

    // Professors can view results for their exams
    if (userRole === "professor") {
      const professorId = await getExamProfessor(exam_id);
      if (parseInt(professorId) === parseInt(userId)) {
        return next();
      }
      console.warn(
        `[SECURITY] IDOR ATTEMPT BLOCKED: Professor ${userId} tried to access result ${result_id} for exam ${exam_id} owned by professor ${professorId}`
      );
      return res.status(403).json({
        error: "Access denied. Professors can only view results for their own exams.",
      });
    }

    return res.status(403).json({ error: "Access denied" });
  } catch (error) {
    console.error(`[ERROR] Result ownership check failed: ${error.message}`);
    res.status(500).json({ error: "Access control check failed" });
  }
};

// Get single result details by ID (MUST be last - least specific)
// 🔐 SECURITY: IDOR protection - students view own, professors view their exam's, admins view any
router.get("/:result_id", resultOwnershipMiddleware, async (req, res) => {
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
