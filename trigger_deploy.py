import requests

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
service_id = "srv-d6sofka4d50c73bs6s7g"

response = requests.post(
    f"https://api.render.com/v1/services/{service_id}/deploys",
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    json={"clearCache": "clear"}
)
print("Status:", response.status_code)
print("Response:", response.text)
