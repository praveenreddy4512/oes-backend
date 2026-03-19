# Burp Suite Testing Guide - OES Password Vulnerability

## Overview
This guide demonstrates how to use Burp Suite to intercept and analyze login requests in the Online Examination System (OES), revealing the plaintext password vulnerability.

---

## Part 1: Install Burp Suite

### Option A: Burp Suite Community (Free)
1. Download from: https://portswigger.net/burp/communitydownload
2. Install on your system
3. Launch Burp Suite
4. Click "Start Burp" (default settings are fine)

### Option B: Burp Suite Professional (Paid)
- Same installation process
- More features for advanced testing

---

## Part 2: Configure Browser Proxy

### Firefox Setup

1. **Open Firefox**
2. **Settings → Network Settings**
3. **Scroll to "Proxy Settings"**
4. **Select "Manual proxy configuration"**
5. **HTTP Proxy:** `127.0.0.1`
6. **Port:** `8080`
7. **Check "Also use this proxy for HTTPS"** (optionally, for HTTPS traffic)
8. **Click OK**

### Chrome/Chromium Setup

1. **Open Chrome**
2. **Right-click → Inspect** (DevTools)
3. **Settings (gear icon) → Network → Proxy**
4. **Or use command line:**
   ```bash
   google-chrome --proxy-server="http://127.0.0.1:8080"
   ```

### Alternative: Use FoxyProxy Extension

1. **Install FoxyProxy in Firefox/Chrome** from extension store
2. **Click FoxyProxy icon**
3. **Settings → Add a new proxy:**
   - Title: `Burp Suite`
   - Proxy IP: `127.0.0.1`
   - Port: `8080`
   - Type: `HTTP`
4. **Select "Burp Suite" to enable**

---

## Part 3: Configure Burp Suite SSL Certificate

To intercept HTTPS traffic, you need to install Burp's CA certificate:

### Windows/Linux/Mac:

1. **In Burp Suite:**
   - Go to **Settings → TLS**
   - Note the certificate location or regenerate

2. **Export Burp's Certificate:**
   - Visit `http://burp/cert` in your proxied browser
   - Download `cacert.der`
   - Save it as `burp_cert.pem` or similar

3. **Import into Browser:**
   - Firefox: Settings → Privacy & Security → Certificates → Import
   - Chrome: Settings → Privacy → Security → Manage Certificates

---

## Part 4: Test OES Login with Burp Suite

### Step 1: Start Burp Suite Interception

1. **In Burp Suite:**
   - Go to **Proxy → Intercept**
   - Ensure **"Intercept is on"** (toggle button shows enabled)

### Step 2: Access OES Frontend

1. **Navigate to:** `https://oes-frontend-drab.vercel.app/`
2. **Enter login credentials:**
   - Username: `student1`
   - Password: `student123`
3. **Click "Login"**

### Step 3: Intercept the Login Request

1. **Burp Suite will capture the request** before it's sent
2. **You'll see a popup** with the request details:

   ```
   POST /api/login HTTP/1.1
   Host: oes.freshmilkstraightfromsource.com
   Content-Type: application/json
   
   {"username":"student1","password":"student123"}
   ```

### Step 4: Analyze the Vulnerability

**CRITICAL FINDING:**
- ✗ The password is sent in **PLAIN TEXT** in the request body
- ✗ No encryption before transmission
- ✗ Visible to anyone intercepting the request
- ✗ Can be logged in browser history, server logs, and proxies

### Step 5: Demonstrate the Attack

**Option 1: View Plaintext Password in Burp**
1. In the intercepted request, you can directly read:
   ```json
   {"username":"student1","password":"student123"}
   ```

**Option 2: Modify the Password**
1. **Right-click the request** → "Do Intercepted Message Editor"
2. **Change the password in the JSON:**
   ```json
   {"username":"student1","password":"hacked123"}
   ```
3. **Click "Forward"**
4. The server will attempt login with the modified password

**Option 3: Replay the Request**
1. **Right-click the request** → "Send to Repeater"
2. **In Repeater tab:**
   - Modify any parameter
   - Click "Send"
   - View server response in real-time

---

## Part 5: Security Issues Demonstrated

### Issue 1: Plaintext Password Transmission
```
Status: CRITICAL
Evidence: {"username":"student1","password":"student123"}
Impact: Any attacker can steal credentials by intercepting traffic
```

### Issue 2: No HTTPS Enforcement
```
Status: HIGH
Backend: http://oes.freshmilkstraightfromsource.com
Solution: Must use HTTPS (currently configured, but backend needs SSL)
```

### Issue 3: Client-Side Password Visibility
```
Status: MEDIUM
Browser Console: Passwords visible in DevTools
Network Tab: Clear text in request/response
Solution: Use bcrypt/hashing before transmission
```

