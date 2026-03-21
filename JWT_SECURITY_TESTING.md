# JWT Security Implementation & Testing Guide

## Overview
This guide explains how to test the new JWT (JSON Web Token) authentication system with HMAC-SHA256 signing and IDOR (Insecure Direct Object Reference) protection.

## Security Features Implemented

### 1. **JWT Authentication with HMAC-SHA256**

#### What is HMAC-SHA256?
- **HMAC** = Hash-Based Message Authentication Code
- **SHA256** = Secure Hash Algorithm 256-bit
- Used to digitally sign JWT tokens to prevent tampering

#### How it prevents tampering:
```
JWT Format: header.payload.signature

Example:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6InN0dWRlbnQifQ.signature

Signature = HMAC-SHA256(header.payload, SECRET_KEY)

Tampering Detection:
1. If attacker modifies payload (e.g., change "role" from "student" to "admin")
2. The token becomes: header.modified_payload.signature
3. Server receives it and recalculates: HMAC-SHA256(header.modified_payload, SECRET_KEY)
4. Calculated signature ≠ provided signature
5. Server REJECTS the token
6. Only the server knows the SECRET_KEY, so attacker cannot recalculate a valid signature
```

#### Token Payload (JWT Claims)
```json
{
  "id": 1,
  "username": "student1",
  "role": "student",
  "email": "student1@exam.com",
  "iat": 1700000000,
  "exp": 1700086400,
  "iss": "oes-backend"
}
```

**Claims Explanation:**
- `id` - User ID from database
- `username` - Username
- `role` - User role (student, professor, admin)
- `email` - User email
- `iat` - Issued At timestamp
- `exp` - Expiration timestamp (24 hours from issuance)
- `iss` - Issuer (OES Backend)

### 2. **IDOR (Insecure Direct Object Reference) Protection**

IDOR vulnerabilities occur when users can access or modify data belonging to other users by changing resource IDs in URLs.

#### Example IDOR Attack (Before Fix):
```
Student 1 takes submission with ID 5
URL: GET /api/submissions/5

Attacker (Student 2) modifies URL:
URL: GET /api/submissions/1
Result: Can view Student 1's answers and results ❌
```

#### How We Fixed It:
1. **Access Control Checks** - Server verifies user owns the resource
2. **Role-Based Authorization** - Only professors/admins can access others' data
3. **Security Logging** - All IDOR attempts are logged with user ID and resource ID

#### Protected Endpoints:
- `GET /api/submissions/:id` - Students can only see their own submissions
- `GET /api/results/student/:id` - Students can only see their own results
- `GET /api/exams/:id` - Students can see published exams only

---

## Testing Procedure

### Step 1: Login and Obtain JWT Token

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "student1",
    "password": "student123"
  }'
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "student1",
    "role": "student",
    "email": "student1@exam.com"
  }
}
```

**Copy the token value** (everything after `"token": "`).

---

### Step 2: Use Token in API Request

```bash
curl -X GET http://localhost:5000/api/submissions/5 \
  -H "Authorization: Bearer <YOUR_TOKEN_HERE>"
```

**Expected Response:** 200 OK with submission details

---

### Step 3: Test Token Tampering at jwt.io

1. **Go to https://jwt.io**
2. **Paste your token** into the "Encoded" section
3. **In the Payload section, modify the data:**
   ```json
   {
     "id": 999,        // ← Change to different user
     "username": "admin1",  // ← Spoof as admin
     "role": "admin",   // ← Change role
     "iat": ...,
     "exp": ...
   }
   ```
4. **Copy the new token** from the "Encoded" section
5. **Try to use the modified token:**

```bash
curl -X GET http://localhost:5000/api/submissions/5 \
  -H "Authorization: Bearer <MODIFIED_TOKEN>"
```

**Expected Response:** 401 Unauthorized
```json
{
  "error": "Invalid or expired token"
}
```

✅ **Why it fails:** The signature no longer matches because the SECRET_KEY wasn't used to sign the modified token.

---

### Step 4: Test IDOR Protection

