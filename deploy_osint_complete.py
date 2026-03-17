#!/usr/bin/env python3
"""
Complete OSINT Service Deployment Script
Creates web service, database, and configures Telegram on Render
"""
import requests
import json
import time

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg'
BOT_TOKEN = '8692641453:AAGZa2cgGbVw2-IZN2ivV4xLhIgFkoc2Chg'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

print("=" * 60)
print("OSINT Service Deployment - Render.com")
print("=" * 60)

# 1. Create Web Service
print("\n[1/4] Creating OSINT Web Service...")
service_data = {
    "name": "osint-api",
    "type": "web_service",
    "region": "oregon",
    "ownerId": OWNER_ID,
    "repo": "https://github.com/ranoli90/Jobhuntin",
    "branch": "main",
    "serviceDetails": {
        "env": "docker",
        "plan": "free",
        "envSpecificDetails": {
            "dockerCommand": "",
            "dockerContext": ".",
            "dockerfilePath": "./Dockerfile"
        }
    }
}

r = requests.post(f'{BASE}/services', headers=headers, json=service_data)
if r.status_code in [200, 201]:
    svc = r.json().get('service', {})
    SERVICE_ID = svc.get('id')
    SERVICE_URL = svc.get('serviceDetails', {}).get('url')
    print(f"✓ Service created: {SERVICE_URL}")
    print(f"  Service ID: {SERVICE_ID}")
else:
    print(f"✗ Service creation failed: {r.text[:200]}")
    SERVICE_ID = None
    SERVICE_URL = None

# 2. Create PostgreSQL Database  
print("\n[2/4] Creating PostgreSQL Database...")
db_data = {
    "name": "osint_db",
    "ownerId": OWNER_ID,
    "plan": "free",
    "region": "oregon",
    "version": "15"
}

r = requests.post(f'{BASE}/postgres', headers=headers, json=db_data)
if r.status_code in [200, 201]:
    db = r.json()
    DB_ID = db.get('id')
    DB_NAME = db.get('databaseName')
    print(f"✓ Database created: {DB_NAME}")
    print(f"  Database ID: {DB_ID}")
    # Build connection string
    DB_URL = f"postgres://{db.get('databaseUser')}:<PASSWORD>@dpg-{DB_ID.split('-')[1]}.oregon-postgres.render.com/{DB_NAME}"
    print(f"  Connection: {DB_URL}")
else:
    print(f"✗ Database creation failed: {r.text[:200]}")
    DB_ID = None
    DB_URL = None

# 3. Set Telegram Webhook
print("\n[3/4] Configuring Telegram Webhook...")
if SERVICE_URL:
    webhook_url = f"{SERVICE_URL}/telegram"
    r = requests.post(
        f'https://api.telegram.org/bot{BOT_TOKEN}/setWebhook',
        json={'url': webhook_url}
    )
    if r.json().get('ok'):
        print(f"✓ Webhook set: {webhook_url}")
    else:
        print(f"✗ Webhook failed: {r.text}")
else:
    print("✗ Skipping webhook - no service URL")

# 4. Summary
print("\n[4/4] Deployment Summary")
print("=" * 60)
print(f"Web Service URL: {SERVICE_URL}")
print(f"Service ID: {SERVICE_ID}")
print(f"Database ID: {DB_ID}")
print(f"Database Name: {DB_NAME}")
print("\n⚠️  MANUAL STEP REQUIRED:")
print("Go to Render Dashboard -> osint-api -> Environment Variables")
print("Add these variables:")
print(f"  DATABASE_URL={DB_URL or '<get from dashboard>'}")
print(f"  BOT_TOKEN={BOT_TOKEN}")
print(f"  NODE_ENV=production")
print(f"  RENDER=true")
print("=" * 60)
