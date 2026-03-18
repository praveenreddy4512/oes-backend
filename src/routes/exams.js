import express from "express";
import { pool } from "../db.js";

const router = express.Router();

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
    const { title, description, professor_id, duration_minutes, passing_score } = req.body;
    const [result] = await pool.execute(
      "INSERT INTO exams (title, description, professor_id, duration_minutes, passing_score) VALUES (?, ?, ?, ?, ?)",
      [title, description, professor_id, duration_minutes, passing_score]
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
    const { title, description, duration_minutes, passing_score, status } = req.body;
    await pool.execute(
      "UPDATE exams SET title = ?, description = ?, duration_minutes = ?, passing_score = ?, status = ? WHERE id = ?",
      [title, description, duration_minutes, passing_score, status, id]
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
    await pool.execute("DELETE FROM exams WHERE id = ?", [id]);
    res.json({ message: "Exam deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
