# Burp Suite Testing Guide - OES with Argon2 & Educational Vulnerabilities

## **Setup Instructions**

### **1. Configure Burp Suite Proxy**

#### **Step 1: Start Burp Suite**
- Open Burp Suite Community Edition
- Go to **Proxy → Options → Proxy Listeners**
- Default: `127.0.0.1:8080`
- Click **Running** (checkbox) - ensure it's enabled

#### **Step 2: Configure Browser Proxy**
- Open your browser (Chrome/Firefox)
- Go to **Settings → Proxy Settings** (or use FoxyProxy extension)
- Set HTTP Proxy: `127.0.0.1:8080`
- Or use **FoxyProxy extension** for easy toggle

#### **Step 3: Accept Burp Certificate**
- Visit `http://burp` in browser
- Download CA certificate
- Import to browser trusted certificates

#### **Step 4: Test Connection**
```bash
curl -x http://127.0.0.1:8080 http://example.com
# Should appear in Burp's HTTP History
```

---

## **Test 1: Login with Plaintext Password (Migration Test)**

### **Objective:** 
Test Argon2 migration strategy - first login with plaintext password, automatic hashing on subsequent logins.

### **Steps in Burp Suite:**

1. **Intercept First Login Request**
   - Go to **Proxy → Intercept → Intercept is on**
   - In browser: Send POST to `/api/login`
   ```json
   {
     "username": "admin",
     "password": "admin123"
   }
   ```

2. **Examine Request in Burp**
   - Right-click → **Send to Repeater**
   - In **Repeater tab**: Click **Send**

3. **Expected Response (First Login):**
   ```json
   {
     "message": "Login successful",
     "user": {
       "id": 1,
       "username": "admin",
       "role": "admin",
       "email": "admin@example.com"
     }
   }
   ```

4. **Check Server Logs:**
   - Look for: `[⚠️  MIGRATION] Plaintext password detected for: admin - will rehash`
   - Then: `[✅ MIGRATION COMPLETE] Password hashed and stored for: admin`

5. **Send Same Request Again**
   - Click **Send** again in Repeater
   - Expected: Same successful response
   - Check logs: Now shows `[✅ ARGON2] Verified hashed password for: admin`

### **What's Happening:**
- **First attempt**: Plaintext password in DB → detected → hashed → stored
- **Second attempt**: Hashed password in DB → verified with Argon2
- **Benefit**: Users can login with old plaintext passwords, automatically upgraded to Argon2

---

## **Test 2: SQL Injection Attack Examples (Educational)**

### **Objective:**
Test how SQL injection WOULD work (commented in code) vs. how parameterized queries PREVENT it.

### **Test 2A: Basic OR Injection**

In **Repeater**, modify request:
```json
{
  "username": "admin' OR '1'='1",
  "password": "x"
}
```

**Expected Result:**
```json
{
  "message": "Invalid credentials"
}
```

**Why it's blocked:**
- Parameterized query: `WHERE username = ?` treats entire string as value
- Attack: `admin' OR '1'='1` is searched as literal username, not matched
- If vulnerable: Would match due to `OR '1'='1` always being true

### **Test 2B: Comment Injection**

```json
{
  "username": "admin' --",
  "password": "x"
}
```

**Expected Result:**
```json
{
  "message": "Invalid credentials"
}
```

**Why it's blocked:**
- Parameterized binding prevents comment execution
- String treated as literal, `--` is not treated as SQL comment

### **Test 2C: UNION-based Injection (Questions endpoint)**

#### **Step 1: Get questions endpoint**
```
GET /api/questions?exam_id=1
```

#### **Step 2: In Burp Repeater, modify exam_id:**
```
GET /api/questions?exam_id=1 UNION SELECT username,password FROM users
```

**Expected Result:**
```json
[
  {
    "id": 1,
    "exam_id": 1,
    "question_text": "What is 2+2?",
    ...
  }
]
```

