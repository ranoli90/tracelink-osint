#!/usr/bin/env python3
"""Create OSINT web service - using Docker like existing jobhuntin-api"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Use Docker like existing jobhuntin-api
data = {
    "name": "osint-api",
    "type": "web_service",
    "region": "oregon",
    "ownerId": OWNER_ID,
    "repo": "https://github.com/ranoli90/Jobhuntin",
    "branch": "main",
    "serviceDetails": {
        "env": "docker",
        "plan": "free",
        "envSpecificDetails": {
            "dockerCommand": "",
            "dockerContext": ".",
            "dockerfilePath": "./Dockerfile"
        }
    }
}

print("=== Creating OSINT Web Service (Docker) ===")
print(json.dumps(data, indent=2))
r = requests.post(f'{BASE}/services', headers=headers, json=data)
print(f"\nStatus: {r.status_code}")
print(f"Response: {r.text[:1500]}")
