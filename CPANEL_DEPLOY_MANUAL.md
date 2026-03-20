#!/bin/bash

# ==========================================
# MANUAL CPANEL DEPLOYMENT INSTRUCTIONS
# ==========================================
# If the script doesn't work, follow these steps manually in cPanel Terminal

echo "========================================"
echo "MANUAL CPANEL DEPLOYMENT STEPS"
echo "========================================"
echo ""
echo "1. CONNECT TO CPANEL TERMINAL"
echo "   - Open cPanel > Terminal (or SSH)"
echo ""

echo "2. NAVIGATE TO BACKEND"
echo "   Run this command:"
echo "   cd ~/public_html/oes-backend"
echo ""

echo "3. PULL LATEST CODE"
echo "   Run this command:"
echo "   git pull origin main"
echo ""
echo "   Expected output:"
echo "   Updating abcd1234..3ab9912"
echo "   Fast-forward"
echo "    package.json       | 2 +-"
echo "    src/server.js      | 15 +-"
echo ""

echo "4. INSTALL NEW DEPENDENCY"
echo "   Run this command:"
echo "   npm install"
echo ""
echo "   Expected output:"
echo "   added 16 packages"
echo "   found 0 vulnerabilities"
echo ""

echo "5. RESTART NODE.JS"
echo ""
echo "   OPTION A: Using PM2 (if available)"
echo "   Run this command:"
echo "   pm2 restart all"
echo ""
echo "   OPTION B: Using cPanel UI"
echo "   - Go to cPanel > Software > Node.js Manager"
echo "   - Select app 'oes-backend' or similar"
echo "   - Click 'Restart'"
echo ""

echo "6. VERIFY DEPLOYMENT"
echo "   Run this test command:"
echo "   curl -X POST https://oes.freshmilkstraightfromsource.com/api/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"student1\",\"password\":\"student123\"}' \\"
echo "     -H 'Origin: https://oes.freshmilkstraightfromsource.com' -v"
echo ""
echo "   Look for SET-COOKIE header in the response"
echo "   Should look like: Set-Cookie: connect.sid=...; HttpOnly; SameSite=Lax"
echo ""

echo "7. AFTER RESTART, TEST WITH PYTHON"
echo "   On your local machine, run:"
echo "   python3 /tmp/debug_cookies.py"
echo ""
echo "   Should now show:"
echo "   ✅ Set-Cookie header FOUND"
echo "   ✅ Cookies received"
echo ""

echo "========================================"
