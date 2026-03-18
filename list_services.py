import requests
import json

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
owner_id = "tea-d6p1rv6a2pns73f4sucg"

def list_services():
    url = f"https://api.render.com/v1/services?ownerId={owner_id}"
    headers = {"Authorization": f"Bearer {api_key}"}
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        for s in resp.json():
            print(f"ID: {s['service']['id']}, Name: {s['service']['name']}, Type: {s['service']['type']}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    list_services()
