#!/usr/bin/env python3
"""Test Render API and list/create services"""
import requests
import json
import sys

API_KEY = 'rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB'
OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg'
BASE_URL = 'https://api.render.com/v1'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

def test_connection():
    """Test basic API connection"""
    r = requests.get(f'{BASE_URL}/owners/{OWNER_ID}', headers=headers)
    print(f"Connection test: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"  Owner: {data.get('name')} ({data.get('email')})")
        return True
    print(f"  Error: {r.text[:200]}")
    return False

def list_services():
    """List existing services"""
    r = requests.get(f'{BASE_URL}/owners/{OWNER_ID}/services', headers=headers)
    print(f"\nList services: {r.status_code}")
    if r.status_code == 200:
        services = r.json()
        print(f"  Found {len(services)} services:")
        for s in services:
            print(f"    - {s.get('name')} ({s.get('type')}) - {s.get('id')}")
        return services
    print(f"  Error: {r.text[:200]}")
    return []

def list_postgres():
    """List PostgreSQL databases"""
    r = requests.get(f'{BASE_URL}/owners/{OWNER_ID}/postgres', headers=headers)
    print(f"\nList PostgreSQL: {r.status_code}")
    if r.status_code == 200:
        dbs = r.json()
        print(f"  Found {len(dbs)} databases:")
        for db in dbs:
            print(f"    - {db.get('name')} ({db.get('id')})")
        return dbs
    print(f"  Error: {r.text[:200]}")
    return []

def create_postgres():
    """Create a PostgreSQL database"""
    data = {
        'name': 'tracelink-db',
        'plan': 'free',
        'databaseName': 'tracelink',
        'databaseUser': 'tracelink'
    }
    r = requests.post(f'{BASE_URL}/owners/{OWNER_ID}/postgres', headers=headers, json=data)
    print(f"\nCreate PostgreSQL: {r.status_code}")
    if r.status_code in [200, 201]:
        db = r.json()
        print(f"  Created: {db.get('name')} ({db.get('id')})")
        return db
    print(f"  Error: {r.text[:500]}")
    return None

if __name__ == '__main__':
    print("=== Render API Test ===\n")
    
    if not test_connection():
        print("Failed to connect to Render API")
        sys.exit(1)
    
    services = list_services()
    dbs = list_postgres()
    
    # Create database if none exists
    if not dbs:
        print("\nNo databases found. Creating one...")
        create_postgres()
        list_postgres()
