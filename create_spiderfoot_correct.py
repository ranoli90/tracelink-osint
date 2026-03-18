import requests
import json
import os
import time

api_key = os.environ.get("RENDER_API_KEY", "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# EXACT complete structure - ALL FIELDS
data = {
    "type": "web",
    "name": "tracelink-spiderfoot",
    "ownerId": "tea-d6p1rv6a2pns73f4sucg",
    "region": "oregon",
    "runtime": "image",
    "image": "docker.io/smgorven/spiderfoot:latest",
    "plan": "free",
    "serviceDetails": {
        "plan": "free",
        "buildPlan": "starter",
        "env": "image",
        "runtime": "image",
        "region": "oregon",
        "healthCheckPath": "",
        "ipAllowList": [{"cidrBlock": "0.0.0.0/0", "description": "everywhere"}],
        "maintenanceMode": {"enabled": False, "uri": ""},
        "numInstances": 1,
        "openPorts": [{"port": 5001, "protocol": "TCP"}],
        "previews": {"generation": "off"},
        "pullRequestPreviewsEnabled": "no",
        "cache": {"profile": "no-cache"}
    },
    "envVars": [
        {"key": "PORT", "value": "5001"},
        {"key": "SPIDERFOOT_HOST", "value": "0.0.0.0"},
        {"key": "SPIDERFOOT_PORT", "value": "5001"}
    ],
    "autoDeploy": "no",
    "notifyOnFail": "default"
}

# Add debug output to see exact JSON being sent
def create_service_with_retry(max_attempts=3):
    for attempt in range(max_attempts):
        print(f"Attempt {attempt + 1}/{max_attempts}")
        print("Sending JSON:")
        print(json.dumps(data, indent=2))
        
        try:
            response = requests.post(
                "https://api.render.com/v1/services",
                headers=headers,
                json=data
            )
            
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 201:
                print("✅ Service created successfully!")
                return True
            elif response.status_code == 429:
                reset_time = int(response.headers.get('ratelimit-reset', 60))
                print(f"Rate limited. Waiting {reset_time} seconds...")
                time.sleep(reset_time)
            else:
                print(f"Error: {response.text}")
                if attempt < max_attempts - 1:
                    time.sleep(30)
        except Exception as e:
            print(f"Exception: {e}")
            if attempt < max_attempts - 1:
                time.sleep(30)
    
    return False

if __name__ == "__main__":
    print("Creating SpiderFoot service on Render...")
    success = create_service_with_retry()
    
    if success:
        print("\nNext steps:")
        print("1. Wait for service to deploy")
        print("2. Add SPIDERFOOT_URL env var to osint-api")
        print("3. Test the integration")
    else:
        print("\nFailed to create service. Try manual creation via dashboard.")
