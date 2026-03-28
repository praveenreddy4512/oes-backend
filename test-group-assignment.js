import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function runDiagnostics() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('DATABASE DIAGNOSTICS FOR GROUP ASSIGNMENT');
    console.log('═══════════════════════════════════════════════════\n');

    // 1. Check groups table
    console.log('1. GROUPS TABLE:');
    const [groupsCount] = await pool.execute('SELECT COUNT(*) as count FROM groups');
    console.log(`   Total groups: ${groupsCount[0].count}`);
    
    const [groups] = await pool.execute('SELECT id, name FROM groups LIMIT 5');
    if (groups.length > 0) {
      console.log('   Sample groups:');
      groups.forEach(g => console.log(`     - ID: ${g.id}, Name: ${g.name}`));
    } else {
      console.log('   ⚠️  NO GROUPS FOUND IN DATABASE!');
    }

    // 2. Check group_members table
    console.log('\n2. GROUP_MEMBERS TABLE:');
    const [membersCount] = await pool.execute('SELECT COUNT(*) as count FROM group_members');
    console.log(`   Total group memberships: ${membersCount[0].count}`);
    
    const [members] = await pool.execute(`
      SELECT 
        gm.id,
        gm.group_id,
        gm.student_id,
        g.name as group_name,
        u.username as student_username,
        u.role as student_role
      FROM group_members gm
      JOIN groups g ON gm.group_id = g.id
      JOIN users u ON gm.student_id = u.id
      LIMIT 5
    `);
    if (members.length > 0) {
      console.log('   Sample memberships:');
      members.forEach(m => console.log(`     - Student: ${m.student_username} (ID: ${m.student_id}, Role: ${m.student_role}) → Group: ${m.group_name} (ID: ${m.group_id})`));
    } else {
      console.log('   ⚠️  NO GROUP MEMBERSHIPS FOUND!');
    }

    // 3. Check students
    console.log('\n3. STUDENTS IN SYSTEM:');
    const [studentsCount] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    console.log(`   Total students: ${studentsCount[0].count}`);
    
    const [students] = await pool.execute("SELECT id, username, role FROM users WHERE role = 'student' ORDER BY created_at DESC LIMIT 5");
    if (students.length > 0) {
      console.log('   Recent students:');
      students.forEach(s => console.log(`     - ID: ${s.id}, Username: ${s.username}, Role: ${s.role}`));
    }

    // 4. Check for role case issues
    console.log('\n4. ROLE CASE ANALYSIS:');
    const [roleVariants] = await pool.execute("SELECT DISTINCT role FROM users WHERE role LIKE '%student%' OR role LIKE '%Student%'");
    console.log(`   Found ${roleVariants.length} role variant(s):`);
    roleVariants.forEach(r => console.log(`     - '${r.role}'`));

    // 5. Check groups with member counts
    console.log('\n5. GROUPS WITH MEMBER COUNTS:');
    const [groupStats] = await pool.execute(`
      SELECT 
        g.id, 
        g.name, 
        COUNT(gm.id) as member_count
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      GROUP BY g.id, g.name
    `);
    if (groupStats.length > 0) {
      console.log('   Groups:');
      groupStats.forEach(g => console.log(`     - ${g.name} (ID: ${g.id}): ${g.member_count} members`));
    }

    // 6. Check admins
    console.log('\n6. ADMIN USERS:');
    const [admins] = await pool.execute("SELECT id, username FROM users WHERE role = 'admin' LIMIT 3");
    console.log(`   Total admins: ${admins.length}`);
    if (admins.length > 0) {
      admins.forEach(a => console.log(`     - ID: ${a.id}, Username: ${a.username}`));
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('DIAGNOSIS COMPLETE');
    console.log('═══════════════════════════════════════════════════\n');

    // Provide recommendations
    console.log('📋 RECOMMENDATIONS:\n');
    
    if (groupsCount[0].count === 0) {
      console.log('❌ NO GROUPS FOUND - Create at least one group in the admin panel first!');
    } else {
      console.log(`✅ ${groupsCount[0].count} groups exist in database`);
    }

    if (membersCount[0].count === 0) {
      console.log('❌ NO GROUP MEMBERSHIPS - Group assignment is not persisting to database');
    } else {
      console.log(`✅ ${membersCount[0].count} group memberships found`);
    }

    if (studentsCount[0].count === 0) {
      console.log('❌ NO STUDENTS - Create test students first!');
    } else {
      console.log(`✅ ${studentsCount[0].count} students exist`);
    }

    if (roleVariants.some(r => r.role !== 'student')) {
      console.log(`⚠️  ROLE CASE ISSUE: Found role(s) other than lowercase 'student': ${roleVariants.map(r => `'${r.role}'`).join(', ')}`);
    } else {
      console.log('✅ All students have correct role: \'student\'');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_FOR_USER') {
      console.error('   Database credentials may be incorrect');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Cannot connect to database - is it running?');
    }
  } finally {
    await pool.end();
  }
}

runDiagnostics().catch(console.error);
