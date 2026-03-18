import requests
import json

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
owner_id = "tea-d6p1rv6a2pns73f4sucg"
service_id = "srv-d6sofka4d50c73bs6s7g"

def latest_log():
    url = "https://api.render.com/v1/logs"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {
        "ownerId": owner_id,
        "resource": service_id,
        "limit": 1,
        "direction": "backward"
    }
    resp = requests.get(url, headers=headers, params=params)
    data = resp.json()
    logs = data.get("logs", [])
    if logs:
        print(f"Latest Log Timestamp: {logs[0]['timestamp']}")
        print(f"Latest Log Message: {logs[0]['message']}")
    else:
        print("No logs found for srv-d6sofka4d50c73bs6s7g")

if __name__ == "__main__":
    latest_log()
