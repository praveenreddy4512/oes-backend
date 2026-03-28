import express from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = express.Router();

// ✅ SECURITY: All routes require authentication
router.use(authMiddleware);

// ===== ADMIN ROUTES =====

// Get all groups (admin only)
router.get("/", requireRole(['admin']), async (req, res) => {
  try {
    const [groups] = await pool.execute(
      "SELECT g.*, u.username as created_by_name FROM groups g JOIN users u ON g.created_by = u.id ORDER BY g.created_at DESC"
    );
    
    // Get member count for each group
    const groupsWithMembers = await Promise.all(
      groups.map(async (group) => {
        const [members] = await pool.execute(
          "SELECT COUNT(*) as member_count FROM group_members WHERE group_id = ?",
          [group.id]
        );
        return { ...group, member_count: members[0].member_count };
      })
    );
    
    res.json(groupsWithMembers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create group (admin only)
router.post("/", requireRole(['admin']), async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required" });
    }
    
    const [result] = await pool.execute(
      "INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)",
      [name.trim(), description || "", req.user.id]
    );
    
    res.json({ id: result.insertId, message: "Group created successfully" });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: "Group name already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update group (admin only)
router.put("/:id", requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required" });
    }
    
    await pool.execute(
      "UPDATE groups SET name = ?, description = ? WHERE id = ?",
      [name.trim(), description || "", id]
    );
    
    res.json({ message: "Group updated successfully" });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: "Group name already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete group (admin only)
router.delete("/:id", requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute("DELETE FROM groups WHERE id = ?", [id]);
    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GROUP MEMBERS MANAGEMENT =====

// Get group members (admin only)
router.get("/:groupId/members", requireRole(['admin']), async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const [members] = await pool.execute(
      "SELECT u.id, u.username, u.email, gm.added_at FROM group_members gm JOIN users u ON gm.student_id = u.id WHERE gm.group_id = ? AND u.role = 'student' ORDER BY gm.added_at DESC",
      [groupId]
    );
    
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add member to group (admin only)
router.post("/:groupId/members", requireRole(['admin']), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { studentIds } = req.body; // Array of student IDs
    
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: "studentIds array is required" });
    }
    
    const results = { added: 0, failed: 0, errors: [] };
    
    for (const studentId of studentIds) {
      try {
        // Verify student exists and has role 'student'
        const [student] = await pool.execute(
          "SELECT id FROM users WHERE id = ? AND role = 'student'",
          [studentId]
        );
        
        if (student.length === 0) {
          results.failed++;
          results.errors.push(`Student ID ${studentId} not found`);
          continue;
        }
        
        // Add to group (ignore if already exists)
        await pool.execute(
          "INSERT IGNORE INTO group_members (group_id, student_id, added_by) VALUES (?, ?, ?)",
          [groupId, studentId, req.user.id]
        );
        
        results.added++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Error adding student ${studentId}: ${err.message}`);
      }
    }
    
    res.json({ message: "Members added to group", ...results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove member from group (admin only)
router.delete("/:groupId/members/:studentId", requireRole(['admin']), async (req, res) => {
  try {
    const { groupId, studentId } = req.params;
    
    await pool.execute(
      "DELETE FROM group_members WHERE group_id = ? AND student_id = ?",
      [groupId, studentId]
    );
    
    res.json({ message: "Member removed from group" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PROFESSOR ROUTES =====

// Get all groups (for professor to assign exams) - professors can see all groups
router.get("/for-exams/list", async (req, res) => {
  try {
    // Anyone authenticated can see groups for selection
    const [groups] = await pool.execute(
      "SELECT id, name, description, (SELECT COUNT(*) FROM group_members WHERE group_id = groups.id) as member_count FROM groups ORDER BY name"
    );
    
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== STUDENT ROUTES =====

// Get student's groups
router.get("/student/my-groups", async (req, res) => {
  try {
    const [groups] = await pool.execute(
      "SELECT DISTINCT g.id, g.name, g.description FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.student_id = ? ORDER BY g.name",
      [req.user.id]
    );
    
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
