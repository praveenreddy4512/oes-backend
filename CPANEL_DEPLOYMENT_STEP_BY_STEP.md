# cPanel Deployment Guide - OES Backend

## 📋 Prerequisites

✅ cPanel hosting account with Node.js support
✅ MySQL database created (`freshmil_oes`)
✅ Database user created (`freshmil_oesuser / Reddys4512@`)
✅ Backend code on GitHub (`oes-backend`)
✅ Domain pointing to cPanel server

---

## 🚀 Step 1: SSH into Your cPanel Server

### Option A: Using Terminal/SSH Client

```bash
ssh freshmil_oesuser@202.88.252.190
# Enter your cPanel password
```

Or use your server's SSH credentials provided by hosting.

### Option B: Using cPanel File Manager

1. Log in to cPanel
2. Go to **File Manager**
3. Navigate to **public_html** folder

---

## 📁 Step 2: Create Application Directory

### Via SSH:

```bash
cd public_html
mkdir oes-backend
cd oes-backend
pwd  # Note this path
```

Example output:
```
/home/freshmil_oesuser/public_html/oes-backend
```

**Save this path - you'll need it later!**

### Via File Manager:

1. Right-click in public_html
2. Create New Folder
3. Name it `oes-backend`

---

## 📥 Step 3: Clone Backend Repository

### Via SSH:

```bash
cd /home/freshmil_oesuser/public_html/oes-backend

# Clone your backend repository
git clone https://github.com/praveenreddy4512/oes-backend.git .

# List files to verify
ls -la
```

You should see:
```
src/
package.json
.env.production
seed.sql
BURP_SUITE_TESTING.md
PARAMETER_MANIPULATION_TESTING.md
```

### Via cPanel File Manager:

1. Create .gitignore file with:
```
node_modules
.env
*.log
```

2. Manually upload files using cPanel File Manager

---

## ⚙️ Step 4: Create Environment File

### Via SSH:

```bash
cd /home/freshmil_oesuser/public_html/oes-backend

# Create .env file
cat > .env << EOF
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=freshmil_oesuser
DB_PASSWORD=Reddys4512@
DB_NAME=freshmil_oes
NODE_ENV=production
EOF

# Verify it was created
cat .env
```

### Via cPanel File Manager:

1. Create new file `.env`
2. Add content:
```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=freshmil_oesuser
DB_PASSWORD=Reddys4512@
DB_NAME=freshmil_oes
NODE_ENV=production
```

---

## 🗄️ Step 5: Seed Database (Optional but Recommended)

### Go to cPanel phpMyAdmin:

1. Log in to **cPanel**
2. Go to **phpMyAdmin**
3. Select database: **freshmil_oes**
4. Click **SQL** tab
5. Copy entire content from `seed.sql` file
6. Paste in SQL query box
7. Click **Go** to execute

Or import directly:

1. Click **Import** tab
2. Choose `seed.sql` from your computer
3. Click **Go**

**This creates tables and inserts test data!**

---

## 🎛️ Step 6: Setup Node.js App in cPanel

### 1. Log in to cPanel

Visit your cPanel URL (usually `https://yourdomain.com:2083`)

### 2. Find Node.js Application Manager

Search for: **"Node.js"** or **"Setup Node.js App"**

Go to: **Software → Node.js Applications**

### 3. Click "Create Application"

Fill in these fields:

| Field | Value |
|-------|-------|
| **Node.js Version** | 18.x or 20.x (latest available) |
| **Application URL** | `oes.freshmilkstraightfromsource.com` |
| **Application Root** | `/home/freshmil_oesuser/public_html/oes-backend` |
| **Application Startup File** | `src/server.js` |
| **Passenger Log File** | `/home/freshmil_oesuser/logs/oes-backend.log` |
| **Run as user** | `freshmil_oesuser` |
| **Application Mode** | `production` |

### 4. Set Environment Variables

