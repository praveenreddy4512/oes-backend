/**
 * Migration: Add password reset fields to users table
 * This script adds reset_token and reset_token_expires columns to support password reset functionality
 */

import mysql from 'mysql2/promise';

async function migrate() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'online_exam_db',
    });

    console.log('[⏳ MIGRATION] Starting password reset fields migration...');

    // Check if columns already exist
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME IN ('reset_token', 'reset_token_expires')"
    );

    if (columns.length < 2) {
      // Add reset_token column
      try {
        await connection.query(
          "ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL COMMENT 'Hashed password reset token'"
        );
        console.log('[✅ MIGRATION] Added reset_token column');
      } catch (err) {
        if (!err.message.includes('Duplicate column')) {
          throw err;
        }
        console.log('[ℹ️ MIGRATION] reset_token column already exists');
      }

      // Add reset_token_expires column
      try {
        await connection.query(
          "ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP NULL COMMENT 'When the reset token expires'"
        );
        console.log('[✅ MIGRATION] Added reset_token_expires column');
      } catch (err) {
        if (!err.message.includes('Duplicate column')) {
          throw err;
        }
        console.log('[ℹ️ MIGRATION] reset_token_expires column already exists');
      }
    } else {
      console.log('[ℹ️ MIGRATION] Password reset columns already exist');
    }

    console.log('[✅ MIGRATION] Migration completed successfully');
  } catch (error) {
    console.error('[❌ MIGRATION] Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
