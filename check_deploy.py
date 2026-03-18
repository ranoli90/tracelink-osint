import requests
import time
import json

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
service_id = "srv-d6sofka4d50c73bs6s7g"

print("Checking deploy status...")

while True:
    response = requests.get(
        f"https://api.render.com/v1/services/{service_id}/deploys?limit=1",
        headers={"Authorization": f"Bearer {api_key}"}
    )
    print(f"Response status code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"Error: {response.text}")
        break
        
    deploys = response.json()
    print(f"Full response: {json.dumps(deploys, indent=2)}")
    
    if not deploys or "deploy" not in deploys[0]:
        print("No deploys found")
        break
        
    status = deploys[0]["deploy"]["status"]
    print(f"Deploy status: {status}")
    
    if status == "live":
        print("Deploy is live!")
        break
    elif status in ["build_failed", "deactivated", "canceled"]:
        print(f"Deploy failed: {status}")
        break
    else:
        print(f"Waiting 15 seconds... (current status: {status})")
        time.sleep(15)
