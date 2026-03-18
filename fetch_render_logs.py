import requests
import json

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
owner_id = "tea-d6p1rv6a2pns73f4sucg"
service_id = "srv-d6sofka4d50c73bs6s7g"

def get_logs():
    response = requests.get(
        "https://api.render.com/v1/logs",
        headers={"Authorization": f"Bearer {api_key}"},
        params={
            "ownerId": owner_id,
            "resource": service_id,
            "limit": 100,
            "direction": "backward"
        }
    )
    
    logs = response.json()
    
    # Save to file
    with open('logs_output.txt', 'w', encoding='utf-8') as f:
        f.write(f"Status: {response.status_code}\n")
        f.write(f"Response: {json.dumps(logs, ensure_ascii=False, indent=2)}")
    
    print(f"Logs saved to logs_output.txt")

if __name__ == "__main__":
    get_logs()
