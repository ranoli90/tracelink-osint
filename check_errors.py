import requests
import json

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
owner_id = "tea-d6p1rv6a2pns73f4sucg"
service_id = "srv-d6sofka4d50c73bs6s7g"

def check_for_errors():
    url = "https://api.render.com/v1/logs"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {
        "ownerId": owner_id,
        "resource": service_id,
        "limit": 1000,
        "direction": "backward"
    }
    resp = requests.get(url, headers=headers, params=params)
    data = resp.json()
    logs = data.get("logs", [])
    errors = []
    for log in logs:
        msg = log.get("message", "")
        # Look for typical error signals
        if any(keyword in msg.lower() for keyword in ["error", "exception", "failed", "failed to", "cannot", "fail", "not found", "500", "404"]):
            # Ignore some known non-error build logs if possible, but for now let's see them
            errors.append(f"[{log.get('timestamp')}] {msg}")
    
    if errors:
        print(f"Found {len(errors)} potential error lines:")
        for err in reversed(errors[:20]): # Show oldest first of the found errors
            print(err)
    else:
        print("No obvious error lines found in last 1000 logs.")

if __name__ == "__main__":
    check_for_errors()
