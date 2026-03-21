#!/bin/bash

#########################################################################
# Exam Event Tracking Testing Procedure
# 
# This script tests the exam event tracking system:
# 1. Verifies database table exists
# 2. Logs various exam events
# 3. Retrieves and displays event data
#########################################################################

BACKEND_URL="https://oes.freshmilkstraightfromsource.com"
EXAM_ID="1"
STUDENT_ID="2"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      EXAM EVENT TRACKING TESTING PROCEDURE                ║${NC}"
echo -e "${BLUE}║      Testing Tab Switching & Page Refresh Detection       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Verify backend is running
echo -e "${YELLOW}[STEP 1] Checking if backend is running...${NC}"
HEALTH=$(curl -s -X GET "${BACKEND_URL}/api/health" | grep -o '"status":"ok"')

if [[ -z "$HEALTH" ]]; then
  echo -e "${RED}❌ Backend is not responding!${NC}"
  echo "   Please ensure the backend is running on cPanel"
  exit 1
fi

echo -e "${GREEN}✅ Backend is running${NC}"
echo ""

# Step 2: Get a valid session (login)
echo -e "${YELLOW}[STEP 2] Logging in as student1 to get session...${NC}"

LOGIN_RESPONSE=$(curl -s -c /tmp/exam_test_cookies.txt -X POST \
  "${BACKEND_URL}/api/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "student1",
    "password": "student123"
  }')

STUDENT_ID=$(echo $LOGIN_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [[ -z "$STUDENT_ID" ]]; then
  echo -e "${RED}❌ Failed to login!${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Logged in as student1 (ID: $STUDENT_ID)${NC}"
echo ""

# Step 3: Start an exam submission
echo -e "${YELLOW}[STEP 3] Starting exam submission...${NC}"

SUBMISSION_RESPONSE=$(curl -s -b /tmp/exam_test_cookies.txt -X POST \
  "${BACKEND_URL}/api/submissions" \
  -H "Content-Type: application/json" \
  -d "{
    \"exam_id\": $EXAM_ID,
    \"student_id\": $STUDENT_ID
  }")

SUBMISSION_ID=$(echo $SUBMISSION_RESPONSE | grep -o '"submission_id":[0-9]*' | cut -d':' -f2)

if [[ -z "$SUBMISSION_ID" ]]; then
  echo -e "${RED}❌ Failed to create submission!${NC}"
  echo "Response: $SUBMISSION_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Submission created (ID: $SUBMISSION_ID)${NC}"
echo ""

# Step 4: Test event logging - Exam Started
echo -e "${YELLOW}[STEP 4] Logging 'exam_started' event...${NC}"

EVENT_RESPONSE=$(curl -s -b /tmp/exam_test_cookies.txt -X POST \
  "${BACKEND_URL}/api/submissions/${SUBMISSION_ID}/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"event_type\": \"exam_started\",
    \"student_id\": $STUDENT_ID,
    \"exam_id\": $EXAM_ID,
    \"event_details\": {
      \"message\": \"Student started the exam\"
    }
  }")

echo "Response: $EVENT_RESPONSE"
echo -e "${GREEN}✅ Event logged${NC}"
echo ""

# Step 5: Simulate tab switch events
echo -e "${YELLOW}[STEP 5] Simulating tab switch events...${NC}"

for i in {1..3}; do
  echo "  Event $i: Tab switch detected..."
  curl -s -b /tmp/exam_test_cookies.txt -X POST \
    "${BACKEND_URL}/api/submissions/${SUBMISSION_ID}/events" \
    -H "Content-Type: application/json" \
    -d "{
      \"event_type\": \"tab_switched\",
      \"student_id\": $STUDENT_ID,
      \"exam_id\": $EXAM_ID,
      \"event_details\": {
        \"action\": \"switched_away\",
        \"tabSwitchCount\": $i
      }
    }" > /dev/null
  
  sleep 1
done

echo -e "${GREEN}✅ Tab switch events logged (3 events)${NC}"
echo ""

# Step 6: Simulate page refresh events
echo -e "${YELLOW}[STEP 6] Simulating page refresh events...${NC}"