#### Test 1: Student Trying to Access Another Student's Submission

```bash
# Student 1 logs in and gets token
curl -X POST http://localhost:5000/api/login \
  -d '{"username": "student1", "password": "student123"}'
# Get token (let's say it's: token_student1)

# Student 1 tries to access their own submission (ID 5) - Should work
curl -X GET http://localhost:5000/api/submissions/5 \
  -H "Authorization: Bearer token_student1"
# Response: 200 OK ✅

# Student 1 tries to access Student 2's submission (ID 10) - Should FAIL
curl -X GET http://localhost:5000/api/submissions/10 \
  -H "Authorization: Bearer token_student1"
# Response: 403 Forbidden ❌
# Message: "Access denied. You can only access your own resources."
```

**Check server logs:**
```
[SECURITY] IDOR ATTEMPT BLOCKED: User 1 (student) tried to access resource 10 owned by user 2
```

#### Test 2: Professor Can Access Any Submission

```bash
# Professor 1 logs in
curl -X POST http://localhost:5000/api/login \
  -d '{"username": "professor1", "password": "prof123"}'

# Professor can access any submission (ID 5, 10, 15, etc.)
curl -X GET http://localhost:5000/api/submissions/5 \
  -H "Authorization: Bearer token_professor"
# Response: 200 OK ✅
```

---

### Step 5: Test Token Expiration

**Token validity:** 24 hours

After 24 hours, using the same token will fail:

```bash
curl -X GET http://localhost:5000/api/submissions/5 \
  -H "Authorization: Bearer <OLD_TOKEN>"
# Response: 401 Unauthorized - "Invalid or expired token"
```

**Solution:** User must login again to get a new token.

---

## Security Testing Checklist

- [ ] JWT token generated on login
- [ ] Token contains user id, username, role, email
- [ ] Token expires after 24 hours
- [ ] Modified tokens are rejected (401)
- [ ] Missing Authorization header returns 401
- [ ] Invalid token format returns 401
- [ ] Students cannot access other students' submissions
- [ ] Students cannot access other students' results
- [ ] Professors can access any submission
- [ ] Admins can access any submission
- [ ] IDOR attempts are logged with full details
- [ ] Server logs show user ID, role, and resource ID in IDOR logs

---

## HTTP Headers Reference

### Successful Authentication
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response Headers (Login Success)
```
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: connect.sid=...; Path=/; HttpOnly; SameSite=Lax

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...}
}
```

---

## Common Errors & Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| 401 "Missing or invalid authorization header" | No Authorization header or wrong format | Use `Authorization: Bearer <token>` |
| 401 "Invalid or expired token" | Token has been modified or expired | Login again to get new token |
| 403 "Access denied" | IDOR check failed - user doesn't own resource | Use resource owned by the user |
| 500 "Access control check failed" | Database error in IDOR check | Check database connectivity |

---

## Security Best Practices

1. **Never share tokens** - Treat JWT like a password
2. **Use HTTPS** - Tokens should only be sent over encrypted connections
3. **Store securely** - In production, store tokens in secure, httpOnly cookies
4. **Monitor logs** - Watch for IDOR attempts and unauthorized access
5. **Rotate secrets** - Change JWT_SECRET periodically (requires re-login)
6. **Set expiration** - Use short expiration times (24h is reasonable)

---

## Environment Variables

Create a `.env` file in the backend directory:

```env
JWT_SECRET=your-super-secret-key-that-is-long-and-random
NODE_ENV=production
PORT=5000
```

**Security Note:** In production:
- Generate a strong random secret (at least 32 characters)
- Store in environment variables, NEVER commit to git
- Rotate periodically
- Use different secrets for different environments

---

## References

- [JWT (JSON Web Tokens) - jwt.io](https://jwt.io/)
- [HMAC - Wikipedia](https://en.wikipedia.org/wiki/HMAC)
- [OWASP - IDOR](https://owasp.org/www-community/attacks/Insecure_Direct_Object_References)
- [OWASP - Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [Node.js jsonwebtoken package](https://github.com/auth0/node-jsonwebtoken)
