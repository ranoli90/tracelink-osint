#!/usr/bin/env python3
"""Update OSINT service to use new GitHub repo"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
SERVICE_ID = 'srv-d6sofka4d50c73bs6s7g'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json', 'Content-Type': 'application/json'}

# Update service to use new repo (when user creates it)
# This is just a template - user needs to create GitHub repo first
new_repo = "https://github.com/YOUR_USERNAME/tracelink-osint"
new_branch = "main"

data = {
    "repo": new_repo,
    "branch": new_branch
}

print("=== Update OSINT Service Repo ===")
print(f"Service ID: {SERVICE_ID}")
print(f"New Repo: {new_repo}")
print(f"\nNote: Run this AFTER creating your GitHub repo")
print(f"Update the 'new_repo' variable with your actual repo URL")

# Uncomment below to actually update:
# r = requests.patch(f'{BASE}/services/{SERVICE_ID}', headers=headers, json=data)
# print(f"Status: {r.status_code}")
# print(f"Response: {r.text[:500]}")
