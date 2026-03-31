import { pool } from "./db.js";

async function runMigration() {
  try {
    console.log("🚀 Starting database migration for IP restriction...");
    
    // Check if columns exist first to avoid errors
    const [columns] = await pool.execute("SHOW COLUMNS FROM exams LIKE 'is_ip_restricted'");
    
    if (columns.length === 0) {
      console.log("➕ Adding is_ip_restricted and restricted_ip columns...");
      await pool.execute("ALTER TABLE exams ADD COLUMN is_ip_restricted BOOLEAN DEFAULT FALSE");
      await pool.execute("ALTER TABLE exams ADD COLUMN restricted_ip VARCHAR(255) DEFAULT NULL");
      console.log("✅ Columns added successfully.");
    } else {
      console.log("ℹ️ Columns already exist.");
    }
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

runMigration();
