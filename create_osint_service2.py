#!/usr/bin/env python3
"""Create OSINT web service on Render with ownerID in body"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Include ownerID in the service body
data = {
    "service": {
        "name": "osint-api",
        "type": "web_service",
        "region": "oregon",
        "ownerId": OWNER_ID,
        "repo": "https://github.com/yourusername/tracelink"
    },
    "serviceDetails": {
        "env": "node",
        "buildCommand": "npm install",
        "startCommand": "node src/index.js",
        "plan": "free"
    }
}

print("=== Creating OSINT Web Service (with ownerID in body) ===")
r = requests.post(f'{BASE}/services', headers=headers, json=data)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:1500]}")
