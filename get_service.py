#!/usr/bin/env python3
"""Get existing service details"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json'}

# List services
r = requests.get(f'{BASE}/services', headers=headers)
if r.status_code == 200:
    services = r.json()
    for s in services:
        svc = s.get('service', {})
        print(f"\n=== {svc.get('name')} ===")
        print(f"Type: {svc.get('type')}")
        print(f"ID: {svc.get('id')}")
        
        # Get details
        if svc.get('type') == 'web_service':
            details = svc.get('serviceDetails', {})
            print(f"Details: {json.dumps(details, indent=2)[:1000]}")
