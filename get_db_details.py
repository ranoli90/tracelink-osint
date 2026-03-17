#!/usr/bin/env python3
"""Get database connection info"""
import requests
import json

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
r = requests.get(
    'https://api.render.com/v1/postgres/dpg-d6sogba4d50c73bs79gg-a',
    headers={'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json'}
)
print(json.dumps(r.json(), indent=2))
