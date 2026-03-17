#!/usr/bin/env python3
"""Try different Render API endpoints to find working ones"""
import requests

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
headers = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json'}

# Test various endpoints
tests = [
    # Root
    ('GET', 'https://api.render.com/v1'),
    ('GET', 'https://api.render.com/'),
    
    # Services
    ('GET', 'https://api.render.com/v1/services'),
    ('GET', 'https://api.render.com/v1/owners/tea-d6p1rv6a2pns73f4sucg/services'),
    
    # Databases
    ('GET', 'https://api.render.com/v1/postgres'),
    ('GET', 'https://api.render.com/v1/databases'),
    ('GET', 'https://api.render.com/v1/owners/tea-d6p1rv6a2pns73f4sucg/postgres'),
    ('GET', 'https://api.render.com/v1/owners/tea-d6p1rv6a2pns73f4sucg/databases'),
    
    # Alternative
    ('GET', 'https://dashboard.api.render.com/v1/services'),
    ('GET', 'https://render.com/api/v1/services'),
]

for method, url in tests:
    try:
        r = requests.request(method, url, headers=headers, timeout=10)
        print(f"{url.split('/v1/')[-1]}: {r.status_code}")
    except Exception as e:
        print(f"{url.split('/v1/')[-1]}: ERROR - {e}")