---

## Part 6: Fix These Vulnerabilities

### Solution 1: Use HTTPS Everywhere
```javascript
// Current: ❌ HTTP
const apiUrl = "http://oes.freshmilkstraightfromsource.com";

// Fixed: ✅ HTTPS
const apiUrl = "https://oes.freshmilkstraightfromsource.com";
```

### Solution 2: Hash Passwords Before Transmission
```javascript
// Use bcryptjs for client-side hashing
import bcrypt from 'bcryptjs';

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Before sending
const hashedPassword = await hashPassword(password);
const response = await fetch(`${apiUrl}/api/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: username,
    password: hashedPassword // Send hash, not plaintext
  })
});
```

### Solution 3: Server-Side Password Hashing (Backend)
```javascript
// backend/src/routes/users.js
import bcrypt from 'bcryptjs';

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Get user from database
  const [users] = await pool.execute(
    'SELECT * FROM users WHERE username = ?',
    [username]
  );
  
  if (users.length === 0) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  // Compare hashed password
  const validPassword = await bcrypt.compare(password, users[0].password);
  
  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  // Password is correct, proceed with login...
});
```

### Solution 4: Never Log Passwords
```javascript
// ❌ BAD
console.log('Login attempt:', username, password);

// ✅ GOOD
console.log('Login attempt:', username, '[REDACTED]');
```

### Solution 5: Implement Rate Limiting
```javascript
// backend/src/server.js
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later'
});

app.post('/api/login', loginLimiter, async (req, res) => {
  // Login logic...
});
```

---

## Part 7: Advanced Burp Suite Features

### 1. Intruder (Automated Login Testing)
```
Burp → Intruder
1. Select the login request
2. Right-click → "Send to Intruder"
3. Set payload positions (username/password)
4. Load wordlists for brute-force testing
5. Start attack
```

### 2. Scanner (Automated Vulnerability Detection)
```
Burp → Scanner
1. Crawl the OES application
2. Passive scan for vulnerabilities
3. Active scan for deeper analysis
4. View vulnerability report
```

### 3. Repeater (Manual Request Testing)
```
Burp → Repeater
1. Modify requests manually
2. Change headers, body, parameters
3. Send and compare responses
4. Test different scenarios
```

---

## Part 8: Testing Checklist

### Login Page Testing
- [ ] Intercept LOGIN request
- [ ] View plaintext password in request
- [ ] Modify password and send modified request
- [ ] Test with SQLi payload: `admin' OR '1'='1`
- [ ] Test with XSS payload: `<script>alert('xss')</script>`

### Dashboard Testing
- [ ] Intercept GET requests for exams
- [ ] Check if session token is exposed
- [ ] Intercept POST requests for exam submission
- [ ] View response data in plaintext

### Results Testing
- [ ] Intercept GET /api/results request
- [ ] Verify percentage calculation in response
- [ ] Test if you can modify results in request

### Admin Testing
- [ ] Access admin endpoints
- [ ] Check authorization headers
- [ ] Test privilege escalation (student→admin)

---

## Part 9: Expected Findings

### Critical Issues Found:
1. ✗ Plaintext password transmission
2. ✗ No HTTPS enforcement on backend
3. ✗ No input validation (SQLi possible)
4. ✗ No rate limiting on login
5. ✗ No session security headers

### High Issues Found:
1. ✗ No password hashing in database
2. ✗ Weak authentication mechanism
3. ✗ No CSRF protection
4. ✗ No content security policy

---

## Part 10: Generate Burp Report

1. **In Burp Suite:**
   - Go to **Reporting**
   - Click **"Generate Report"**
   - Select findings
   - Choose format (HTML/PDF)
   - Save as `OES_Security_Report.html`

This report documents:
- All vulnerabilities found
- Severity levels
- Proof of concept
- Remediation steps

---

## Quick Start Command

If you want to start fresh with proxy setup:

```bash
# Linux/Mac - Start Firefox with Burp proxy
firefox --no-remote -P default &
# Then manually set proxy in Firefox Preferences

# For Chrome:
google-chrome --proxy-server="http://127.0.0.1:8080"

# Start Burp Suite
java -jar burpsuite_community.jar
```

---

## Summary

**What This Demo Shows:**
- Your OES system transmits passwords in **plaintext**
- Any attacker on the network can intercept credentials
- Burp Suite makes this vulnerability easy to demonstrate
- This is why HTTPS, hashing, and rate limiting are critical

**Next Steps:**
1. Implement password hashing (bcryptjs)
2. Enforce HTTPS everywhere
3. Add rate limiting to login
4. Implement CSRF protection
5. Add input validation
6. Implement proper session management

