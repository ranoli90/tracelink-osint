import requests
import json

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
service_id = "srv-d6sofka4d50c73bs6s7g"

def get_deploys():
    url = f"https://api.render.com/v1/services/{service_id}/deploys?limit=5"
    headers = {"Authorization": f"Bearer {api_key}"}
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        for item in resp.json():
            # Handle different JSON structures from Render API
            d = item.get('deploy', item)
            deploy_id = d.get('id', 'N/A')
            status = d.get('status', 'N/A')
            commit = d.get('commit', {}).get('id', 'N/A')[:7]
            print(f"Deploy ID: {deploy_id}, Status: {status}, Commit: {commit}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    get_deploys()
