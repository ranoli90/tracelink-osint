import requests
import json

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
owner_id = "tea-d6p1rv6a2pns73f4sucg"
service_id = "srv-d6sofka4d50c73bs6s7g"

def dump_logs():
    url = "https://api.render.com/v1/logs"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {
        "ownerId": owner_id,
        "resource": service_id,
        "limit": 1000,
        "direction": "backward"
    }
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code == 200:
        data = resp.json()
        logs = data.get("logs", [])
        with open("render_logs_dump.txt", "w", encoding="utf-8") as f:
            for log in reversed(logs):
                f.write(f"[{log.get('timestamp')}] {log.get('message')}\n")
        print(f"Dumped {len(logs)} logs to render_logs_dump.txt")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    dump_logs()
