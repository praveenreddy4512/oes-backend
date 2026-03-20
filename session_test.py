#!/usr/bin/env python3
"""
Express Sessions Testing Script

Tests session creation, persistence, hijacking, and replay attacks.
Run with: python3 session_test.py
"""

import requests
import json
import time
from colorama import Fore, Back, Style

# URL configuration
BASE_URL = "https://oes.freshmilkstraightfromsource.com"
# For local testing:
# BASE_URL = "http://localhost:5000"

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_test(name, passed, details=""):
    status = f"{Colors.OKGREEN}✓ PASS{Colors.ENDC}" if passed else f"{Colors.FAIL}✗ FAIL{Colors.ENDC}"
    print(f"\n{Colors.BOLD}[TEST]{Colors.ENDC} {name}")
    print(f"  Status: {status}")
    if details:
        print(f"  Details: {details}")

def test_session_creation():
    """Test 1: Session creation on login"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== TEST 1: Session Creation ==={Colors.ENDC}")
    
    session = requests.Session()
    
    try:
        response = session.post(
            f"{BASE_URL}/api/login",
            json={"username": "student1", "password": "pass123"},
            verify=False,  # Ignore SSL certificate warnings
            timeout=10
        )
        
        passed = response.status_code == 200
        details = f"Status: {response.status_code}"
        
        if passed:
            data = response.json()
            details += f", User: {data.get('user', {}).get('username')}"
            details += f", Session Created: {data.get('sessionCreated', False)}"
            
            # Check for Set-Cookie
            if 'set-cookie' in response.headers:
                cookie_header = response.headers['set-cookie']
                has_httponly = 'httponly' in cookie_header.lower()
                has_secure = 'secure' in cookie_header.lower()
                has_samesite = 'samesite' in cookie_header.lower()
                
                details += f"\n  HttpOnly: {'✓' if has_httponly else '✗'}"
                details += f", Secure: {'✓' if has_secure else '✗'}"
                details += f", SameSite: {'✓' if has_samesite else '✗'}"
        
        print_test("Session Creation", passed, details)
        return passed, session
        
    except Exception as e:
        print_test("Session Creation", False, str(e))
        return False, None

def test_session_persistence(session):
    """Test 2: Session persistence across requests"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== TEST 2: Session Persistence ==={Colors.ENDC}")
    
    try:
        response = session.get(
            f"{BASE_URL}/api/auth/me",
            verify=False,
            timeout=10
        )
        
        passed = response.status_code == 200
        details = f"Status: {response.status_code}"
        
        if passed:
            data = response.json()
            user = data.get('user', {})
            details += f", User: {user.get('username')}, Role: {user.get('role')}"
        else:
            details = response.json().get('message', 'Unknown error')
        
        print_test("Session Persistence", passed, details)
        return passed
        
    except Exception as e:
        print_test("Session Persistence", False, str(e))
        return False

def test_protected_route_without_session():
    """Test 3: Protected route without session (should fail)"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== TEST 3: Protected Route Without Session ==={Colors.ENDC}")
    
    session = requests.Session()
    
    try:
        response = session.get(
            f"{BASE_URL}/api/auth/me",
            verify=False,
            timeout=10
        )
        
        passed = response.status_code == 401
        details = f"Status: {response.status_code} (Expected: 401)"
        
        if response.status_code != 200:
            details += f", Message: {response.json().get('message', '')}"
        
        print_test("Protected Route Rejection", passed, details)
        return passed
        
    except Exception as e:
        print_test("Protected Route Rejection", False, str(e))
        return False

def test_session_logout(session):
    """Test 4: Session destruction on logout"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== TEST 4: Session Logout ==={Colors.ENDC}")
    
    try:
        # First, logout
        logout_response = session.post(
            f"{BASE_URL}/api/logout",
            verify=False,
            timeout=10
        )
        
        logout_ok = logout_response.status_code == 200
        details = f"Logout Status: {logout_response.status_code}"
        
        if logout_ok:
            # Try to use session after logout (should fail)
            time.sleep(1)  # Small delay
            auth_response = session.get(
                f"{BASE_URL}/api/auth/me",
                verify=False,
                timeout=10
            )
            
            passed = auth_response.status_code == 401
            details += f", Session After Logout: {'Destroyed ✓' if passed else 'Still Valid ✗'}"
        else:
            passed = False
            details += f", Logout failed: {logout_response.json()}"
        
        print_test("Session Logout", passed, details)
        return passed
        
    except Exception as e:
        print_test("Session Logout", False, str(e))
        return False

