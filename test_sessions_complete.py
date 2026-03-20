#!/usr/bin/env python3
"""
================================================================================
SESSION HIJACKING TESTING SUITE
================================================================================
Complete testing workflow for OES sessions and security vulnerabilities
"""

import requests
import json
from requests.packages.urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

BASE_URL = "https://oes.freshmilkstraightfromsource.com"

def print_header(title):
    print("\n" + "="*70)
    print(f" {title}")
    print("="*70 + "\n")

def test_cors_headers():
    """Test 1: Verify CORS allows credentials"""
    print_header("TEST 1: CORS Configuration")
    
    response = requests.options(f"{BASE_URL}/api/login", verify=False)
    creds = response.headers.get('access-control-allow-credentials', 'NOT FOUND')
    
    print(f"Access-Control-Allow-Credentials: {creds}")
    
    if creds.lower() == 'true':
        print("✅ PASS: CORS credentials enabled")
        return True
    else:
        print("❌ FAIL: CORS credentials disabled")
        return False

def test_set_cookie_header():
    """Test 2: Verify Set-Cookie header is sent on login"""
    print_header("TEST 2: Set-Cookie Header on Login")
    
    response = requests.post(
        f"{BASE_URL}/api/login",
        json={"username": "student1", "password": "student123"},
        verify=False
    )
    
    print(f"Login Status: {response.status_code}")
    
    if 'set-cookie' in response.headers:
        print("✅ PASS: Set-Cookie header found")
        print(f"   {response.headers['set-cookie'][:80]}...")
        return True
    else:
        print("❌ FAIL: Set-Cookie header NOT found")
        print("   Reason: Session store may not be configured or Node.js not restarted")
        return False

def test_session_persistence():
    """Test 3: Verify session persists across requests"""
    print_header("TEST 3: Session Persistence")
    
    # Login
    login = requests.post(
        f"{BASE_URL}/api/login",
        json={"username": "student1", "password": "student123"},
        verify=False
    )
    
    if login.status_code != 200:
        print(f"❌ FAIL: Login failed ({login.status_code})")
        return False
    
    cookies = login.cookies
    
    # Try protected endpoint
    auth = requests.get(f"{BASE_URL}/api/auth/me", cookies=cookies, verify=False)
    
    if auth.status_code == 200:
        user = auth.json().get('user', {})
        print(f"✅ PASS: Session persisted")
        print(f"   User: {user.get('username')}")
        print(f"   Role: {user.get('role')}")
        return True
    else:
        print(f"❌ FAIL: Could not access protected route ({auth.status_code})")
        return False

def test_session_hijacking():
    """Test 4: Demonstrate session hijacking vulnerability"""
    print_header("TEST 4: Session Hijacking Attack")
    
    # Victim login
    victim_login = requests.post(
        f"{BASE_URL}/api/login",
        json={"username": "student1", "password": "student123"},
        verify=False
    )
    
    if victim_login.status_code != 200:
        print("❌ FAIL: Could not login victim")
        return False
    
    victim_cookies = victim_login.cookies
    print("✅ Victim logged in, session cookie captured")
    
    # Attacker reuses stolen cookie
    attacker = requests.get(f"{BASE_URL}/api/auth/me", cookies=victim_cookies, verify=False)
    
    if attacker.status_code == 200:
        user = attacker.json().get('user', {})
        print("✅ VULNERABILITY CONFIRMED: Session hijacking possible!")
        print(f"   Attacker impersonating: {user.get('username')}")
        print(f"   Attacker can access: exams, grades, submissions, profile")
        return True
    else:
        print("❌ FAIL: Could not hijack session")
        return False

def test_logout():
    """Test 5: Verify session is destroyed on logout"""
    print_header("TEST 5: Session Logout")
    
    # Login
    login = requests.post(
        f"{BASE_URL}/api/login",
        json={"username": "student1", "password": "student123"},
        verify=False
    )
    
    if login.status_code != 200:
        print("❌ FAIL: Login failed")
        return False
    
    cookies = login.cookies
    
    # Logout
    logout = requests.post(f"{BASE_URL}/api/logout", cookies=cookies, verify=False)
    
    if logout.status_code != 200:
        print(f"❌ FAIL: Logout failed ({logout.status_code})")
        return False
    
    print("✅ Logout successful")
    
    # Try to access protected route
    auth = requests.get(f"{BASE_URL}/api/auth/me", cookies=cookies, verify=False)
    
    if auth.status_code == 401:
        print("✅ PASS: Session properly destroyed (401 Unauthorized)")
        return True
    else:
        print(f"❌ FAIL: Session still valid after logout ({auth.status_code})")
        return False

def run_all_tests():
    """Run all tests and report results"""
    print_header("SESSION SECURITY TEST SUITE")
    print(f"Target: {BASE_URL}\n")
    
    results = {
        "CORS Configuration": test_cors_headers(),
        "Set-Cookie Header": test_set_cookie_header(),
        "Session Persistence": test_session_persistence(),
        "Session Hijacking": test_session_hijacking(),
        "Session Logout": test_logout(),
    }
    
    # Summary
    print_header("TEST SUMMARY")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed\n")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - SESSION SYSTEM WORKING!")
        print("\nYour OES backend now has:")
        print("  ✅ CORS credentials enabled")
        print("  ✅ Session cookies being sent")
        print("  ✅ Session persistence across requests")
        print("  ✅ Session hijacking vulnerability (for educational purposes)")
        print("  ✅ Proper logout with session destruction")
    elif passed >= 2:
        print("⚠️  PARTIAL SUCCESS - Some features working")
        print("\nLikeliest issue: Node.js hasn't been restarted in cPanel")
        print("Steps to fix:")
        print("  1. cPanel > Software > Node.js Manager")
        print("  2. Select 'oes-backend' and click Restart")
        print("  3. Wait 30 seconds")
        print("  4. Run this test again")
    else:
        print("❌ TESTS FAILING - Deployment incomplete")
        print("\nChecklist:")
        print("  1. Run in cPanel terminal: cd ~/public_html/oes-backend")
        print("  2. Run: git pull origin main")
        print("  3. Run: npm install")
        print("  4. Restart Node.js from cPanel")
    
    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
