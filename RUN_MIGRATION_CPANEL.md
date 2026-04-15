# Running Database Migration in cPanel

## 🔐 Option 1: Via SSH Terminal (RECOMMENDED)

### Step 1: SSH into your cPanel server

```bash
ssh freshmil_oesuser@202.88.252.190
# Enter your cPanel password
```

### Step 2: Navigate to your backend directory

```bash
cd /home/freshmil_oesuser/public_html/oes-backend
```

### Step 3: Run the migration

```bash
node src/migrate-session-tracking.js
```

You should see:
```
🚀 Starting database migration for Session Invalidation Tracking...
➕ Adding previous_fingerprint column...
✅ previous_fingerprint added successfully.
➕ Adding session_invalidated_at column...
✅ session_invalidated_at added successfully.
✅ Migration completed successfully!
```

---

## 📋 Option 2: Via cPanel Terminal (if available)

### Step 1: Log in to cPanel
- Go to: `https://yourdomain.com:2083`
- Enter your cPanel username/password

### Step 2: Open Terminal
- Search for **"Terminal"** in cPanel
- Click **"Terminal"** (may be under Advanced menu)

### Step 3: Run the commands

```bash
cd /home/freshmil_oesuser/public_html/oes-backend
node src/migrate-session-tracking.js
```

---

## 🔧 Option 3: Via cPanel PHP Script (Alternative)

If SSH is not available, create a `run-migration.php` file:

```php
<?php
// run-migration.php
$output = shell_exec('cd ' . escapeshellarg(__DIR__) . ' && node src/migrate-session-tracking.js 2>&1');
echo "<pre>" . htmlspecialchars($output) . "</pre>";
?>
```

Then visit: `https://yourdomain.com/oes-backend/run-migration.php`

---

## ✅ Verify Migration Success

After running, check your database:

1. Log in to cPanel
2. Go to **phpMyAdmin**
3. Select database: **freshmil_oes**
4. Click on **users** table
5. Look for these new columns:
   - `previous_fingerprint` (VARCHAR 255)
   - `session_invalidated_at` (TIMESTAMP)

If they exist, migration was ✅ **SUCCESSFUL**!

---

## ⚠️ If Migration Fails

### Error: "Cannot find module..."
```bash
cd /home/freshmil_oesuser/public_html/oes-backend
npm install
```

### Error: "Database connection refused"
- Check your `.env` file:
  ```bash
  cat .env
  ```
- Verify DB credentials in cPanel MySQL settings
- Make sure MySQL service is running

### Error: "Permission denied"
```bash
chmod +x src/migrate-session-tracking.js
node src/migrate-session-tracking.js
```

---

## 🚀 After Migration

Your multi-login security is now active!

**Restart Node.js app in cPanel:**
1. Go to cPanel → **Node.js Applications**
2. Find your app
3. Click **Restart**

Done! 🎉
