import requests

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
service_id = "srv-d6sofka4d50c73bs6s7g"
owner_id = "tea-d6p1rv6a2pns73f4sucg"

# First, let's see what filter params are available
response = requests.get(
    "https://api.render.com/v1/logs",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Accept": "text/event-stream"
    },
    params={
        "ownerId": owner_id,
        "serviceId": service_id,
        "limit": 50,
        "direction": "backward",
    },
    stream=True
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500] if response.text else 'empty'}")