**Why it's blocked:**
- Parameterized query: `WHERE exam_id = ?` ensures `exam_id` is treated as number
- UNION injection doesn't execute because `?` is bound as value, not string

---

## **Test 3: Argon2 Hash Verification**

### **Objective:**
Verify passwords are actually hashed (not plaintext) after migration.

### **Step 1: Check Database After First Login**

**In cPanel or SSH:**
```bash
mysql -u USERNAME -p DATABASE
SELECT username, password FROM users WHERE username = 'admin';
```

**Expected Output:**
```
| admin | $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash> |
```

**NOT Expected (would be vulnerable):**
```
| admin | admin123 |  # ❌ Plaintext - VULNERABLE!
```

### **Step 2: Verify Hash Structure**

Hash format breakdown:
```
$argon2id$v=19$m=19456,t=2,p=1$<16-byte salt base64>$<32-byte hash base64>
```

- **$argon2id$** - Algorithm identifier
- **v=19** - Argon2 version 19
- **m=19456** - Memory cost: 19 MB
- **t=2** - Time cost: 2 iterations
- **p=1** - Parallelism: 1 thread
- **$<salt>$** - Random salt (prevents rainbow tables)
- **$<hash>** - Computed hash

---

## **Test 4: Wrong Password Rejection**

### **Step 1: Attempt Login with Wrong Password**

In **Repeater**:
```json
{
  "username": "admin",
  "password": "wrongpassword123"
}
```

**Expected Result:**
```json
{
  "message": "Invalid credentials"
}
```

### **Step 2: Check for Timing Attacks**

**Send 10 requests rapidly** with:
- Valid username + wrong password
- Invalid username + any password
- Compare response times

**Expected:** Both should take **similar time** (timing attack prevention)
- Invalid users also hash dummy password (constant-time comparison)
- Prevents attacker from detecting which usernames exist

---

## **Test 5: Brute Force Attack Resistance**

### **Objective:**
Demonstrate Argon2's resistance to brute-force vs. plaintext/MD5.

### **Step 1: Set Up Burp Intruder**

1. Send login request to **Intruder**
   - **Proxy → Intercept** - intercept login request
   - Right-click → **Send to Intruder**

2. Go to **Intruder → Target**
   - Target: `https://oes.freshmilkstraightfromsource.com`
   - Endpoint: `/api/login`

3. **Intruder → Positions**
   - Clear positions (click **Clear §**)
   - Highlight password value
   - Click **Add §** to mark password field

4. **Intruder → Payloads**
   - Payload type: **Simple list**
   - Add wordlist:
   ```
   password123
   admin123
   test123
   password
   123456
   ```

5. **Intruder → Options**
   - Thread count: 1 (to slow down)
   - Delay: 1000ms (1 second between requests)

6. Click **Start attack**

### **Step 2: Monitor Performance**

**Plaintext (vulnerable):**
- With MD5: ~100 attempts/second
- Brute force: 8-char password in ~8 hours

**With Argon2 (secure):**
- ~3 hashes/second (memory-hard, time-cost)
- Brute force: 8-char password in ~80 years
- GPU resistance: Special-purpose hardware still slow

### **Step 3: Calculate Attack Cost**

```
Cost Analysis:
- Plaintext MD5: 26.6 hours to crack password with RTX 3090
- Argon2: 9.8 MILLION years with same GPU
- Benefit: 370,000x slower to brute force

Memory hardness (19 MB per hash):
- Prevents parallel attacks using GPU arrays
- Each hash requires full 19 MB memory access
- Can't fit thousands of parallel hashes on GPU
```

---

## **Test 6: Plaintext Password Vulnerability (Commented Code)**

### **Objective:**
Show what WOULD happen if vulnerable code was active.

### **Step 1: View Vulnerable Code**

