#!/usr/bin/env python3
"""Final working script - Create OSINT web service on Render"""
import requests
import json
import os

API_KEY = os.environ.get('RENDER_API_KEY', 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB')
BASE = 'https://api.render.com/v1'
OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Check what repo the existing jobhuntin-api uses
print("=== Checking existing services for repo info ===")
r = requests.get(f'{BASE}/services', headers=headers)
if r.status_code == 200:
    services = r.json()
    for s in services:
        svc = s.get('service', {})
        if svc.get('type') == 'web_service':
            print(f"\n{svc.get('name')}:")
            print(f"  repo: {svc.get('repo')}")
            print(f"  branch: {svc.get('branch')}")
