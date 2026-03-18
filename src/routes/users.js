import express from "express";
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

    if (!["student", "professor", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const [result] = await pool.execute(
      "INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)",
      [username, password, role, email]
    );

    res.json({ id: result.insertId, message: "User created" });
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
      updates.push(" password = ?");
      values.push(password);
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
    res.json({ message: "User updated" });
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
    await pool.execute("DELETE FROM users WHERE id = ?", [id]);
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
