import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import * as argon2 from "argon2";
import { pool } from "./db.js";
import examsRouter from "./routes/exams.js";
import questionsRouter from "./routes/questions.js";
import submissionsRouter from "./routes/submissions.js";
import resultsRouter from "./routes/results.js";
import usersRouter from "./routes/users.js";
import settingsRouter from "./routes/settings.js";

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

  // ✅ SECURE: Validate both username and password
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  // ✅ SECURE: Input validation - prevent SQL injection
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: "Invalid input format" });
  }

  // ✅ SECURE: Length validation
  if (username.length > 50 || password.length > 255) {
    return res.status(400).json({ message: "Username or password too long" });
  }

  try {
    // ✅ SECURE: Use parameterized queries with Argon2 password hashing
    // Fetch user including their hashed password
    const [rows] = await pool.execute(
      "SELECT id, username, role, email, password FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    console.log("[✅ ARGON2] Login attempt for user:", username);

    if (rows.length === 0) {
      // Prevent timing attacks by always hashing even if user not found
      await argon2.verify("$argon2id$v=19$m=19456$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA", password).catch(() => {});
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    // ✅ SECURE: Verify password using Argon2
    const passwordMatch = await argon2.verify(user.password, password);

    if (!passwordMatch) {
      console.log("[🔒] Invalid password for user:", username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("[✅ LOGIN SUCCESS] User authenticated:", username);

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      },
    });
  } catch (error) {
    console.error("[ERROR]", error.message);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Route imports
app.use("/api/exams", examsRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/results", resultsRouter);
app.use("/api/users", usersRouter);
app.use("/api/settings", settingsRouter);

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});

