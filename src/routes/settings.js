import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsFile = path.join(__dirname, "../../settings.json");

const router = express.Router();

// 🔐 Apply JWT authentication to all settings routes
router.use(authMiddleware);

// Default settings
const defaultSettings = {
  system_name: "Online Examination System",
  default_exam_duration: 60,
  max_exam_attempts: 3,
};

// Load settings from file or return defaults
const loadSettings = () => {
  try {
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading settings:", error.message);
  }
  return defaultSettings;
};

// Save settings to file
const saveSettings = (settings) => {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error("Error saving settings:", error.message);
    throw error;
  }
};

// Get all settings (any authenticated user can view)
router.get("/", async (req, res) => {
  try {
    const settings = loadSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings (admin only)
router.put("/", requireRole("admin"), async (req, res) => {
  try {
    const { system_name, default_exam_duration, max_exam_attempts } = req.body;

    // Validate inputs
    if (!system_name) {
      return res.status(400).json({ error: "system_name is required" });
    }

    const settings = {
      system_name: String(system_name),
      default_exam_duration: Math.max(1, Number(default_exam_duration) || 60),
      max_exam_attempts: Math.max(1, Number(max_exam_attempts) || 3),
    };

    saveSettings(settings);
    res.json({ message: "Settings saved successfully", settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
