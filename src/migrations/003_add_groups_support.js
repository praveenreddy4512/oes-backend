/**
 * Database Migration: Add Groups Support for Exam Access Control
 * Purpose: Allow admins to create groups, professors to assign exams to groups,
 *          and restrict student exam access by group membership
 */

const mysql = require('mysql2/promise');

async function addGroupsSupport() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('[📦 MIGRATION] Adding groups support...');

    // Create groups table
    const createGroupsTableSQL = `
      CREATE TABLE IF NOT EXISTS groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_name (name),
        INDEX idx_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // Create group_members table (linking students to groups)
    const createGroupMembersTableSQL = `
      CREATE TABLE IF NOT EXISTS group_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        student_id INT NOT NULL,
        added_by INT NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_group_student (group_id, student_id),
        INDEX idx_group (group_id),
        INDEX idx_student (student_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // Create exam_groups table (linking exams to groups)
    const createExamGroupsTableSQL = `
      CREATE TABLE IF NOT EXISTS exam_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        exam_id INT NOT NULL,
        group_id INT NOT NULL,
        
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        UNIQUE KEY unique_exam_group (exam_id, group_id),
        INDEX idx_exam (exam_id),
        INDEX idx_group (group_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    console.log('[⏳] Creating groups table...');
    await connection.execute(createGroupsTableSQL);
    console.log('[✅] groups table created');

    console.log('[⏳] Creating group_members table...');
    await connection.execute(createGroupMembersTableSQL);
    console.log('[✅] group_members table created');

    console.log('[⏳] Creating exam_groups table...');
    await connection.execute(createExamGroupsTableSQL);
    console.log('[✅] exam_groups table created');

    // Verify table structures
    const [groupsColumns] = await connection.execute('DESCRIBE groups');
    console.log('[📋 GROUPS TABLE STRUCTURE]');
    groupsColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

    const [memberColumns] = await connection.execute('DESCRIBE group_members');
    console.log('[📋 GROUP_MEMBERS TABLE STRUCTURE]');
    memberColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

    const [examGroupColumns] = await connection.execute('DESCRIBE exam_groups');
    console.log('[📋 EXAM_GROUPS TABLE STRUCTURE]');
    examGroupColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

    console.log('[✅ MIGRATION COMPLETE] Groups support added successfully!');
  } catch (error) {
    if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.message.includes('already exists')) {
      console.log('[⚠️  TABLES EXIST] Groups tables already exist');
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

// Export as promise-based function
export default addGroupsSupport;
