#!/usr/bin/env python3
"""Create OSINT web service using existing repo"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Use the same repo as jobhuntin-api
data = {
    "name": "osint-api",
    "type": "web_service",
    "region": "oregon",
    "ownerId": OWNER_ID,
    "repo": "https://github.com/ranoli90/Jobhuntin",
    "branch": "main",
    "serviceDetails": {
        "env": "node",
        "buildCommand": "npm install",
        "startCommand": "node src/index.js",
        "plan": "free"
    }
}

print("=== Creating OSINT Web Service (using existing Jobhuntin repo) ===")
print(json.dumps(data, indent=2))
r = requests.post(f'{BASE}/services', headers=headers, json=data)
print(f"\nStatus: {r.status_code}")
print(f"Response: {r.text[:1500]}")
