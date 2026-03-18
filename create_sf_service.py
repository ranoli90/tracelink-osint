import requests
import json
import os
import time

api_key = os.environ.get("RENDER_API_KEY", "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

data = {
    "ownerId": "tea-d6p1rv6a2pns73f4sucg",
    "name": "tracelink-spiderfoot",
    "type": "web_service",
    "env": "python",
    "repo": "https://github.com/poppopjmp/spiderfoot",
    "branch": "main",
    "buildCommand": "pip3 install -r requirements.txt",
    "startCommand": "python3 sf.py -l 0.0.0.0:$PORT",
    "region": "oregon",
    "serviceDetails": {
        "runtime": "python",
        "plan": "free"
    },
    "envVars": [
        {"key": "PORT", "value": "5001"},
        {"key": "SPIDERFOOT_UI_PORT", "value": "5001"},
        {"key": "SPIDERFOOT_PROFILE", "value": "scan"}
    ]
}

print("Waiting for rate limit...")
time.sleep(30)

print("Sending JSON:")
print(json.dumps(data, indent=2))

response = requests.post(
    "https://api.render.com/v1/services",
    headers=headers,
    json=data
)

print("\nResponse:")
print(response.status_code)
print(response.text)
