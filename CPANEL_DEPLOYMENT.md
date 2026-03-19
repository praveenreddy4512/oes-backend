# cPanel Deployment Guide - OES Backend

## Prerequisites
- cPanel hosting account with Node.js support
- MySQL database already created (`freshmil_oes`)
- GitHub account with `oes-backend` repository

---

## Deployment Steps

### Step 1: Create Node.js Application in cPanel

1. **Login to cPanel**
2. Go to **Node.js Selector** or **Setup Node.js App**
3. Click **Create Application**
4. Configure:
   ```
   Node.js Version: 18.x (or latest)
   Application Mode: Production
   Application root: /home/username/public_html/oes-api
   Application Startup File: src/server.js
   Application URL: api.freshmilonline.com (or your subdomain)
   ```
5. Click **Create**

### Step 2: Deploy from GitHub

**Option A: Using cPanel Git Deployment (Recommended)**

1. In cPanel → **Git Integration**
2. Click **Create**
3. Configure:
   - Repository URL: `https://github.com/praveenreddy4512/oes-backend.git`
   - Repository Branch: `main`
   - Application root: `/home/username/public_html/oes-api`
4. Click **Create Repository**
5. After deployment, cPanel will auto-run `npm install`

**Option B: Manual Git Clone via SSH**

```bash
cd ~/public_html
git clone https://github.com/praveenreddy4512/oes-backend.git oes-api
cd oes-api
npm install
```

### Step 3: Set Environment Variables

In cPanel → **Setup Node.js App** → Edit Application:

Add these environment variables:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=freshmil_oesuser
DB_PASSWORD=Reddys4512@
DB_NAME=freshmil_oes
NODE_ENV=production
PORT=3000
```

Or copy `.env.production` to cPanel:
```bash
cp .env.production .env
```

### Step 4: Install Dependencies

cPanel auto-runs `npm install`, but if not:

In cPanel → **Terminal** (if available):
```bash
cd ~/public_html/oes-api
npm install
npm run dev
```

### Step 5: Restart Application

In cPanel → **Setup Node.js App** → Click **Restart**

---

## Verify Deployment

**Test health endpoint:**
```bash
curl https://api.freshmilonline.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "API and DB are reachable"
}
```

**Test login:**
```bash
curl -X POST https://api.freshmilonline.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","password":"student123"}'
```

---

## Update Frontend

In `frontend/.env.production`:
```
VITE_API_URL=https://api.freshmilonline.com
```

Then redeploy frontend to Vercel.

---

## Database Connection Issues

**Error: "connect ECONNREFUSED 127.0.0.1:3306"**

Solutions:
1. Check MySQL is running: `cPanel → MySQL Databases`
2. Verify credentials in `.env`
3. Check database `freshmil_oes` exists
4. Verify user `freshmil_oesuser` has permissions

**To import SQL schema:**
1. Go to cPanel → phpMyAdmin
2. Select database `freshmil_oes`
3. Click SQL tab
4. Paste schema from `sql/setup.sql`
5. Click Go

---

## Auto-Updates from GitHub

**To pull latest changes:**

In cPanel → **Git Integration** → Click your app → **Pull**

Or via terminal:
```bash
cd ~/public_html/oes-api
git pull origin main
npm install
npm start
```

---

## Troubleshooting

**Port already in use:**
- cPanel assigns port automatically in Node.js Selector
- Don't hardcode PORT, let cPanel manage it

**Module not found:**
```bash
cd ~/public_html/oes-api
npm install --save-dev
npm install
```

**Database connection timeout:**
- Check cPanel MySQL is running
- Verify firewall isn't blocking connections

---

## Support

For issues:
1. Check cPanel error logs: `~public_html/logs/`
2. Check Node app logs: cPanel → Setup Node.js App → Manage App
3. Test locally first: `npm run dev`

---

**Backend URL:** `https://api.freshmilonline.com`
**Frontend URL:** `https://yourdomain.vercel.app`
