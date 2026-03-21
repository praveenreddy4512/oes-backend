/**
 * Database Migration: Create exam_events table
 * Purpose: Track student actions during exams (tab switching, page refresh, time per question)
 */

const mysql = require('mysql2/promise');

async function createExamEventsTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('[📦 MIGRATION] Creating exam_events table...');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS exam_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submission_id INT NOT NULL,
        student_id INT NOT NULL,
        exam_id INT NOT NULL,
        event_type VARCHAR(50) NOT NULL COMMENT 'exam_started, question_viewed, answer_saved, tab_switched, page_refreshed, exam_submitted',
        event_details JSON COMMENT 'Additional event metadata (e.g., what question, where they switched)',
        question_id INT,
        time_spent_seconds INT COMMENT 'Time spent on this question',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (submission_id) REFERENCES submissions(submission_id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        
        INDEX idx_submission (submission_id),
        INDEX idx_student (student_id),
        INDEX idx_exam (exam_id),
        INDEX idx_event_type (event_type),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.execute(createTableSQL);
    console.log('[✅ MIGRATION] exam_events table created successfully!');

    // Verify table structure
    const [columns] = await connection.execute('DESCRIBE exam_events');
    console.log('[📋 TABLE STRUCTURE]');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'NO' ? 'NOT NULL' : 'NULLABLE'})`);
    });

  } catch (error) {
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('[⚠️  TABLE EXISTS] exam_events table already exists');
    } else {
      console.error('[❌ MIGRATION ERROR]', error.message);
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Export for use in server.js
module.exports = { createExamEventsTable };