In **server.js** (lines 48-53):
```javascript
// ❌ VULNERABLE CODE (for educational purposes - DO NOT USE IN PRODUCTION)
// const unsafeQuery = `SELECT id, username, role, email, password FROM users WHERE username = '${username}' AND password = '${password}' LIMIT 1`;
// Attack example:
// username: admin' OR '1'='1
// This becomes: ... WHERE username = 'admin' OR '1'='1' AND password = ...
// Result: BYPASSES authentication
```

### **Step 2: Demonstrate Attack**

If code was vulnerable, in Burp Repeater:
```json
{
  "username": "admin' OR '1'='1' --",
  "password": "x"
}
```

Would login as first user (admin) without password ⚠️

### **Step 3: Why It's Now Protected**

Current code (lines 60-63):
```javascript
// ✅ SECURE: Use parameterized queries with Argon2 password hashing
const [rows] = await pool.execute(
  "SELECT id, username, role, email, password FROM users WHERE username = ? LIMIT 1",
  [username]  // Safely bound - not concatenated into SQL
);
```

The `?` placeholder ensures username value is **never** interpreted as SQL syntax.

---

## **Test 7: Password Update Vulnerability (Commented)**

### **Location:**
**users.js** (PUT endpoint) - lines 72-90

### **Vulnerable Code (commented):**
```javascript
// ❌ VULNERABLE: Storing plaintext passwords
// updates.push(" password = ?");
// values.push(password);  // PLAINTEXT STORED!
```

### **Secure Code (active):**
```javascript
// ✅ SECURE: Hash password before storing
const hashedPassword = await argon2.hash(password);
updates.push(" password = ?");
values.push(hashedPassword);
```

### **Test with Burp:**

1. **Intercept PUT request to update password:**
   ```
   PUT /api/users/1
   
   {
     "password": "newpassword123"
   }
   ```

2. **Check database after update:**
   ```bash
   SELECT password FROM users WHERE id = 1;
   # Should show: $argon2id$...
   # NOT: newpassword123
   ```

---

## **Test 8: Information Disclosure (Results endpoint)**

### **Vulnerable Code (commented in results.js):**
Lines 32-44:
```javascript
// ❌ VULNERABLE: SQL Injection allows student to see other students' results
// const unsafeQuery = `... WHERE r.student_id = ${student_id}`;
// Attack: student_id = "1 UNION SELECT * FROM users WHERE 1=1"
// Result: All usernames and emails exposed
```

### **Test in Burp:**

1. **Make request as Student (ID=5):**
   ```
   GET /api/results/student/5
   ```
   Returns: Only student 5's results ✅

2. **With "vulnerable" attack (would work if not parameterized):**
   ```
   GET /api/results/student/5 UNION SELECT * FROM users
   ```
   Returns: Only student 5's results (UNION injection prevented) ✅

---

## **Test 9: Cross-Exam Access Prevention**

### **Scenario:**
Professor A tests if they can access Professor B's exam results.

### **Step 1: Login as Professor A**
```json
{
  "username": "professor1",
  "password": "prof123"
}
```

### **Step 2: Try to Access Exam from Professor B**
```
GET /api/results/exam/999  # Exam belongs to Professor B
```

**Expected:** 
- Returns results for exam 999
- Should ideally filter by `professor_id` (business logic check)
- Parameterized query prevents SQL injection, but role-based access control needed

### **Improvement Needed:**
Add professor authorization check:
```javascript
// Check that logged-in professor owns this exam
const [exam] = await pool.execute(
  "SELECT professor_id FROM exams WHERE id = ?",
  [exam_id]
);

if (exam[0].professor_id !== req.user.id) {
  return res.status(403).json({ error: "Unauthorized" });
}
```

---

## **Test 10: Submission Spoofing (Questions endpoint)**

### **Vulnerable Code (commented in submissions.js):**
Lines 28-48:
```javascript
// ❌ VULNERABLE: No student_id validation
// const unsafeInsertQuery = `INSERT INTO submissions (...) VALUES (${exam_id}, ${student_id})`;
// Attack: Student 1 creates submission as Student 2
// student_id = 5  (pretend to be student 5)
```

