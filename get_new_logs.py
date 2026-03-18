import requests
import sys

response = requests.get(
    "https://api.render.com/v1/logs",
    headers={"Authorization": "Bearer rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"},
    params={
        "ownerId": "tea-d6p1rv6a2pns73f4sucg",
        "resource": "srv-d6sofka4d50c73bs6s7g",
        "limit": 30,
        "direction": "backward"
    }
)
logs = response.json().get("logs", [])
# Get only the newest logs
for log in logs:
    msg = log.get("message", "")
    # Skip empty messages
    if msg:
        try:
            print(msg)
        except:
            print(repr(msg))
