import express from "express";
import * as argon2 from "argon2";
import { pool } from "../db.js";

const router = express.Router();

// Get all users (admin only)
router.get("/", async (req, res) => {
  try {
    const [users] = await pool.execute(
      "SELECT id, username, role, email, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [users] = await pool.execute(
      "SELECT id, username, role, email, created_at FROM users WHERE id = ?",
      [id]
    );

    if (!users.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user (admin)
router.post("/", async (req, res) => {
  try {
    const { username, password, role, email } = req.body;

    // Validate required fields
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Username, password, and role are required" });
    }

    if (!["student", "professor", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // ✅ SECURE: Hash password using Argon2 before storing
    const hashedPassword = await argon2.hash(password);

    const [result] = await pool.execute(
      "INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)",
      [username, hashedPassword, role, email]
    );

    console.log(`[✅ ARGON2] New user created: ${username} with hashed password`);

    res.json({ id: result.insertId, message: "User created successfully" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(400).json({ error: "Username already exists" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Update user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, email } = req.body;

    if (role && !["student", "professor", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    let query = "UPDATE users SET";
    const updates = [];
    const values = [];

    if (username !== undefined) {
      updates.push(" username = ?");
      values.push(username);
    }
    if (password !== undefined) {
      // ✅ SECURE: Hash password using Argon2 before storing
      const hashedPassword = await argon2.hash(password);
      updates.push(" password = ?");
      values.push(hashedPassword);
      console.log(`[✅ ARGON2] Password updated for user ID: ${id} with hashed password`);
    }
    if (role !== undefined) {
      updates.push(" role = ?");
      values.push(role);
    }
    if (email !== undefined) {
      updates.push(" email = ?");
      values.push(email);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    query += updates.join(",") + " WHERE id = ?";
    values.push(id);

    await pool.execute(query, values);
    res.json({ message: "User updated successfully" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(400).json({ error: "Username already exists" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete user (admin)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const [user] = await pool.execute("SELECT id FROM users WHERE id = ?", [id]);
    if (!user.length) {
      return res.status(404).json({ error: "User not found" });
    }

    // Disable foreign key checks for cascading delete
    await pool.execute("SET FOREIGN_KEY_CHECKS=0");
    
    // Delete user's related data (exams as professor)
    const [exams] = await pool.execute("SELECT id FROM exams WHERE professor_id = ?", [id]);
    for (const exam of exams) {
      await pool.execute("DELETE FROM results WHERE exam_id = ?", [exam.id]);
      await pool.execute("DELETE FROM answers WHERE submission_id IN (SELECT id FROM submissions WHERE exam_id = ?)", [exam.id]);
      await pool.execute("DELETE FROM submissions WHERE exam_id = ?", [exam.id]);
      await pool.execute("DELETE FROM questions WHERE exam_id = ?", [exam.id]);
    }
    await pool.execute("DELETE FROM exams WHERE professor_id = ?", [id]);
    
    // Delete user's submissions and related data
    await pool.execute("DELETE FROM results WHERE student_id = ?", [id]);
    await pool.execute("DELETE FROM answers WHERE submission_id IN (SELECT id FROM submissions WHERE student_id = ?)", [id]);
    await pool.execute("DELETE FROM submissions WHERE student_id = ?", [id]);
    
    // Delete the user
    await pool.execute("DELETE FROM users WHERE id = ?", [id]);
    
    // Re-enable foreign key checks
    await pool.execute("SET FOREIGN_KEY_CHECKS=1");
    
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    // Re-enable foreign key checks in case of error
    await pool.execute("SET FOREIGN_KEY_CHECKS=1").catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

export default router;
