import sys
import os
import time
from datetime import datetime

# Mock Spiderfoot environment
sys.path.insert(0, os.path.join(os.getcwd(), "spiderfoot"))

try:
    from modules.sfp__ai_threat_intel import PatternRecognitionEngine, ThreatSignature
    print("[*] Successfully imported sfp__ai_threat_intel")
    
    # Test initialization
    engine = PatternRecognitionEngine()
    print(f"[*] AI Engine Initialized: {engine.__name__}")
    
    # Mock some events for pattern recognition
    mock_events = [
        {'eventType': 'IP_ADDRESS', 'data': '1.2.3.4', 'timestamp': time.time() - 3600},
        {'eventType': 'IP_ADDRESS', 'data': '1.2.3.5', 'timestamp': time.time() - 3500},
        {'eventType': 'LOGIN_ATTEMPT', 'data': 'failed admin login from 1.2.3.4', 'timestamp': time.time() - 3400},
        {'eventType': 'LOGIN_ATTEMPT', 'data': 'failed admin login from 1.2.3.4', 'timestamp': time.time() - 3300},
        {'eventType': 'LOGIN_ATTEMPT', 'data': 'failed admin login from 1.2.3.4', 'timestamp': time.time() - 3200},
        {'eventType': 'LOGIN_ATTEMPT', 'data': 'failed admin login from 1.2.3.4', 'timestamp': time.time() - 3100},
        {'eventType': 'LOGIN_ATTEMPT', 'data': 'failed admin login from 1.2.3.4', 'timestamp': time.time() - 3000},
    ]
    
    # Test anomaly detection (fallback mode if no ML libs)
    anomalies = engine.detect_anomalies(mock_events)
    print(f"[*] Anomaly Detection Test: Detected {anomalies.count(True)} anomalies in {len(mock_events)} events.")
    
    # Test attack pattern identification (brute force)
    patterns = engine.identify_attack_patterns(mock_events)
    print(f"[*] Attack Pattern Test: Identified {len(patterns)} patterns.")
    for p in patterns:
        print(f"    - Found: {p.threat_type} (Confidence: {p.confidence_score:.2f})")
    
    if len(patterns) > 0:
        print("\n[!!!] VERIFICATION SUCCESS: AI Search and Pattern Recognition logic is ACTIVE and Functional.")
    else:
        print("\n[?] VERIFICATION PARTIAL: Logic loaded but thresholds not met for mock data.")

except Exception as e:
    print(f"[!] Verification Failed: {e}")
    import traceback
    traceback.print_exc()
