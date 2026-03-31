import { pool } from "./db.js";

async function runMigration() {
  try {
    console.log("🚀 Starting database migration for Device Fingerprinting...");
    
    // Check if column exists first
    const [columns] = await pool.execute("SHOW COLUMNS FROM users LIKE 'current_fingerprint'");
    
    if (columns.length === 0) {
      console.log("➕ Adding current_fingerprint column to users table...");
      await pool.execute("ALTER TABLE users ADD COLUMN current_fingerprint VARCHAR(255) DEFAULT NULL");
      console.log("✅ Column added successfully.");
    } else {
      console.log("ℹ️ Column already exists.");
    }
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

runMigration();
