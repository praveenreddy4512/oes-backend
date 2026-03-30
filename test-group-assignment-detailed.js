/**
 * TEST: Detailed Group Assignment Error Diagnosis
 * Shows EXACTLY what error the API is returning
 */

import fetch from 'node-fetch';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testGroupAssignment() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🔍 GROUP ASSIGNMENT API DIAGNOSIS');
  console.log('═══════════════════════════════════════════════════\n');

  // Get the JWT token from user
  console.log('To test the API, you need a valid JWT token.');
  console.log('Follow these steps:');
  console.log('1. Log in to your admin panel');
  console.log('2. Open DevTools (F12)');
  console.log('3. Go to Network tab');
  console.log('4. Perform any action that makes an API call');
  console.log('5. Click on the request');
  console.log('6. Find the Authorization header');
  console.log('7. Copy everything after "Bearer "\n');

  const token = await question('Paste your JWT token here: ');
  
  if (!token) {
    console.log('❌ No token provided');
    rl.close();
    return;
  }

  const apiUrl = 'https://oes.backend-drab.vercel.app';
  // Or use: const apiUrl = 'http://localhost:5000'; // for local testing
  
  console.log(`\n📍 Using API: ${apiUrl}`);
  console.log('\n═══════════════════════════════════════════════════\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  try {
    // Step 1: Test authentication by calling debug endpoint
    console.log('📋 Step 1: Testing Authentication...\n');
    console.log(`GET ${apiUrl}/api/groups/debug/check`);
    console.log('Headers:', { 'Authorization': 'Bearer [YOUR_TOKEN]' });
    
    const debugRes = await fetch(`${apiUrl}/api/groups/debug/check`, { 
      method: 'GET',
      headers 
    });
    
    console.log(`Response Status: ${debugRes.status} ${debugRes.statusText}`);
    
    const debugData = await debugRes.json();
    console.log('Response Body:', JSON.stringify(debugData, null, 2));
    
    if (debugRes.status === 403) {
      console.log('\n❌ ERROR: 403 Forbidden');
      console.log('   Your token does NOT have admin role!');
      console.log('   Make sure you\'re logged in as admin.\n');
      rl.close();
      return;
    }
    
    if (debugRes.status !== 200) {
      console.log(`\n❌ ERROR: ${debugRes.status}`);
      console.log('   Authentication failed!\n');
      rl.close();
      return;
    }
    
    console.log('\n✅ Authentication successful!');
    console.log(`   Current user: ${debugData.currentUser?.username} (Role: ${debugData.currentUser?.role})`);
    console.log(`   Total groups: ${debugData.allGroups?.length}`);
    console.log(`   Sample students: ${debugData.sampleStudents?.length}`);

    // Step 2: Get groups
    console.log('\n───────────────────────────────────────────────────');
    console.log('📋 Step 2: Fetching Groups...\n');
    console.log(`GET ${apiUrl}/api/groups`);
    
    const groupsRes = await fetch(`${apiUrl}/api/groups`, { 
      method: 'GET',
      headers 
    });
    
    console.log(`Response Status: ${groupsRes.status} ${groupsRes.statusText}`);
    
    const groupsData = await groupsRes.json();
    
    if (!groupsRes.ok) {
      console.log('❌ Failed to fetch groups!');
      console.log('Response:', JSON.stringify(groupsData, null, 2));
      rl.close();
      return;
    }
    
    console.log(`✅ Found ${groupsData.length} groups`);
    if (groupsData.length === 0) {
      console.log('\n⚠️  WARNING: No groups found!');
      console.log('   Create at least one group first in admin panel.\n');
      rl.close();
      return;
    }
    
    groupsData.slice(0, 2).forEach(g => {
      console.log(`   - ${g.name} (ID: ${g.id}, Members: ${g.member_count})`);
    });

    const groupId = groupsData[0].id;

    // Step 3: Create a test student
    console.log('\n───────────────────────────────────────────────────');
    console.log('📋 Step 3: Creating Test Student...\n');
    console.log(`POST ${apiUrl}/api/users`);
    
    const studentPayload = {
      username: `testuser_${Date.now()}`,
      password: 'Test@1234',
      email: `test${Date.now()}@test.com`,
      role: 'student'
    };
    
    console.log('Payload:', JSON.stringify(studentPayload, null, 2));
    
    const studentRes = await fetch(`${apiUrl}/api/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify(studentPayload)
    });

    console.log(`Response Status: ${studentRes.status} ${studentRes.statusText}`);
    
    const studentData = await studentRes.json();
    console.log('Response:', JSON.stringify(studentData, null, 2));
    
    if (!studentRes.ok) {
      console.log('\n❌ Failed to create student!');
      rl.close();
      return;
    }
    
    const studentId = studentData.id || studentData.user?.id;
    console.log(`\n✅ Created student: ${studentPayload.username} (ID: ${studentId})`);

    // Step 4: Add student to group (THIS IS THE KEY TEST)
    console.log('\n───────────────────────────────────────────────────');
    console.log('📋 Step 4: Adding Student to Group (THE KEY TEST)...\n');
    console.log(`POST ${apiUrl}/api/groups/${groupId}/members`);
    
    const addPayload = { studentIds: [studentId] };
    console.log('Payload:', JSON.stringify(addPayload, null, 2));
    
    const addRes = await fetch(`${apiUrl}/api/groups/${groupId}/members`, {
      method: 'POST',
      headers,
      body: JSON.stringify(addPayload)
    });

    console.log(`Response Status: ${addRes.status} ${addRes.statusText}`);
    
    const addData = await addRes.json();
    console.log('Response Body:', JSON.stringify(addData, null, 2));

    // Analyze the result
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 TEST RESULTS');
    console.log('═══════════════════════════════════════════════════\n');
    
    if (addRes.status === 403) {
      console.log('❌ FAILED: 403 Forbidden - Middleware is STILL blocking!');
      console.log('   Possible causes:');
      console.log('   1. Application on cPanel hasn\'t been restarted');
      console.log('   2. Old code with buggy requireRole still running');
      console.log('   3. Your JWT token might not have admin role\n');
    } else if (addRes.status === 404) {
      console.log('❌ FAILED: 404 Not Found');
      console.log('   Possible causes:');
      console.log('   1. Group ID doesn\'t exist');
      console.log('   2. Wrong API endpoint\n');
    } else if (addRes.status === 400) {
      console.log('❌ FAILED: 400 Bad Request');
      console.log('   Response:', addData.error);
      console.log('   Check payload format\n');
    } else if (addRes.ok) {
      console.log('✅ SUCCESS! API returned 200 OK');
      console.log(`   Added: ${addData.added || 0} students`);
      console.log(`   Failed: ${addData.failed || 0} students`);
      
      if ((addData.added || 0) > 0) {
        console.log('\n🎉 STUDENTS WERE ADDED!');
        console.log('   Check phpMyAdmin to verify they\'re in group_members table\n');
      } else {
        console.log('\n⚠️  API says success but no students were added!');
        console.log('   This might mean:');
        console.log('   1. Student was already in group');
        console.log('   2. Student role validation is failing\n');
      }
    } else {
      console.log(`❌ FAILED: ${addRes.status} ${addRes.statusText}`);
      console.log('   Unexpected error:', addData, '\n');
    }

    console.log('═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Network Error:', error.message);
    console.log('\nPossible causes:');
    console.log('1. API server is down');
    console.log('2. Wrong API URL');
    console.log('3. CORS issue\n');
  } finally {
    rl.close();
  }
}

testGroupAssignment().catch(console.error);
