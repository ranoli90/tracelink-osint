import requests
import json

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
owner_id = "tea-d6p1rv6a2pns73f4sucg"
service_id = "srv-d6sofka4d50c73bs6s7g"

def debug_logs():
    url = "https://api.render.com/v1/logs"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {
        "ownerId": owner_id,
        "resource": service_id,
        "limit": 10,
        "direction": "backward"
    }
    resp = requests.get(url, headers=headers, params=params)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text[:1000]}")

if __name__ == "__main__":
    debug_logs()
