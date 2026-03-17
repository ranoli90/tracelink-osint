#!/usr/bin/env python3
"""Explore Render API endpoints"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
BASE = 'https://api.render.com/v1'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json'}

# Check various endpoints
endpoints = [
    '/disconnects',
    '/imports',
    '/deploys',
    '/gitlab',
    '/github',
    '/sync'
]

for ep in endpoints:
    r = requests.get(f'{BASE}{ep}', headers=headers)
    print(f"{ep}: {r.status_code}")
