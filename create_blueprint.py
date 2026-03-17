#!/usr/bin/env python3
"""Check Render Blueprint API"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Check if there's a blueprints endpoint
r = requests.get(f'{BASE}/blueprints', headers=headers)
print(f"=== Blueprints ===")
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:1000]}")
