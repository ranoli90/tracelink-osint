import requests
import sys

response = requests.get(
    "https://api.render.com/v1/logs",
    headers={"Authorization": "Bearer rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"},
    params={
        "ownerId": "tea-d6p1rv6a2pns73f4sucg",
        "resource": "srv-d6sofka4d50c73bs6s7g",
        "limit": 100,
        "direction": "backward"
    }
)
print("Status:", response.status_code, file=sys.stderr)
logs = response.json().get("logs", [])
print("Total logs:", len(logs), file=sys.stderr)
for log in reversed(logs):
    msg = log.get("message", "")
    print(msg)
