/**
 * Database Migration: Add session tracking columns
 * Tracks previous device and when sessions are invalidated for multi-login support
 */

import { pool } from "./db.js";

async function runMigration() {
  try {
    console.log("🚀 Starting database migration for Session Invalidation Tracking...");
    
    // Add columns to track session invalidation
    const columnsToAdd = [
      { name: 'previous_fingerprint', type: 'VARCHAR(255) DEFAULT NULL', description: 'Previous device fingerprint' },
      { name: 'session_invalidated_at', type: 'TIMESTAMP NULL', description: 'When previous session was invalidated' },
    ];

    for (const col of columnsToAdd) {
      const [columns] = await pool.execute(`SHOW COLUMNS FROM users LIKE '${col.name}'`);
      
      if (columns.length === 0) {
        console.log(`➕ Adding ${col.name} column...`);
        await pool.execute(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✅ ${col.name} added successfully.`);
      } else {
        console.log(`ℹ️ ${col.name} already exists.`);
      }
    }

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

runMigration();
