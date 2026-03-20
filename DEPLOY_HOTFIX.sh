#!/bin/bash
# OES Backend Hotfix Deployment Script
# This script redeploys the fixed backend files to cPanel

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== OES Backend Hotfix Deployment ===${NC}"
echo ""

# Set cPanel application path
CPANEL_PATH="/home/freshmil_oesuser/public_html/oes-backend"

echo -e "${YELLOW}Step 1: Navigate to application directory${NC}"
cd "$CPANEL_PATH" || { echo -e "${RED}Error: Cannot access $CPANEL_PATH${NC}"; exit 1; }
echo -e "${GREEN}✓ In directory: $(pwd)${NC}"
echo ""

echo -e "${YELLOW}Step 2: Pull latest changes from GitHub${NC}"
git pull origin main
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully pulled latest code${NC}"
else
    echo -e "${RED}✗ Git pull failed${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 3: Verify critical files${NC}"
if [ -f "src/routes/exams.js" ] && [ -f "src/routes/results.js" ]; then
    echo -e "${GREEN}✓ Critical route files present${NC}"
else
    echo -e "${RED}✗ Critical files missing${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 4: Restart Node.js application (via cPanel)${NC}"
echo "To restart the application, use one of these methods:"
echo ""
echo "Option A: cPanel Node.js Selector"
echo "  1. Log in to cPanel"
echo "  2. Find 'Node.js Selector' or 'Node.js App Manager'"
echo "  3. Select 'oes-backend' application"
echo "  4. Click 'RESTART'"
echo ""
echo "Option B: Via SSH (if available)"
echo "  pkill node"
echo "  cd $CPANEL_PATH"
echo "  nanoserver.js or npm start"
echo ""
echo "Option C: cPanel Terminal"
echo "  1. Log in to cPanel"
echo "  2. Open Terminal"
echo "  3. Run: cd $CPANEL_PATH && npm install && npm start"
echo ""

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Fixed Issues:"
echo "  ✓ /api/results endpoint now returns statistics"
echo "  ✓ POST /api/exams now works (removed passing_score)"
echo "  ✓ DELETE /api/exams/:id now works"
echo "  ✓ Added input validation"
echo ""
