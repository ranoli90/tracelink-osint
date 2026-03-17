#!/usr/bin/env python3
"""Create PostgreSQL database for OSINT"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Create PostgreSQL for OSINT
data = {
    "name": "osint_db",
    "ownerId": OWNER_ID,
    "plan": "free",
    "region": "oregon",
    "version": "15"
}

print("=== Creating PostgreSQL Database ===")
r = requests.post(f'{BASE}/postgres', headers=headers, json=data)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:1500]}")
