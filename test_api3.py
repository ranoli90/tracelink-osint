#!/usr/bin/env python3
"""Check exact working endpoints"""
import requests

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json'}

# Test exactly which endpoints work
endpoints = [
    ('GET', 'https://api.render.com/services'),
    ('GET', 'https://api.render.com/v1/services'),
    ('GET', 'https://api.render.com/owners/tea-d6p1rv6a2pns73f4sucg/services'),
    ('GET', 'https://api.render.com/v1/owners/tea-d6p1rv6a2pns73f4sucg/services'),
]

for method, url in endpoints:
    r = requests.request(method, url, headers=headers, timeout=15)
    print(f"{url}")
    print(f"  Status: {r.status_code}")
    if r.status_code == 200 and 'application/json' in r.headers.get('Content-Type', ''):
        try:
            data = r.json()
            print(f"  Data: {str(data)[:200]}")
        except:
            print(f"  Not JSON")