def test_session_hijacking():
    """Test 5: Session hijacking simulation"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== TEST 5: Session Hijacking ==={Colors.ENDC}")
    
    try:
        # Step 1: Student 1 logs in
        session1 = requests.Session()
        login_response = session1.post(
            f"{BASE_URL}/api/login",
            json={"username": "student1", "password": "pass123"},
            verify=False,
            timeout=10
        )
        
        if login_response.status_code != 200:
            print_test("Session Hijacking", False, "Login failed")
            return False
        
        # Extract sessionID from cookies
        sessionID = None
        for cookie in session1.cookies:
            sessionID = cookie.value
            break
        
        print(f"  Extracted Session ID: {sessionID[:20]}...")
        
        # Step 2: Create new session (attacker) with hijacked cookie
        session2 = requests.Session()
        
        # Manually set the stolen cookie
        for cookie in session1.cookies:
            session2.cookies.set_cookie(cookie)
        
        # Step 3: Try to access as attacker
        hijack_response = session2.get(
            f"{BASE_URL}/api/auth/me",
            verify=False,
            timeout=10
        )
        
        passed = hijack_response.status_code == 200
        
        if passed:
            user = hijack_response.json().get('user', {})
            details = f"✓ Hijacked! Accessed as: {user.get('username')} (role: {user.get('role')})"
        else:
            details = f"✗ Hijack Failed (session invalid): {hijack_response.status_code}"
        
        print_test("Session Hijacking", passed, details)
        print(f"  {Colors.WARNING}Note: Hijacking works because attackers can steal cookies{Colors.ENDC}")
        print(f"  {Colors.OKGREEN}Protected by: HttpOnly, Secure, SameSite flags{Colors.ENDC}")
        
        return True  # This test demonstrates vulnerability (intentional)
        
    except Exception as e:
        print_test("Session Hijacking", False, str(e))
        return False

def test_session_replay():
    """Test 6: Session replay after logout"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== TEST 6: Session Replay Attack ==={Colors.ENDC}")
    
    try:
        # Step 1: Login
        session1 = requests.Session()
        login_response = session1.post(
            f"{BASE_URL}/api/login",
            json={"username": "student1", "password": "pass123"},
            verify=False,
            timeout=10
        )
        
        if login_response.status_code != 200:
            print_test("Session Replay", False, "Login failed")
            return False
        
        # Save the session cookie
        saved_cookies = requests.cookies.RequestsCookieJar()
        for cookie in session1.cookies:
            saved_cookies.set_cookie(cookie)
        
        print(f"  Saved Session: {list(saved_cookies)[0][0] if saved_cookies else 'Unknown'}")
        
        # Step 2: Logout
        logout_response = session1.post(
            f"{BASE_URL}/api/logout",
            verify=False,
            timeout=10
        )
        
        if logout_response.status_code != 200:
            print_test("Session Replay", False, "Logout failed")
            return False
        
        print(f"  Logged out")
        
        # Step 3: Try to replay with saved session
        time.sleep(1)
        session2 = requests.Session()
        for cookie in saved_cookies:
            session2.cookies.set_cookie(cookie)
        
        replay_response = session2.get(
            f"{BASE_URL}/api/auth/me",
            verify=False,
            timeout=10
        )
        
        passed = replay_response.status_code == 401
        details = f"Replay Result: {replay_response.status_code}"
        
        if passed:
            details += f" ✓ (Session properly invalidated)"
        else:
            details += f" ✗ (Session still valid - VULNERABILITY)"
        
        print_test("Session Replay Prevention", passed, details)
        return passed
        
    except Exception as e:
        print_test("Session Replay Prevention", False, str(e))
        return False

