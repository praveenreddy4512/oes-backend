import express from "express";
import { pool } from "../db.js";
import { authMiddleware, preventIDOR, getStudentSubmissionUser } from "../middleware/auth.js";
import { sendSubmissionSuccessEmail } from "../services/emailService.js";

const router = express.Router();

// 🔐 SECURITY: Apply JWT authentication only to submission routes (not exam-events)
// Individual routes apply auth as needed

// Get all submissions with related exam and student details
router.get("/", authMiddleware, async (req, res) => {
  try {
    const [submissions] = await pool.execute(
      `SELECT s.*, u.username as student_name, u.email as student_email, 
              e.title as exam_title, e.professor_id, 
              COUNT(a.id) as total_answers,
              SUM(IF(a.is_correct, 1, 0)) as correct_answers
       FROM submissions s
       JOIN users u ON s.student_id = u.id
       JOIN exams e ON s.exam_id = e.id
       LEFT JOIN answers a ON s.id = a.submission_id
       GROUP BY s.id
       ORDER BY s.submitted_at DESC`
    );
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start exam (create submission)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { exam_id, student_id } = req.body;

    // ❌ VULNERABLE CODE (for educational purposes - DO NOT USE IN PRODUCTION)
    // Insecure approach - string concatenation:
    // const unsafeCheckQuery = `SELECT id FROM submissions WHERE exam_id = ${exam_id} AND student_id = ${student_id}`;
    // const [existing] = await pool.execute(unsafeCheckQuery);
    // Problems:
    // - SQL Injection: student_id = "1 OR 1=1" bypasses the duplicate check
    // - Allows multiple submissions for same exam
    // - exam_id = "1 UNION SELECT ..." could inject additional queries
    // - No input validation on numeric parameters

    // ✅ SECURE: Use parameterized queries to prevent SQL injection
    const [existing] = await pool.execute(
      "SELECT id, is_submitted FROM submissions WHERE exam_id = ? AND student_id = ?",
      [exam_id, student_id]
    );

    if (existing.length > 0) {
      const submission = existing[0];
      // If student has already finalized the submission, block it
      if (submission.is_submitted) {
        return res.status(400).json({ error: "Exam already submitted by this student" });
      }
      // If student has an active session, return that submission_id (allows takeover/resume)
      return res.json({
        submission_id: submission.id,
        message: "Resuming existing session",
        isResumed: true
      });
    }

    // 🌐 IP Based Access Control
    const [examData] = await pool.execute(
      "SELECT is_ip_restricted, restricted_ip FROM exams WHERE id = ?",
      [exam_id]
    );

    if (examData.length > 0) {
      const exam = examData[0];
      if (exam.is_ip_restricted && exam.restricted_ip) {
        // Get client IP handling potential proxies
        let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

        // Normalize IPv6 mapped IPv4 addresses
        if (clientIp.startsWith('::ffff:')) {
          clientIp = clientIp.split(':').pop();
        }

        const allowedIps = exam.restricted_ip.split(',').map(ip => ip.trim());

        if (!allowedIps.includes(clientIp)) {
          console.warn(`[🚫 IP MISMATCH] Student ${student_id} tried to start exam ${exam_id} from ${clientIp}. Allowed: ${exam.restricted_ip}`);
          return res.status(403).json({
            error: "IP Mismatch Detected",
            message: "You are not authorized to start this exam from your current network location."
          });
        }
      }
    }

    // ❌ VULNERABLE CODE (for educational purposes - DO NOT USE IN PRODUCTION)
    // Insecure INSERT:
    // const unsafeInsertQuery = `INSERT INTO submissions (exam_id, student_id) VALUES (${exam_id}, ${student_id})`;
    // Problems:
    // - exam_id/student_id could reference non-existent IDs
    // - Foreign key constraints bypassed with improper validation
    // - Allows cross-student submissions if not validated on backend

    // ✅ SECURE: Validate and use parameterized queries
    const [result] = await pool.execute(
      "INSERT INTO submissions (exam_id, student_id) VALUES (?, ?)",
      [exam_id, student_id]
    );

    res.json({ submission_id: result.insertId, message: "Submission started" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get submission details
// 🔐 SECURITY: Prevent IDOR - users can only get their own submissions (students)
// Professors and admins can access any submission
router.get("/:id", authMiddleware,
  async (req, res, next) => {
    // Check if user is student - apply IDOR protection
    if (req.user.role === "student") {
      return preventIDOR("id", async (submissionId) => {
        return await getStudentSubmissionUser(submissionId, pool);
      })(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      const [submissions] = await pool.execute(
        "SELECT * FROM submissions WHERE id = ?",
        [id]
      );

      if (!submissions.length) {
        return res.status(404).json({ error: "Submission not found" });
      }

      const [answers] = await pool.execute(
        "SELECT a.*, q.question_text, q.correct_option FROM answers a JOIN questions q ON a.question_id = q.id WHERE a.submission_id = ?",
        [id]
      );

      res.json({ ...submissions[0], answers });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Submit answer
router.post("/:submission_id/answer", authMiddleware, async (req, res) => {
  try {
    const { submission_id } = req.params;
    const { question_id, selected_option } = req.body;

    // Get correct answer
    const [questions] = await pool.execute(
      "SELECT correct_option FROM questions WHERE id = ?",
      [question_id]
    );

    if (!questions.length) {
      return res.status(404).json({ error: "Question not found" });
    }

    // ✅ FIX: Case-insensitive comparison (student sends lowercase, DB might have uppercase)
    const is_correct = (selected_option || "").toLowerCase() === (questions[0].correct_option || "").toLowerCase();

    const [result] = await pool.execute(
      "INSERT INTO answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE selected_option = ?, is_correct = ?",
      [submission_id, question_id, selected_option, is_correct, selected_option, is_correct]
    );

    res.json({ message: "Answer recorded", is_correct });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit exam (finish taking exam)
router.post("/:submission_id/submit", authMiddleware, async (req, res) => {
  try {
    const { submission_id } = req.params;

    // Get submission details
    const [submissions] = await pool.execute(
      "SELECT * FROM submissions WHERE id = ?",
      [submission_id]
    );

    if (!submissions.length) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const submission = submissions[0];

    // Get exam and student details
    const [exams] = await pool.execute(
      "SELECT title FROM exams WHERE id = ?",
      [submission.exam_id]
    );

    const [students] = await pool.execute(
      "SELECT username, email FROM users WHERE id = ?",
      [submission.student_id]
    );

    if (!students.length) {
      return res.status(404).json({ error: "Student not found" });
    }

    const student = students[0];
    const exam = exams.length > 0 ? exams[0] : null;

    // Calculate score
    const [answers] = await pool.execute(
      "SELECT COUNT(*) as total, SUM(IF(is_correct, 1, 0)) as correct FROM answers WHERE submission_id = ?",
      [submission_id]
    );

    const totalQuestions = answers[0].total;
    const correctAnswers = answers[0].correct || 0;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100 * 100) / 100; // Round to 2 decimals

    // Mark status as completed (no pass/fail criteria)
    const status = "completed";

    console.log(`[GRADING] Exam ID: ${submission.exam_id}, Student: ${submission.student_id}, Score: ${correctAnswers}/${totalQuestions}, Percentage: ${percentage}%`);

    // Mark submission as complete
    try {
      await pool.execute(
        "UPDATE submissions SET is_submitted = TRUE, completed_at = NOW() WHERE id = ?",
        [submission_id]
      );
    } catch (updateErr) {
      // If completed_at column doesn't exist, try without it
      if (updateErr.message.includes("completed_at")) {
        await pool.execute(
          "UPDATE submissions SET is_submitted = TRUE WHERE id = ?",
          [submission_id]
        );
      } else {
        throw updateErr;
      }
    }

    // Create result record
    await pool.execute(
      "INSERT INTO results (submission_id, exam_id, student_id, total_marks, obtained_marks, percentage, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [submission_id, submission.exam_id, submission.student_id, totalQuestions, correctAnswers, percentage, status]
    );

    // ✅ Send submission success email to student (non-blocking)
    if (student.email && exam) {
      sendSubmissionSuccessEmail(
        student.email,
        student.username,
        exam.title,
        correctAnswers,
        totalQuestions,
        percentage
      ).catch(err => {
        console.error(`[⚠️ EMAIL] Failed to send success email to ${student.email}:`, err.message);
      });
    }

    res.json({
      message: "Exam submitted",
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      percentage: percentage.toFixed(2),
      status: status,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
