#!/usr/bin/env python3
"""Create OSINT web service on Render - try different format"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Try with ownerId at top level and without service wrapper
data = {
    "name": "osint-api",
    "type": "web_service",
    "region": "oregon",
    "ownerId": OWNER_ID,
    "repo": "https://github.com/yourusername/tracelink",
    "env": "node",
    "buildCommand": "npm install",
    "startCommand": "node src/index.js",
    "plan": "free"
}

print("=== Creating OSINT Web Service (flat format) ===")
r = requests.post(f'{BASE}/services', headers=headers, json=data)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:1500]}")
