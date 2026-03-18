import requests

response = requests.get(
    "https://api.render.com/v1/logs",
    headers={"Authorization": "Bearer rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"},
    params={
        "ownerId": "tea-d6p1rv6a2pns73f4sucg",
        "resource": "srv-d6sofka4d50c73bs6s7g",
        "limit": 50,
        "direction": "backward"
    }
)
logs = response.json().get("logs", [])
with open("logs_output.txt", "w", encoding="utf-8") as f:
    for log in logs:
        msg = log.get("message", "")
        if msg:
            f.write(msg + "\n")
print("Logs saved to logs_output.txt")
