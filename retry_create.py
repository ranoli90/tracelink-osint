import requests
import json
import os
import time

api_key = os.environ.get("RENDER_API_KEY", "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# First, add env var to osint-api for SpiderFoot URL
# (will update once SpiderFoot is deployed)

# Try creating SpiderFoot service with longer delay
print("Creating SpiderFoot service...")

data = {
    "ownerId": "tea-d6p1rv6a2pns73f4sucg",
    "name": "tracelink-spiderfoot",
    "type": "web_service",
    "env": "docker",
    "imageUrl": "smgorven/spiderfoot:latest",
    "region": "oregon",
    "serviceDetails": {
        "runtime": "docker",
        "plan": "free"
    }
}

for i in range(5):
    print(f"Attempt {i+1}...")
    time.sleep(15)
    
    response = requests.post(
        "https://api.render.com/v1/services",
        headers=headers,
        json=data
    )
    
    print(f"Status: {response.status_code}")
    if response.status_code != 429:
        print(response.text)
        break
