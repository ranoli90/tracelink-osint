#!/usr/bin/env python3
"""Try to update service with environment variables"""
import requests

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
SERVICE_ID = 'srv-d6sofka4d50c73bs6s7g'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Try updating service directly
db_url = "postgres://osint_db_e9wl_user:se7l3ss2TySdKq07hGMgZXmjyQgSfdIT@dpg-d6sogba4d50c73bs79gg-a.oregon-postgres.render.com/osint_db_e9wl"
bot_token = "8692641453:AAGZa2cgGbVw2-IZN2ivV4xLhIgFkoc2Chg"

# Try to get existing env vars first
r = requests.get(f'{BASE}/services/{SERVICE_ID}', headers=headers)
print(f"GET service: {r.status_code}")
if r.status_code == 200:
    svc = r.json().get('service', {})
    print(f"Service name: {svc.get('name')}")
    print(f"Has env vars: {'envVars' in svc}")
