#!/usr/bin/env python3
"""Deploy to Render using the correct API"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
headers = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json', 'Accept': 'application/json'}

# First, list existing services
print("=== Existing Services ===")
r = requests.get(f'{BASE}/services', headers=headers)
if r.status_code == 200:
    services = r.json()
    for s in services:
        print(f"  - {s.get('service', {}).get('name')} ({s.get('service', {}).get('type')})")
else:
    print(f"Error: {r.status_code} - {r.text[:200]}")

# List PostgreSQL
print("\n=== PostgreSQL Databases ===")
r = requests.get(f'{BASE}/postgres', headers=headers)
if r.status_code == 200:
    dbs = r.json()
    for db in dbs:
        print(f"  - {db.get('name')}")
else:
    print(f"Error: {r.status_code}")

# Create PostgreSQL
print("\n=== Creating PostgreSQL ===")
data = {
    'name': 'tracelink-db',
    'plan': 'free',
    'databaseName': 'tracelink',
    'databaseUser': 'tracelink'
}
r = requests.post(f'{BASE}/postgres', headers=headers, json=data)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:500]}")
