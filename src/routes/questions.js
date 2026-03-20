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
    
    // Validate required fields
    if (!exam_id) {
      return res.status(400).json({ error: "exam_id is required" });
    }
    if (!question_text) {
      return res.status(400).json({ error: "question_text is required" });
    }
    
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
    
    // Get question details to find exam_id
    const [question] = await pool.execute("SELECT exam_id FROM questions WHERE id = ?", [id]);
    
    if (question.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    const exam_id = question[0].exam_id;

    // Disable foreign key checks to handle cascade deletes
    await pool.execute("SET FOREIGN_KEY_CHECKS=0");
    
    // Delete answers associated with this question
    await pool.execute("DELETE FROM answers WHERE question_id = ?", [id]);
    
    // Delete the question
    await pool.execute("DELETE FROM questions WHERE id = ?", [id]);
    
    // Re-enable foreign key checks
    await pool.execute("SET FOREIGN_KEY_CHECKS=1");

    // Update exam total_questions count
    await pool.execute(
      "UPDATE exams SET total_questions = (SELECT COUNT(*) FROM questions WHERE exam_id = ?) WHERE id = ?",
      [exam_id, exam_id]
    );

    res.json({ message: "Question deleted" });
  } catch (error) {
    // Re-enable foreign key checks in case of error
    await pool.execute("SET FOREIGN_KEY_CHECKS=1").catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

export default router;