### **Test in Burp:**

1. **Login as Student ID 1**
2. **Attempt to start exam as Student ID 5:**
   ```json
   {
     "exam_id": 3,
     "student_id": 5
   }
   ```

**Expected:**
- Should fail (improper authorization in frontend/backend)
- Backend accepts any student_id (needs middleware to check `req.user.id == student_id`)

### **Fix Needed:**
```javascript
router.post("/", authenticate, async (req, res) => {
  const { exam_id } = req.body;
  const student_id = req.user.id;  // From JWT/session, not request body
  
  // Now student_id can't be spoofed
});
```

---

## **Test 11: SQL Injection in Questions (POST)**

### **Vulnerable Code (commented):**
```javascript
// ❌ VULNERABLE:
// const unsafeQuery = `INSERT INTO questions (exam_id, question_text, ...) VALUES (${exam_id}, '${question_text}', ...)`;
// Attack: question_text = "What?'); DELETE FROM exams; --"
// Result: All exams deleted
```

### **Test in Burp:**

1. **Intercept POST to create question:**
   ```json
   {
     "exam_id": 1,
     "question_text": "What is 2+2?'); DELETE FROM exams; --",
     "option_a": "4",
     "option_b": "5",
     "option_c": "6",
     "option_d": "7",
     "correct_option": "A",
     "marks": 1
   }
   ```

2. **Send request**

**Expected:**
- Question created successfully
- Exams table intact (injection prevented)
- `question_text` stored as literal string

**If vulnerable:**
- Exams table would be deleted
- SQL syntax `);` would execute DELETE command

---

## **Test 12: Timing Attack Prevention**

### **Objective:**
Verify constant-time password comparison.

### **Test in Python:**

```python
import time
import requests

url = "https://oes.freshmilkstraightfromsource.com/api/login"

# Test 1: Valid user, wrong password
times_valid_user = []
for i in range(10):
    start = time.time()
    requests.post(url, json={
        "username": "admin",
        "password": "wrong123"
    })
    times_valid_user.append(time.time() - start)

# Test 2: Invalid user
times_invalid_user = []
for i in range(10):
    start = time.time()
    requests.post(url, json={
        "username": "nonexistent",
        "password": "wrong123"
    })
    times_invalid_user.append(time.time() - start)

# Compare
print(f"Valid user avg time: {sum(times_valid_user)/len(times_valid_user):.4f}s")
print(f"Invalid user avg time: {sum(times_invalid_user)/len(times_invalid_user):.4f}s")
print(f"Difference: {abs(sum(times_valid_user)/len(times_valid_user) - sum(times_invalid_user)/len(times_invalid_user)):.6f}s")
```

**Expected:** Times within ~5-10ms (similar, constant-time)

**Why:**
- Code hashes dummy password even for non-existent users
- Both branches take ~same time to execute
- Prevents username enumeration attacks

---

## **Test 13: Rate Limiting & Account Lockout (Advanced)**

**Not currently implemented, but recommended:**

### **Suggested Addition:**
```javascript
// After 5 failed attempts in 15 minutes, lockout user
const [failedAttempts] = await pool.execute(
  "SELECT COUNT(*) as attempts FROM login_attempts WHERE username = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)",
  [username]
);

if (failedAttempts[0].attempts >= 5) {
  return res.status(429).json({ message: "Too many attempts. Try again later." });
}

// Log failed attempt
if (!passwordMatch) {
  await pool.execute(
    "INSERT INTO login_attempts (username) VALUES (?)",
    [username]
  );
}
```

---

## **Test 14: Request/Response Inspection**

### **In Burp Repeater - Full Request Flow**

#### **Step 1: Examine Raw Request**
```
POST /api/login HTTP/1.1
Host: oes.freshmilkstraightfromsource.com
Content-Type: application/json
Content-Length: 43

{"username":"admin","password":"admin123"}
```

