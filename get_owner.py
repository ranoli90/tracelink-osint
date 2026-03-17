#!/usr/bin/env python3
"""Get account owner info"""
import requests

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json'}

# Try to get account info
r = requests.get(f'{BASE}/account', headers=headers)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:1000]}")

# Try to get owners
r2 = requests.get(f'{BASE}/owners', headers=headers)
print(f"\n=== /owners ===")
print(f"Status: {r2.status_code}")
print(f"Response: {r2.text[:1000]}")
