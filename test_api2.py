#!/usr/bin/env python3
"""Try Render API at root level"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json'}

# Test at root level - no /v1
tests = [
    ('GET', 'https://api.render.com/services'),
    ('GET', 'https://api.render.com/postgres'),
    ('GET', 'https://api.render.com/databases'),
    ('GET', 'https://api.render.com/owners/tea-d6p1rv6a2pns73f4sucg/services'),
    ('GET', 'https://api.render.com/owners/tea-d6p1rv6a2pns73f4sucg/postgres'),
]

for method, url in tests:
    try:
        r = requests.request(method, url, headers=headers, timeout=10)
        print(f"\n{url}")
        print(f"  Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"  Items: {len(data) if isinstance(data, list) else 'object'}")
            if isinstance(data, list) and len(data) > 0:
                for item in data[:3]:
                    print(f"    - {item.get('name', item.get('id', 'unknown'))}")
        elif r.status_code != 404:
            print(f"  Response: {r.text[:200]}")
    except Exception as e:
        print(f"{url}: ERROR - {e}")