#### **Step 2: Examine Raw Response**
```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 123

{"message":"Login successful","user":{"id":1,"username":"admin","role":"admin","email":"admin@example.com"}}
```

#### **Step 3: Check for Sensitive Data Leakage**
- ❌ Should NOT include password in response
- ✅ Should include user metadata (id, role, email)
- ✅ Should NOT include hashed password in response

---

## **Summary: Burp Suite Testing Checklist**

- [ ] **Test 1**: Plaintext→Argon2 migration (first login creates hash)
- [ ] **Test 2**: SQL injection blocked (OR, comment, UNION attacks)
- [ ] **Test 3**: Verify Argon2 hashes in database
- [ ] **Test 4**: Wrong password rejected
- [ ] **Test 5**: Brute force resistance (slow, memory-hard)
- [ ] **Test 6**: Educational vulnerabilities documented in code
- [ ] **Test 7**: Password updates are hashed
- [ ] **Test 8**: Information disclosure prevented
- [ ] **Test 9**: Cross-exam access validation
- [ ] **Test 10**: Submission spoofing (needs auth checks)
- [ ] **Test 11**: Question creation injection prevented
- [ ] **Test 12**: Timing attack prevention
- [ ] **Test 13**: Rate limiting (future enhancement)
- [ ] **Test 14**: Response inspection for data leakage

---

## **Commands to Copy-Paste in Burp Repeater**

### **Base64 Encoded for Repeater Quick Copy:**

#### **Test 1: Plaintext Password**
```
POST /api/login HTTP/1.1
Host: oes.freshmilkstraightfromsource.com
Content-Type: application/json
Content-Length: 54

{"username":"admin","password":"admin123"}
```

#### **Test 2: SQL Injection Attempt**
```
POST /api/login HTTP/1.1
Host: oes.freshmilkstraightfromsource.com
Content-Type: application/json
Content-Length: 75

{"username":"admin' OR '1'='1' --","password":"x"}
```

#### **Test 3: Wrong Password**
```
POST /api/login HTTP/1.1
Host: oes.freshmilkstraightfromsource.com
Content-Type: application/json
Content-Length: 57

{"username":"admin","password":"wrongpassword"}
```

#### **Test 4: UNION Injection (Questions)**
```
GET /api/questions?exam_id=1 UNION SELECT username,password FROM users HTTP/1.1
Host: oes.freshmilkstraightfromsource.com
```

---

## **Expected Outcomes Summary**

| Test | Expected Result | Security Property |
|------|-----------------|-------------------|
| Plaintext login | Success + auto-hash | Migration, Argon2 |
| SQL Injection | Blocked | Parameterized queries |
| Wrong password | 401 Unauthorized | Password validation |
| Timing (valid vs invalid user) | Similar time | Timing attack prevention |
| Argon2 hash format | `$argon2id$v=19$...` | Memory-hard hashing |
| Brute force resistance | ~3 attempts/sec | Time-cost iterations |
| Database breach impact | Hashes exposed, not passwords | Argon2 salting |
| UNION injection | Blocked | Parameterized binding |

---

## **Troubleshooting**

**Problem:** "pchstr must contain a $ as first char"
- **Cause**: cPanel backend not updated with migration code
- **Fix**: Pull latest code and restart Node.js

**Problem:** Login takes 5+ seconds
- **Cause**: Argon2 hashing (intentionally slow)
- **Expected**: 2-3 seconds per hash (memory-hard = by design)

**Problem:** Burp not intercepting HTTPS requests
- **Cause**: Certificate not trusted
- **Fix**: Import Burp CA certificate to browser

---

## **Next Steps**

1. ✅ Copy all test cases from this guide
2. ✅ Run each test in Burp Repeater
3. ✅ Document results in Burp Report
4. ✅ Verify all security properties
5. ✅ Check Educational Vulnerabilities are documented
6. ✅ Verify Argon2 implementation in production

