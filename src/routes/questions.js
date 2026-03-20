import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Get questions (with optional exam_id query parameter)
router.get("/", async (req, res) => {
  try {
    const { exam_id } = req.query;
    if (!exam_id) {
      return res.status(400).json({ error: "exam_id query parameter required" });
    }
    const [questions] = await pool.execute(
      "SELECT id, exam_id, question_text, option_a, option_b, option_c, option_d, marks, correct_option FROM questions WHERE exam_id = ?",
      [exam_id]
    );
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get questions for exam (legacy endpoint)
router.get("/exam/:exam_id", async (req, res) => {
  try {
    const { exam_id } = req.params;
    const [questions] = await pool.execute(
      "SELECT id, exam_id, question_text, option_a, option_b, option_c, option_d, marks FROM questions WHERE exam_id = ?",
      [exam_id]
    );
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add question to exam
router.post("/", async (req, res) => {
  try {
    const { exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks } = req.body;
    const [result] = await pool.execute(
      "INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks || 1]
    );

    // Update exam total_questions
    await pool.execute(
      "UPDATE exams SET total_questions = (SELECT COUNT(*) FROM questions WHERE exam_id = ?) WHERE id = ?",
      [exam_id, exam_id]
    );

    res.json({ id: result.insertId, message: "Question added" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update question
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { question_text, option_a, option_b, option_c, option_d, correct_option, marks } = req.body;
    await pool.execute(
      "UPDATE questions SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, marks = ? WHERE id = ?",
      [question_text, option_a, option_b, option_c, option_d, correct_option, marks, id]
    );
    res.json({ message: "Question updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete question
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [question] = await pool.execute("SELECT exam_id FROM questions WHERE id = ?", [id]);
    
    await pool.execute("DELETE FROM questions WHERE id = ?", [id]);

    if (question.length > 0) {
      await pool.execute(
        "UPDATE exams SET total_questions = (SELECT COUNT(*) FROM questions WHERE exam_id = ?) WHERE id = ?",
        [question[0].exam_id, question[0].exam_id]
      );
    }

    res.json({ message: "Question deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
