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
    // ❌ VULNERABLE CODE (for educational security testing - DO NOT USE IN PRODUCTION)
    // This demonstrates SQL injection vulnerability:
    // const unsafeQuery = `SELECT id, username, role, email, password FROM users WHERE username = '${username}' AND password = '${password}' LIMIT 1`;
    // Attack examples:
    // - admin' OR '1'='1
    // - student1' --
    // - ' OR '1'='1' --
    // These work because user input is concatenated directly into SQL, allowing attackers to modify query logic

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

    // ❌ VULNERABLE CODE (for educational purposes - DO NOT USE IN PRODUCTION)
    // Old insecure approach - plaintext password comparison:
    // if (user.password !== password) {
    //   return res.status(401).json({ message: "Invalid credentials" });
    // }
    // Problems:
    // - Passwords stored as plaintext in database
    // - If database is breached, all passwords compromised
    // - No protection against brute-force attacks
    // - No salting, so identical passwords have identical hashes

    // ✅ SECURE: Verify password using Argon2
    // Argon2 provides:
    // - Memory-hard hashing (resistant to GPU attacks)
    // - Automatic salting (each password different hash)
    // - Time-cost iterations (slows brute-force attempts)
    // - Constant-time comparison (prevents timing attacks)
    
    // MIGRATION STRATEGY: Handle both plaintext (old) and hashed (new) passwords
    let passwordMatch = false;
    let needsRehash = false;

    if (user.password.startsWith("$argon2")) {
      // Password is already hashed - verify directly
      passwordMatch = await argon2.verify(user.password, password);
      console.log("[✅ ARGON2] Verified hashed password for:", username);
    } else {
      // Password is plaintext (migration from old system) - compare and mark for rehash
      passwordMatch = user.password === password;
      if (passwordMatch) {
        needsRehash = true;
        console.log("[⚠️  MIGRATION] Plaintext password detected for:", username, "- will rehash");
      }
    }

    if (!passwordMatch) {
      console.log("[🔒] Invalid password for user:", username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // If password was plaintext, hash and update it in the database
    if (needsRehash) {
      try {
        const hashedPassword = await argon2.hash(password);
        await pool.execute(
          "UPDATE users SET password = ? WHERE id = ?",
          [hashedPassword, user.id]
        );
        console.log("[✅ MIGRATION COMPLETE] Password hashed and stored for:", username);
      } catch (hashError) {
        console.error("[❌ MIGRATION ERROR] Failed to hash password for:", username, hashError.message);
        // Continue login even if rehash fails - don't break user experience
      }
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

