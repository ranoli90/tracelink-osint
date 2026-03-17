#!/usr/bin/env python3
"""Create a Node.js web service on Render"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Try with Node runtime (not Docker)
# Based on Render API docs - needs different params
data = {
    "service": {
        "name": "tracelink-api",
        "type": "web_service",
        "region": "oregon",
        "repo": "https://github.com/yourusername/tracelink"  # Placeholder
    },
    "serviceDetails": {
        "env": "node",
        "buildCommand": "npm install",
        "startCommand": "npm start",
        "plan": "free"
    }
}

print("=== Creating Node.js Web Service ===")
print(json.dumps(data, indent=2))

r = requests.post(f'{BASE}/services', headers=headers, json=data)
print(f"\nStatus: {r.status_code}")
print(f"Response: {r.text[:1000]}")
