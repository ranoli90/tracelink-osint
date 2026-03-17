#!/usr/bin/env python3
"""Find correct PostgreSQL endpoint"""
import requests

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
headers = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json', 'Accept': 'application/json'}

# Try different PostgreSQL endpoints
endpoints = [
    '/postgres',
    '/postgreses', 
    '/databases',
    '/postgres-databases',
    '/owner/postgres',
    '/services/postgres',
]

for ep in endpoints:
    r = requests.get(f'{BASE}{ep}', headers=headers)
    print(f"{ep}: {r.status_code}")
    if r.status_code == 200:
        print(f"  Data: {str(r.json())[:200]}")
