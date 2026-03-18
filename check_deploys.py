import requests
import json

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
service_id = "srv-d6sofka4d50c73bs6s7g"

response = requests.get(
    f"https://api.render.com/v1/services/{service_id}/deploys?limit=5",
    headers={"Authorization": f"Bearer {api_key}"}
)
print("Recent deploys:")
for d in response.json():
    commit_id = d['deploy']['commit']['id'][:8]
    status = d['deploy']['status']
    trigger = d['deploy']['trigger']
    print(f"  Commit: {commit_id} - Status: {status} - Trigger: {trigger}")
