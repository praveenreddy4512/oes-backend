import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import session from "express-session";
import FileStore from "session-file-store";
import crypto from "crypto";
import { pool } from "./db.js";
import { generateToken } from "./middleware/auth.js";
import { initializeEmailTransporter, sendPasswordResetEmail, sendPasswordChangedEmail } from "./services/emailService.js";
import examsRouter from "./routes/exams.js";
import questionsRouter from "./routes/questions.js";
import submissionsRouter from "./routes/submissions.js";
import examEventsRouter from "./routes/exam-events.js";
import resultsRouter from "./routes/results.js";
import usersRouter from "./routes/users.js";
import settingsRouter from "./routes/settings.js";
import groupsRouter from "./routes/groups.js";
// ✅ Migration already completed - exam_events table exists in MySQL
// Removed: import { createExamEventsTable } from "./migrations/001_create_exam_events_table.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);

// ✅ CRITICAL: Trust proxy headers from LiteSpeed/Nginx
// Required for secure cookies when behind a reverse proxy
app.set('trust proxy', 1);

// ✅ SECURE: Setup file-based session store for persistence
// Memory store doesn't persist sessions across server restarts or multiple processes
// FileStore saves sessions to disk, allowing sessions to survive process restarts
const fileStore = new (FileStore(session))({
  path: process.env.SESSION_PATH || "./sessions",  // Directory to store session files
  ttl: 24 * 60 * 60,  // 24 hours - matches cookie maxAge
  reapInterval: 60 * 60,  // Clean up expired sessions every hour
  fileExtension: ".json"
});

console.log("[✅ SESSION] File-based session store configured");

// ✅ SECURE: CORS configured to allow cookies/credentials
// Without credentials: true, browsers won't send or return cookies
// CRITICAL: origin MUST be a specific domain when using credentials: true
// Using "*" with credentials: true causes browser to block Set-Cookie headers
const allowedOrigin = process.env.FRONTEND_URL || "https://oes.frontend-drab.vercel.app";
console.log(`[✅ CORS] Allowing requests from: ${allowedOrigin}`);

app.use(cors({
  origin: allowedOrigin,  // ✅ Specific frontend domain (not "*")
  credentials: true,  // ✅ CRITICAL: Allow cookies to be sent/received
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
}));

app.use(express.json());

