#!/usr/bin/env python3
"""Set environment variables for OSINT service - check endpoint"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
SERVICE_ID = 'srv-d6sofka4d50c73bs6s7g'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Try different endpoints
print("=== Checking env var endpoints ===")

# Try service-specific endpoint
r = requests.get(f'{BASE}/services/{SERVICE_ID}/envvars', headers=headers)
print(f"/services/{SERVICE_ID}/envvars: {r.status_code}")

# Try without serviceId in body
data = {
    "key": "TEST_VAR",
    "value": "test"
}
r2 = requests.post(f'{BASE}/services/{SERVICE_ID}/envvars', headers=headers, json=data)
print(f"POST /services/{SERVICE_ID}/envvars: {r2.status_code} - {r2.text[:200]}")
