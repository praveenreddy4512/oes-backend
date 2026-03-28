/**
 * Database Migration: Add shuffle settings to exams table
 * Purpose: Allow professors to shuffle questions and options during exam creation
 */

const mysql = require('mysql2/promise');

async function addShuffleSettings() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('[📦 MIGRATION] Adding shuffle settings to exams table...');

    // Check if columns already exist before adding them
    const [columns] = await connection.execute('DESCRIBE exams');
    const columnNames = columns.map(col => col.Field);

    if (!columnNames.includes('shuffle_questions')) {
      const alterSQL1 = `
        ALTER TABLE exams 
        ADD COLUMN shuffle_questions BOOLEAN DEFAULT FALSE COMMENT 'Shuffle question order for each student'
      `;
      await connection.execute(alterSQL1);
      console.log('[✅] Added shuffle_questions column');
    } else {
      console.log('[⏭️] shuffle_questions column already exists');
    }

    if (!columnNames.includes('shuffle_options')) {
      const alterSQL2 = `
        ALTER TABLE exams 
        ADD COLUMN shuffle_options BOOLEAN DEFAULT FALSE COMMENT 'Shuffle answer options for each question'
      `;
      await connection.execute(alterSQL2);
      console.log('[✅] Added shuffle_options column');
    } else {
      console.log('[⏭️] shuffle_options column already exists');
    }

    // Verify table structure
    const [updatedColumns] = await connection.execute('DESCRIBE exams');
    console.log('[📋 UPDATED TABLE STRUCTURE]');
    updatedColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

    console.log('[✅ MIGRATION COMPLETE] Shuffle settings added successfully!');
  } catch (error) {
    console.error('[❌ MIGRATION FAILED]', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Export as promise-based function
export default addShuffleSettings;
