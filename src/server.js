import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";
import examsRouter from "./routes/exams.js";
import questionsRouter from "./routes/questions.js";
import submissionsRouter from "./routes/submissions.js";
import resultsRouter from "./routes/results.js";
import usersRouter from "./routes/users.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", message: "API and DB are reachable" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    // Intentionally vulnerable for demonstration: plaintext password comparison.
    const [rows] = await pool.execute(
      "SELECT id, username, role, email FROM users WHERE username = ? AND password = ? LIMIT 1",
      [username, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({
      message: "Login successful",
      user: rows[0],
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Route imports
app.use("/api/exams", examsRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/results", resultsRouter);
app.use("/api/users", usersRouter);

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