// ✅ SECURE: Express session middleware configuration
// Sessions store user authentication state server-side, preventing plaintext credentials in requests
// Using FileStore to persist sessions across server restarts
app.use(session({
  store: fileStore,  // ✅ CRITICAL: Use file-based store for persistence
  secret: process.env.SESSION_SECRET || "your-super-secret-key-change-in-production", // ⚠️ Change this!
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,  // ✅ Prevents JavaScript from accessing cookie (XSS protection)
    secure: process.env.NODE_ENV === "production",  // ✅ HTTPS only in production
    sameSite: "lax",  // ✅ CSRF protection - cookies not sent to cross-site requests
    maxAge: 1000 * 60 * 60 * 24  // 24 hours
  }
}));

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

    // 🔐 JWT: Generate JSON Web Token (HMAC-SHA256)
    const token = generateToken(user);
    console.log(`[🔐 JWT] Token generated for user: ${username}`);

    // ✅ SECURE: Store user data in session (server-side)
    // Session ID is stored in cookie, actual user data stays on server
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.email = user.email;

    console.log("[🔐 SESSION] Created session for user:", username, "Session ID:", req.sessionID);

    // ✅ CRITICAL: Save session and send Set-Cookie header
    // This MUST be called explicitly to ensure the Set-Cookie header is sent to the client
    req.session.save((err) => {
      if (err) {
        console.error("[❌ SESSION SAVE ERROR]", err.message);
        return res.status(500).json({ message: "Session error", error: err.message });
      }

      console.log("[✅ COOKIE] Set-Cookie header will be sent for session:", req.sessionID);

      return res.json({
        message: "Login successful",
        token: token,  // 🔐 JWT token for stateless authentication
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email
        },
        sessionCreated: true
      });
    });
  } catch (error) {
    console.error("[ERROR]", error.message);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ✅ SECURE: Logout endpoint - destroys session
app.post("/api/logout", (req, res) => {
  if (!req.session.userId) {
    return res.status(400).json({ message: "Not logged in" });
  }

  const username = req.session.username;
  req.session.destroy((err) => {
    if (err) {
      console.error("[ERROR] Session destruction failed:", err.message);
      return res.status(500).json({ message: "Logout failed" });
    }

    console.log("[🔓 LOGOUT] User session destroyed:", username);
    res.json({ message: "Logged out successfully" });
  });
});

// ✅ SECURE: Forgot Password - Send reset email
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find user by email
    const [users] = await pool.execute(
      "SELECT id, username, email FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      // Don't reveal if email exists (security best practice)
      return res.json({ message: "If email exists, a reset link has been sent" });
    }

    const user = users[0];

    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    await pool.execute(
      "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
      [tokenHash, expiresAt, user.id]
    );

    // Send reset email
    const emailSent = await sendPasswordResetEmail(user.email, user.username, resetToken);

    if (emailSent) {
      console.log(`[✅ PASSWORD_RESET] Reset link sent to ${user.email}`);
      return res.json({ message: "If email exists, a reset link has been sent" });
    } else {
      console.warn(`[⚠️ PASSWORD_RESET] Failed to send email to ${user.email}`);
      return res.json({ message: "If email exists, a reset link has been sent" });
    }
  } catch (error) {
    console.error("[❌ FORGOT_PASSWORD] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ SECURE: Reset Password - Verify token and set new password
app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Find user with valid reset token
    const [users] = await pool.execute(
      "SELECT id, username, email, reset_token, reset_token_expires FROM users WHERE reset_token IS NOT NULL AND reset_token_expires > NOW()"
    );

    let validUser = null;
    for (const user of users) {
      try {
        if (await argon2.verify(user.reset_token, token)) {
          validUser = user;
          break;
        }
      } catch (err) {
        // Invalid token format, continue to next user
        continue;
      }
    }

    if (!validUser) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Hash new password
    const hashedPassword = await argon2.hash(newPassword);

    // Update password and clear reset token
    await pool.execute(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
      [hashedPassword, validUser.id]
    );

    // Send confirmation email
    await sendPasswordChangedEmail(validUser.email, validUser.username);

    console.log(`[✅ PASSWORD_RESET] Password reset successful for ${validUser.username}`);
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("[❌ RESET_PASSWORD] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ SECURE: Middleware to check if user is authenticated via session OR JWT
// Supports both authentication methods for flexibility
const requireSession = (req, res, next) => {
  // ❌ VULNERABLE: Without this middleware, endpoints would accept any request
  // Attacker could:
  // - Access protected data without authentication
  // - Submit answers as another student
  // - Grade exams without being professor

  // Try session first
  if (req.session?.userId) {
    console.log("[✅ AUTH CHECK] User authenticated via session:", req.session.username);
    return next();
  }

  // Try JWT token if no session
  if (req.headers.authorization) {
    try {
      const token = req.headers.authorization.split(' ')[1]; // Get token after "Bearer "
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
      console.log("[✅ AUTH CHECK] User authenticated via JWT:", decoded.username);
      // Optionally store decoded data in req for use in routes
      req.user = decoded;
      return next();
    } catch (error) {
      console.log("[🚫 INVALID JWT] Token verification failed:", error.message);
    }
  }

  console.log("[🚫 UNAUTHORIZED] Attempted access without session or JWT");
  return res.status(401).json({ message: "Not authenticated. Please login." });
};

// Route imports
app.use("/api/exams", examsRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/submissions", examEventsRouter);  // ✅ Event tracking routes
app.use("/api/results", resultsRouter);
app.use("/api/users", usersRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/groups", groupsRouter);  // ✅ Groups management routes

// ✅ Initialize email service on startup
async function startServer() {
  try {
    await initializeEmailTransporter();
    console.log('[✅ EMAIL] Email service initialized');
  } catch (error) {
    console.error('[⚠️ EMAIL] Failed to initialize email service:', error.message);
  }

  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

startServer();

