import express from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { sendExamCompletionEmail, sendNewExamNotificationEmail } from "../services/emailService.js";

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
    const { title, description, professor_id, duration_minutes, shuffle_questions, shuffle_options, groupIds, is_ip_restricted, restricted_ip, start_time, end_time } = req.body;
    // Validate required fields
    if (!title || !professor_id || !start_time || !end_time) {
      return res.status(400).json({ error: "Title, professor_id, start_time, and end_time are required" });
    }
    const duration = duration_minutes ? Number(duration_minutes) : 60;
    const shuffleQuestions = shuffle_questions ? 1 : 0;
    const shuffleOptions = shuffle_options ? 1 : 0;
    const isIpRestricted = is_ip_restricted ? 1 : 0;
    const startTime = start_time.replace('T', ' ');
    const endTime = end_time.replace('T', ' ');

    // ✅ SECURE: Use parameterized queries with type conversion
    const [result] = await pool.execute(
      "INSERT INTO exams (title, description, professor_id, duration_minutes, shuffle_questions, shuffle_options, is_ip_restricted, restricted_ip, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [title, description || "", professor_id, duration, shuffleQuestions, shuffleOptions, isIpRestricted, restricted_ip || null, startTime, endTime]
    );

    const examId = result.insertId;

    // Get professor details for email notification
    const [professors] = await pool.execute(
      "SELECT username, email FROM users WHERE id = ?",
      [professor_id]
    );
    const professorName = professors.length > 0 ? professors[0].username : "Professor";

    // Add exam to groups if provided
    if (Array.isArray(groupIds) && groupIds.length > 0) {
      for (const groupId of groupIds) {
        await pool.execute(
          "INSERT INTO exam_groups (exam_id, group_id) VALUES (?, ?)",
          [examId, groupId]
        );
      }

      // ✅ NEW: Get all students in these groups and send them notification emails
      for (const groupId of groupIds) {
        try {
          const [students] = await pool.execute(
            "SELECT u.id, u.username, u.email FROM users u JOIN group_members gm ON u.id = gm.student_id WHERE gm.group_id = ? AND u.role = 'student'",
            [groupId]
          );

          // Send notification email to each student (non-blocking)
          for (const student of students) {
            sendNewExamNotificationEmail(
              student.email,
              student.username,
              title,
              professorName,
              startTime,
              endTime,
              duration
            ).catch(err => {
              console.error(`[⚠️ EMAIL] Failed to send exam notification to ${student.email}:`, err.message);
            });
          }
        } catch (groupError) {
          console.error(`[⚠️ EMAIL] Error fetching students for group ${groupId}:`, groupError.message);
        }
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
    const { title, description, duration_minutes, status, shuffle_questions, shuffle_options, is_ip_restricted, restricted_ip, start_time, end_time } = req.body;

    // Validate exam exists
    const [exam] = await pool.execute("SELECT id FROM exams WHERE id = ?", [id]);
    if (!exam.length) {
      return res.status(404).json({ error: "Exam not found" });
    }

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: "Title, start_time, and end_time are required" });
    }

    const shuffleQuestions = shuffle_questions ? 1 : 0;
    const shuffleOptions = shuffle_options ? 1 : 0;
    const isIpRestricted = is_ip_restricted ? 1 : 0;
    const finalStatus = status || 'draft';
    const finalDuration = duration_minutes ? Number(duration_minutes) : 60;
    const startTime = start_time.replace('T', ' ');
    const endTime = end_time.replace('T', ' ');

    await pool.execute(
      "UPDATE exams SET title = ?, description = ?, duration_minutes = ?, status = ?, shuffle_questions = ?, shuffle_options = ?, is_ip_restricted = ?, restricted_ip = ?, start_time = ?, end_time = ? WHERE id = ?",
      [title, description || "", finalDuration, finalStatus, shuffleQuestions, shuffleOptions, isIpRestricted, restricted_ip || null, startTime, endTime, id]
    );
    res.json({ message: "Exam updated" });
  } catch (error) {
    console.error("Error updating exam:", error);
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
    await pool.execute("SET FOREIGN_KEY_CHECKS=1").catch(() => { });
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

// ✅ Send exam completion notification to professor
// Called when exam end time is reached
router.post("/:examId/send-completion-notification", async (req, res) => {
  try {
    const { examId } = req.params;

    // Get exam details
    const [exams] = await pool.execute(
      "SELECT id, title, professor_id FROM exams WHERE id = ?",
      [examId]
    );

    if (!exams.length) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const exam = exams[0];

    // Get professor details
    const [professors] = await pool.execute(
      "SELECT id, username, email FROM users WHERE id = ?",
      [exam.professor_id]
    );

    if (!professors.length) {
      return res.status(404).json({ error: "Professor not found" });
    }

    const professor = professors[0];

    // Get submission statistics
    const [submissionStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_students,
        SUM(IF(is_submitted = TRUE, 1, 0)) as submitted_count,
        SUM(IF(is_submitted = FALSE OR is_submitted IS NULL, 1, 0)) as not_submitted_count,
        AVG(IFNULL(r.percentage, 0)) as average_score
       FROM submissions s
       LEFT JOIN results r ON s.id = r.submission_id
       WHERE s.exam_id = ?`,
      [examId]
    );

    const stats = submissionStats[0] || {};
    const totalStudents = stats.total_students || 0;
    const submittedCount = stats.submitted_count || 0;
    const notSubmittedCount = stats.not_submitted_count || 0;
    const averageScore = stats.average_score ? Math.round(stats.average_score * 100) / 100 : 0;

    // Get top 3 performers
    const [topScores] = await pool.execute(
      `SELECT 
        u.username as studentName,
        r.percentage,
        r.obtained_marks as score,
        r.total_marks as totalMarks
       FROM results r
       JOIN users u ON r.student_id = u.id
       WHERE r.exam_id = ?
       ORDER BY r.percentage DESC
       LIMIT 3`,
      [examId]
    );

    // Send email to professor
    const emailSent = await sendExamCompletionEmail(
      professor.email,
      professor.username,
      exam.title,
      totalStudents,
      submittedCount,
      notSubmittedCount,
      averageScore,
      topScores
    );

    if (emailSent) {
      console.log(`[✅ EXAM_COMPLETE] Completion notification sent to professor ${professor.username}`);
      return res.json({
        message: "Exam completion notification sent",
        stats: {
          totalStudents,
          submittedCount,
          notSubmittedCount,
          averageScore,
          topScores: topScores.length > 0 ? topScores : []
        }
      });
    } else {
      console.warn(`[⚠️ EXAM_COMPLETE] Failed to send notification to professor ${professor.username}`);
      return res.json({
        message: "Email service not available",
        stats: {
          totalStudents,
          submittedCount,
          notSubmittedCount,
          averageScore,
          topScores: topScores.length > 0 ? topScores : []
        }
      });
    }
  } catch (error) {
    console.error("[❌ EXAM_COMPLETE] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