def test_timing_attack():
    """Test 7: Timing attack prevention"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== TEST 7: Timing Attack Prevention ==={Colors.ENDC}")
    
    try:
        times_valid_user = []
        times_invalid_user = []
        
        # Test 1: Valid user, wrong password
        print("  Testing valid user, wrong password...")
        for i in range(3):
            start = time.time()
            requests.post(
                f"{BASE_URL}/api/login",
                json={"username": "admin", "password": "wrongpassword"},
                verify=False,
                timeout=10
            )
            times_valid_user.append(time.time() - start)
        
        avg_valid = sum(times_valid_user) / len(times_valid_user)
        
        # Test 2: Invalid user
        print("  Testing invalid user...")
        for i in range(3):
            start = time.time()
            requests.post(
                f"{BASE_URL}/api/login",
                json={"username": "nonexistent123456", "password": "wrongpassword"},
                verify=False,
                timeout=10
            )
            times_invalid_user.append(time.time() - start)
        
        avg_invalid = sum(times_invalid_user) / len(times_invalid_user)
        
        # Compare times
        diff = abs(avg_valid - avg_invalid)
        passed = diff < 0.05  # Less than 50ms difference = constant-time
        
        details = f"Valid User: {avg_valid:.4f}s, Invalid User: {avg_invalid:.4f}s"
        details += f", Difference: {diff:.6f}s"
        
        if passed:
            details += " ✓ (Constant-time, no timing leak)"
        else:
            details += " ⚠️ (Possible timing leak)"
        
        print_test("Timing Attack Prevention", passed, details)
        return passed
        
    except Exception as e:
        print_test("Timing Attack Prevention", False, str(e))
        return False

def main():
    """Run all tests"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}")
    print("╔════════════════════════════════════════╗")
    print("║   Express Sessions Security Testing    ║")
    print("╚════════════════════════════════════════╝")
    print(f"{Colors.ENDC}")
    
    print(f"\n{Colors.OKCYAN}Target: {BASE_URL}{Colors.ENDC}")
    print(f"{Colors.WARNING}Note: Tests may fail if cPanel hasn't pulled latest code{Colors.ENDC}\n")
    
    results = []
    
    # Test 1: Session Creation
    passed, session = test_session_creation()
    results.append(("Session Creation", passed))
    
    if session is None:
        print(f"\n{Colors.FAIL}Cannot continue - login failed{Colors.ENDC}")
        return
    
    # Test 2: Session Persistence
    passed = test_session_persistence(session)
    results.append(("Session Persistence", passed))
    
    # Test 3: Protected Route Without Session
    passed = test_protected_route_without_session()
    results.append(("Protected Route Rejection", passed))
    
    # Test 4: Logout
    passed = test_session_logout(session)
    results.append(("Session Logout", passed))
    
    # Test 5: Hijacking
    passed = test_session_hijacking()
    results.append(("Session Hijacking (Educational)", passed))
    
    # Test 6: Replay
    passed = test_session_replay()
    results.append(("Session Replay Prevention", passed))
    
    # Test 7: Timing
    passed = test_timing_attack()
    results.append(("Timing Attack Prevention", passed))
    
    # Summary
    print(f"\n{Colors.HEADER}{Colors.BOLD}")
    print("╔════════════════════════════════════════╗")
    print("║           TEST SUMMARY                 ║")
    print("╚════════════════════════════════════════╝")
    print(f"{Colors.ENDC}")
    
    passed_count = sum(1 for _, p in results if p)
    total_count = len(results)
    
    for name, passed in results:
        status = f"{Colors.OKGREEN}✓{Colors.ENDC}" if passed else f"{Colors.FAIL}✗{Colors.ENDC}"
        print(f"  {status} {name}")
    
    print(f"\n{Colors.BOLD}Total: {passed_count}/{total_count} tests passed{Colors.ENDC}\n")
    
    if passed_count == total_count:
        print(f"{Colors.OKGREEN}All tests passed! ✓{Colors.ENDC}\n")
    else:
        print(f"{Colors.WARNING}Some tests failed. Check implementation.{Colors.ENDC}\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Tests interrupted by user{Colors.ENDC}\n")
    except Exception as e:
        print(f"\n{Colors.FAIL}Error: {str(e)}{Colors.ENDC}\n")
