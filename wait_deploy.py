import requests
import time

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
service_id = "srv-d6sofka4d50c73bs6s7g"

print("Waiting for deploy to go live...")

while True:
    response = requests.get(
        f"https://api.render.com/v1/services/{service_id}/deploys?limit=1",
        headers={"Authorization": f"Bearer {api_key}"}
    )
    deploys = response.json()
    status = deploys[0]["deploy"]["status"]
    commit = deploys[0]["deploy"]["commit"]["id"][:8]
    print(f"Deploy status: {status} (commit: {commit})")
    
    if status == "live":
        print("Deploy is live!")
        break
    elif status in ["build_failed", "deactivated", "canceled"]:
        print(f"Deploy failed: {status}")
        break
    else:
        print(f"Waiting 15 seconds...")
        time.sleep(15)

print("Waiting 60 seconds for service to fully start...")
time.sleep(60)
print("Ready to fetch logs!")
