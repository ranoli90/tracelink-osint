#!/usr/bin/env python3
"""Create a web service on Render"""
import requests

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg'
BASE = 'https://api.render.com/v1'
headers = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json', 'Accept': 'application/json'}

# Get PostgreSQL info
print("=== PostgreSQL Info ===")
r = requests.get(f'{BASE}/postgres', headers=headers)
if r.status_code == 200:
    dbs = r.json()
    for db in dbs:
        p = db.get('postgres', {})
        print(f"  - {p.get('databaseName')}")
        print(f"    ID: {p.get('id')}")
        print(f"    Connection: {p.get('connectionString')}")

# Create a web service
print("\n=== Creating Web Service ===")
service_data = {
    'ownerId': OWNER_ID,
    'type': 'web_service',
    'name': 'tracelink-osint',
    'region': 'ohio',
    'plan': 'free',
    'runtime': 'node',
    'buildCommand': 'npm install && npx prisma generate',
    'startCommand': 'npm start',
    'envVars': [
        {'key': 'BOT_TOKEN', 'value': '8692641453:AAGZa2cgGbVw2-IZN2ivV4xLhIgFkoc2Chg'},
        {'key': 'NODE_ENV', 'value': 'production'},
    ]
}

r = requests.post(f'{BASE}/services', headers=headers, json=service_data)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:1000]}")