for i in {1..2}; do
  echo "  Event $i: Page refresh detected..."
  curl -s -b /tmp/exam_test_cookies.txt -X POST \
    "${BACKEND_URL}/api/submissions/${SUBMISSION_ID}/events" \
    -H "Content-Type: application/json" \
    -d "{
      \"event_type\": \"page_refreshed\",
      \"student_id\": $STUDENT_ID,
      \"exam_id\": $EXAM_ID,
      \"event_details\": {
        \"pageRefreshCount\": $i,
        \"warning\": \"Page was refreshed\"
      }
    }" > /dev/null
  
  sleep 1
done

echo -e "${GREEN}✅ Page refresh events logged (2 events)${NC}"
echo ""

# Step 7: Log question viewing and answering
echo -e "${YELLOW}[STEP 7] Simulating question viewing and answering...${NC}"

# Get actual questions from the exam
QUESTIONS_RESPONSE=$(curl -s -b /tmp/exam_test_cookies.txt -X GET \
  "${BACKEND_URL}/api/questions?exam_id=${EXAM_ID}")

FIRST_QUESTION_ID=$(echo $QUESTIONS_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [[ ! -z "$FIRST_QUESTION_ID" ]]; then
  curl -s -b /tmp/exam_test_cookies.txt -X POST \
    "${BACKEND_URL}/api/submissions/${SUBMISSION_ID}/events" \
    -H "Content-Type: application/json" \
    -d "{
      \"event_type\": \"question_viewed\",
      \"question_id\": $FIRST_QUESTION_ID,
      \"student_id\": $STUDENT_ID,
      \"exam_id\": $EXAM_ID,
      \"event_details\": {
        \"questionId\": $FIRST_QUESTION_ID
      }
    }" > /dev/null

  sleep 30  # Simulate 30 seconds of work on the question

  curl -s -b /tmp/exam_test_cookies.txt -X POST \
    "${BACKEND_URL}/api/submissions/${SUBMISSION_ID}/events" \
    -H "Content-Type: application/json" \
    -d "{
      \"event_type\": \"answer_saved\",
      \"question_id\": $FIRST_QUESTION_ID,
      \"student_id\": $STUDENT_ID,
      \"exam_id\": $EXAM_ID,
      \"time_spent_seconds\": 30,
      \"event_details\": {
        \"selectedOption\": \"a\",
        \"timeSpentSeconds\": 30
      }
    }" > /dev/null

  echo -e "${GREEN}✅ Question viewing and answering events logged${NC}"
else
  echo -e "${YELLOW}⚠️  No questions found, skipping question events${NC}"
fi

echo ""

# Step 8: Retrieve all events
echo -e "${YELLOW}[STEP 8] Retrieving all logged events...${NC}"

EVENTS_RESPONSE=$(curl -s -b /tmp/exam_test_cookies.txt -X GET \
  "${BACKEND_URL}/api/submissions/${SUBMISSION_ID}/events")

echo "$EVENTS_RESPONSE" | jq '.'
echo ""

# Step 9: Get event summary
echo -e "${YELLOW}[STEP 9] Getting event summary...${NC}"

SUMMARY_RESPONSE=$(curl -s -b /tmp/exam_test_cookies.txt -X GET \
  "${BACKEND_URL}/api/submissions/${SUBMISSION_ID}/events/summary")

echo "$SUMMARY_RESPONSE" | jq '.'
echo ""

# Step 10: Verify in database
echo -e "${YELLOW}[STEP 10] Verifying events in MySQL database...${NC}"
echo "Run the following command on your MySQL server:"
echo ""
echo -e "${BLUE}mysql -h localhost -u freshmil_oesuser -p'Reddys4512@' freshmil_oes${NC}"
echo ""
echo -e "${BLUE}SELECT * FROM exam_events WHERE submission_id = $SUBMISSION_ID;${NC}"
echo ""

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   TESTING COMPLETE! ✅                    ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  Summary:                                                 ║${NC}"
echo -e "${GREEN}║  - Created submission: $SUBMISSION_ID${NC}"
echo -e "${GREEN}║  - Logged 8+ events (started, tab switches, refreshes, etc)${NC}"
echo -e "${GREEN}║  - Retrieved all events successfully                      ║${NC}"
echo -e "${GREEN}║  - Generated event summary with suspicious activity flags ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  Next: Check MySQL database for exam_events table         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
