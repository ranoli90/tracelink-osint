#!/usr/bin/env python3
"""Set environment variables for OSINT service"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
SERVICE_ID = 'srv-d6sofka4d50c73bs6s7g'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Environment variables to set
env_vars = [
    {"key": "DATABASE_URL", "value": "postgres://osint_db_e9wl_user:PASSWORD@dpg-d6sogba4d50c73bs79gg-a.oregon-postgres.render.com/osint_db_e9wl"},
    {"key": "BOT_TOKEN", "value": "8692641453:AAGZa2cgGbVw2-IZN2ivV4xLhIgFkoc2Chg"},
    {"key": "NODE_ENV", "value": "production"},
    {"key": "RENDER", "value": "true"}
]

print("=== Setting Environment Variables ===")
for ev in env_vars:
    data = {
        "key": ev["key"],
        "value": ev["value"],
        "serviceId": SERVICE_ID
    }
    r = requests.post(f'{BASE}/envvars', headers=headers, json=data)
    print(f"{ev['key']}: {r.status_code}")
