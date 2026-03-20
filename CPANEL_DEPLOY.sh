#!/bin/bash

# ==========================================
# CPANEL DEPLOYMENT SCRIPT
# ==========================================
# Run this in cPanel terminal to deploy latest code
# Usage: bash CPANEL_DEPLOY.sh

echo "========================================"
echo "OES BACKEND CPANEL DEPLOYMENT"
echo "========================================"
echo ""

# Step 1: Navigate to backend directory
echo "[STEP 1] Navigating to backend directory..."
cd ~/public_html/oes-backend || cd ~/oes-backend || cd ./oes-backend
if [ $? -ne 0 ]; then
    echo "❌ Failed to find backend directory"
    echo "   Please adjust path and try again"
    exit 1
fi
echo "✅ In backend directory: $(pwd)"
echo ""

# Step 2: Check git status
echo "[STEP 2] Checking git status..."
git status
echo ""

# Step 3: Pull latest code
echo "[STEP 3] Pulling latest code from GitHub..."
git pull origin main
if [ $? -ne 0 ]; then
    echo "❌ Git pull failed"
    exit 1
fi
echo "✅ Code pulled successfully"
echo ""

# Step 4: Install dependencies
echo "[STEP 4] Installing npm dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi
echo "✅ Dependencies installed"
echo ""

# Step 5: Restart Node.js
echo "[STEP 5] Restarting Node.js..."
if command -v pm2 &> /dev/null; then
    echo "   Using PM2..."
    pm2 restart all
    echo "✅ Node.js restarted with PM2"
else
    echo "   PM2 not found in PATH"
    echo "   You can also restart from cPanel:"
    echo "   - cPanel > Software > Node.js Manager > Restart"
    echo ""
fi
echo ""

# Step 6: Verify
echo "[STEP 6] Deployment complete!"
echo "========================================"
echo "✅ SESSION FIX DEPLOYED"
echo "========================================"
echo ""
echo "NEXT: Test the sessions with:"
echo "  curl -X POST https://oes.freshmilkstraightfromsource.com/api/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"student1\",\"password\":\"student123\"}' -v"
echo ""
echo "Look for 'Set-Cookie' header in response!"
echo ""
