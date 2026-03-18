import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Get results for a student
router.get("/student/:student_id", async (req, res) => {
  try {
    const { student_id } = req.params;
    const [results] = await pool.execute(
      "SELECT r.*, e.title as exam_title FROM results r JOIN exams e ON r.exam_id = e.id WHERE r.student_id = ? ORDER BY r.created_at DESC",
      [student_id]
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get results for exam (professor view)
router.get("/exam/:exam_id", async (req, res) => {
  try {
    const { exam_id } = req.params;
    const [results] = await pool.execute(
      "SELECT r.*, u.username, u.email FROM results r JOIN users u ON r.student_id = u.id WHERE r.exam_id = ? ORDER BY r.created_at DESC",
      [exam_id]
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single result details
router.get("/:result_id", async (req, res) => {
  try {
    const { result_id } = req.params;
    const [results] = await pool.execute(
      "SELECT r.*, e.title, s.id as submission_id FROM results r JOIN exams e ON r.exam_id = e.id JOIN submissions s ON r.submission_id = s.id WHERE r.id = ?",
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

    res.json({ ...result, answers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    res.json(stats[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