After creating, click **Edit** and add:

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=freshmil_oesuser
DB_PASSWORD=Reddys4512@
DB_NAME=freshmil_oes
NODE_ENV=production
```

### 5. Click "Save"

cPanel will:
- ✅ Install npm dependencies
- ✅ Create virtual environment
- ✅ Set up node_modules
- ✅ Create symlink

---

## 🔄 Step 7: Restart Application

1. Go back to **Node.js Applications**
2. Find your application
3. Click **Restart** button
4. Wait 30-60 seconds
5. Check status shows **"Running"**

---

## ✅ Step 8: Verify Backend is Live

### Test Health Endpoint:

Open browser and visit:
```
https://oes.freshmilkstraightfromsource.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "API and DB are reachable"
}
```

### Via Terminal:

```bash
curl https://oes.freshmilkstraightfromsource.com/api/health
```

---

## 🧪 Step 9: Test Login Endpoint

### Test with Curl:

```bash
curl -X POST https://oes.freshmilkstraightfromsource.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","password":"student123"}'
```

Expected response:
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

### Test Vulnerable SQLi:

```bash
curl -X POST https://oes.freshmilkstraightfromsource.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin'\'' OR '\''1'\''='\''1","password":"x"}'
```

Expected vulnerable response:
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

This confirms the SQL injection vulnerability! 🎯

---

## 📊 View Logs

### In cPanel:

1. Go to **Node.js Applications**
2. Click your application
3. View **Error Logs** or **Access Logs**

### Via SSH:

```bash
tail -f /home/freshmil_oesuser/logs/oes-backend.log
```

This shows real-time logs including [⚠️ VULNERABLE] debug messages!

---

## 🔧 Troubleshooting

### Issue: Application Not Starting

**Check Application Log:**
```bash
cd /home/freshmil_oesuser/public_html/oes-backend
npm start
# Will show error if there's an issue
```

**Verify Files:**
```bash
ls -la src/
cat src/server.js | head -20
```

### Issue: Database Connection Failed

**Verify MySQL:**
```bash
mysql -u freshmil_oesuser -p
# Enter password: Reddys4512@
# Then: USE freshmil_oes;
# Then: SHOW TABLES;
```

### Issue: Port 3000 Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill it
kill -9 <PID>
```

### Issue: Permission Denied

```bash
# Fix permissions
chmod 755 /home/freshmil_oesuser/public_html/oes-backend
chmod 755 /home/freshmil_oesuser/public_html/oes-backend/src
```

---

## 🔐 SSL Certificate

### Check if HTTPS is Working:

```bash
curl -I https://oes.freshmilkstraightfromsource.com/api/health
```

Should show:
```
HTTP/2 200
Strict-Transport-Security: max-age=31536000
```

### Install SSL if Needed:

1. cPanel → **AutoSSL** or **SSL/TLS**
2. Click **Manage SSL sites**
3. Select your domain
4. Click **Install**

---

## 📱 Update Frontend to Connect

Now that backend is deployed:

### Update Frontend .env Files:

**File:** `frontend/.env.production`
```
VITE_API_URL=https://oes.freshmilkstraightfromsource.com
```

**File:** `frontend/.env`
```
VITE_API_URL=https://oes.freshmilkstraightfromsource.com
```

### Commit and Redeploy:

```bash
cd frontend
git add .env.production
git commit -m "Update backend API URL to production"
git push origin master
```

Vercel will auto-redeploy!

---

## 🧪 Full System Testing

### 1. Test Frontend-Backend Connection:

1. Go to: `https://oes-frontend-drab.vercel.app`
2. Log in with:
   - Username: `student1`
   - Password: `student123`
3. Should see Dashboard

### 2. Test with Burp Suite:

1. Enable Burp intercept
2. Try login with modified password
3. Should successfully log in with empty password (VULNERABILITY!)

### 3. Test SQL Injection:

1. Intercept login request
2. Change `{"username":"admin' OR '1'='1","password":"x"}`
3. Should log in as admin without correct password

---

## 📝 Deployment Checklist

- [ ] SSH'd into cPanel server
- [ ] Created `/oes-backend` directory
- [ ] Cloned repository from GitHub
- [ ] Created `.env` file with correct credentials
- [ ] Ran database seed file in phpMyAdmin
- [ ] Created Node.js Application in cPanel
- [ ] Set all environment variables
- [ ] Restarted application
- [ ] Health endpoint responding (200 OK)
- [ ] Login endpoint working
- [ ] SQL injection vulnerability confirmed
- [ ] Updated frontend API URL
- [ ] Frontend successfully connecting to backend
- [ ] All pages loading (Student/Professor/Admin dashboards)

---

## 🎯 Next Steps After Deployment

1. **Test all vulnerabilities** with Burp Suite
2. **Take screenshots** for lab report
3. **Document findings** in cybersecurity report
4. **Demonstrate attacks**:
   - Empty password bypass
   - SQL injection
   - Parameter manipulation
5. **Prepare fixes** for secure version
6. **Implement security patches**:
   - Parameterized queries
   - Input validation
   - Password hashing
   - Rate limiting

---

## 📞 Support

If deployment fails:

1. Check `/home/freshmil_oesuser/logs/oes-backend.log`
2. Verify MySQL database is accessible
3. Check Node.js version compatibility
4. Ensure public_html permissions are correct (755)
5. Contact hosting support with error message

---

## ✅ Deployment Complete!

Your backend is now **live at:**
```
https://oes.freshmilkstraightfromsource.com
```

Frontend and backend are now **fully integrated**! Ready for:
- ✅ Cybersecurity testing
- ✅ Vulnerability demonstration
- ✅ Burp Suite attacks
- ✅ Lab report documentation

🎉 **System is now production-ready for testing!**
