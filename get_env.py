import requests
import json

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
service_id = "srv-d6sofka4d50c73bs6s7g"

response = requests.get(
    f"https://api.render.com/v1/services/{service_id}/envVars",
    headers={"Authorization": f"Bearer {api_key}"}
)
print("Status:", response.status_code)
print("Environment Variables:")
for env in response.json():
    key = env.get("key")
    value = env.get("value", "")
    # Mask sensitive values
    if "url" in key.lower() or "password" in key.lower() or "secret" in key.lower():
        value = value[:10] + "..." if len(value) > 10 else "***"
    print(f"  {key}: {value}")
