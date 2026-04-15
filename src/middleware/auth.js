import jwt from "jsonwebtoken";
import { pool } from "../db.js";

// 🔐 SECURITY: Use environment variable for JWT secret
// In production, this should be a strong random string stored securely
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
const TOKEN_EXPIRY = "24h"; // Token expires in 24 hours

/**
 * Generate a JWT token with user data
 * @param {Object} user - User object with id, username, and role
 * @returns {string} Signed JWT token
 */
export function generateToken(user, fingerprint = null) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      fingerprint: fingerprint, // Track device fingerprint in token
    },
    JWT_SECRET,
    {
      algorithm: "HS256", // HMAC-SHA256
      expiresIn: TOKEN_EXPIRY,
      issuer: "oes-backend",
    }
  );
}

/**
 * Verify JWT token and return decoded payload
 * 🔐 SECURITY: Verifies HMAC signature - any tampering will be detected
 * How HMAC-SHA256 prevents tampering:
 * 1. Token = header.payload.signature
 * 2. Signature = HMAC-SHA256(header.payload, secret)
 * 3. If attacker modifies payload, signature becomes invalid
 * 4. Only server knows the secret, attacker cannot recalculate signature
 * 5. jwt.verify() recalculates signature and compares - if different, token is rejected
 *
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (err) {
    return null;
  }
}

/**
 * Middleware to protect routes - verifies JWT token
 * 🔐 SECURITY: Prevents unauthenticated access
 */
export function authMiddleware(req, res, next) {
  // Use async wrapper to handle DB call
  (async () => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid authorization header" });
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // 🔐 SECURITY: Multi-login / Fingerprint check
      // If token has a fingerprint, it MUST match the one stored in DB for this user
      if (decoded.fingerprint) {
        const [rows] = await pool.execute(
          "SELECT current_fingerprint, session_invalidated_at FROM users WHERE id = ?",
          [decoded.id]
        );
        
        if (rows.length > 0) {
          const activeFingerprint = rows[0].current_fingerprint;
          const invalidatedAt = rows[0].session_invalidated_at;
          
          if (activeFingerprint && activeFingerprint !== decoded.fingerprint) {
            console.warn(`[🚫 SESSION_INVALIDATED] User ${decoded.username} attempted access with old fingerprint.`);
            console.warn(`   Old Device: ${decoded.fingerprint.substring(0, 8)}...`);
            console.warn(`   Active Device: ${activeFingerprint.substring(0, 8)}...`);
            console.warn(`   Invalidated at: ${invalidatedAt || 'unknown'}`);
            
            return res.status(401).json({ 
              error: "Session Invalidated", 
              message: "Your device was logged out because you signed in from another device. For security, only one device can be active at a time.",
              invalidatedAt: invalidatedAt
            });
          }
        }
      }

      // Attach user info to request object
      req.user = decoded;
      next();
    } catch (err) {
      console.error("[❌ AUTH ERROR]", err.message);
      res.status(401).json({ error: "Authentication failed" });
    }
  })();
}

/**
 * Middleware to check user role
 * 🔐 SECURITY: Role-based access control (RBAC) - prevents unauthorized actions
 * @param {Array<string>} allowedRoles - Roles allowed to access this endpoint
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
}

/**
 * Middleware to prevent IDOR (Insecure Direct Object Reference)
 * 🔐 SECURITY: Ensures users can only access their own data
 * Logs suspicious attempts to the console
 *
 * @param {string} resourceParam - Name of the URL parameter containing the resource ID
 * @param {Function} getResourceUser - Function to get user_id of the resource
 */
export function preventIDOR(resourceParam, getResourceUser) {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceParam];
      const userId = req.user.id;
      const userRole = req.user.role;

      // Admins and professors can access any resource
      if (userRole === "admin" || userRole === "professor") {
        return next();
      }

      // Get the owner of the resource
      const resourceOwner = await getResourceUser(resourceId);

      if (!resourceOwner) {
        return res.status(404).json({ error: "Resource not found" });
      }

      // Check if user is the owner
      if (resourceOwner !== userId) {
        // 🔐 SECURITY: Log suspicious attempt
        console.warn(
          `[SECURITY] IDOR ATTEMPT BLOCKED: User ${userId} (${userRole}) tried to access resource ${resourceId} owned by user ${resourceOwner}`
        );

        return res.status(403).json({
          error: "Access denied. You can only access your own resources.",
        });
      }

      next();
    } catch (err) {
      console.error(`[ERROR] IDOR check failed: ${err.message}`);
      res.status(500).json({ error: "Access control check failed" });
    }
  };
}

/**
 * Function to extract user ID from resource
 * This should be called from the preventIDOR middleware
 */
export async function getStudentSubmissionUser(submissionId, pool) {
  try {
    const [rows] = await pool.execute(
      "SELECT student_id FROM submissions WHERE id = ?",
      [submissionId]
    );
    return rows.length ? rows[0].student_id : null;
  } catch (err) {
    console.error(`Error getting submission user: ${err.message}`);
    return null;
  }
}

export async function getExamUser(examId, pool) {
  try {
    const [rows] = await pool.execute(
      "SELECT professor_id FROM exams WHERE id = ?",
      [examId]
    );
    return rows.length ? rows[0].professor_id : null;
  } catch (err) {
    console.error(`Error getting exam user: ${err.message}`);
    return null;
  }
}
