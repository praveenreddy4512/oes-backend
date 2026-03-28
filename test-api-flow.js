/**
 * TEST: Group Assignment API Flow
 * This simulates what happens when you create a student with groups selected
 */

import fetch from 'node-fetch';

const API_BASE = 'https://oes.backend-drab.vercel.app'; // Your backend URL
// Change to http://localhost:5000 if testing locally

async function testGroupAssignment() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('GROUP ASSIGNMENT API TEST');
  console.log('═══════════════════════════════════════════════════\n');

  // You need to provide a valid JWT token for admin user
  const adminToken = process.argv[2];
  
  if (!adminToken) {
    console.log('❌ Missing JWT token. Usage:');
    console.log('   node test-api-flow.js YOUR_JWT_TOKEN\n');
    console.log('How to get your JWT token:');
    console.log('1. Log in to the admin panel');
    console.log('2. Open DevTools (F12) → Network tab');
    console.log('3. Look for any request with Authorization header');
    console.log('4. Copy the token (everything after "Bearer ")');
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  try {
    // Step 1: Get all groups
    console.log('📋 Step 1: Fetching all groups...');
    const groupsRes = await fetch(`${API_BASE}/api/groups`, { headers });
    const groupsData = await groupsRes.json();
    
    if (!groupsRes.ok) {
      console.log('❌ Failed to fetch groups:', groupsData);
      return;
    }
    
    console.log(`✅ Found ${groupsData.length || 0} groups`);
    if (groupsData.length > 0) {
      console.log('   Groups:');
      groupsData.slice(0, 3).forEach(g => {
        console.log(`     - ${g.name} (ID: ${g.id})`);
      });
    } else {
      console.log('   ⚠️  No groups found! Create a group first in admin panel.');
      return;
    }

    const groupId = groupsData[0].id;

    // Step 2: Create a test student
    console.log('\n📋 Step 2: Creating test student...');
    const studentRes = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: `teststudent_${Date.now()}`,
        password: 'Test@1234',
        email: `test${Date.now()}@test.com`,
        role: 'student'
      })
    });

    const studentData = await studentRes.json();
    
    if (!studentRes.ok) {
      console.log('❌ Failed to create student:', studentData);
      return;
    }
    
    const studentId = studentData.id || studentData.user?.id;
    console.log(`✅ Created student: ${studentData.username} (ID: ${studentId})`);

    // Step 3: Add student to group
    console.log(`\n📋 Step 3: Adding student to group ${groupId}...`);
    const addRes = await fetch(`${API_BASE}/api/groups/${groupId}/members`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        studentIds: [studentId]
      })
    });

    const addData = await addRes.json();
    
    console.log(`   Response Status: ${addRes.status}`);
    console.log(`   Response Body:`, addData);
    
    if (!addRes.ok) {
      console.log('❌ Failed to add student to group:', addData);
      return;
    }
    
    console.log('✅ API returned success');
    if (addData.added) {
      console.log(`   Added: ${addData.added} student(s)`);
    }
    if (addData.skipped) {
      console.log(`   Skipped: ${addData.skipped} (already in group)`);
    }
    if (addData.failed) {
      console.log(`   Failed: ${addData.failed}`);
    }

    // Step 4: Verify student was added
    console.log(`\n📋 Step 4: Verifying student was added to group...`);
    const verifyRes = await fetch(`${API_BASE}/api/groups/${groupId}`, { headers });
    const groupDetails = await verifyRes.json();
    
    const studentInGroup = groupDetails.members?.some(m => m.student_id === studentId || m.id === studentId);
    
    if (studentInGroup) {
      console.log(`✅ SUCCESS: Student found in group members!`);
    } else {
      console.log(`❌ FAIL: Student NOT found in group members`);
      console.log(`   Group members: ${JSON.stringify(groupDetails.members || [])}`);
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('TEST COMPLETE');
    console.log('═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testGroupAssignment();
