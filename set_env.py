import requests

api_key = "rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07"
service_id = "srv-d6sofka4d50c73bs6s7g"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# Set DATABASE_URL
db_url = "postgresql://osint_db_e9wl_user:se7l3ss2TySdKq07hGMgZXmjyQgSfdIT@dpg-d6sogba4d50c73bs79gg-a.oregon-postgres.render.com:5432/osint_db_e9wl"

response = requests.put(
    f"https://api.render.com/v1/services/{service_id}/env-vars/DATABASE_URL",
    headers=headers,
    json={"key": "DATABASE_URL", "value": db_url}
)

print(f"DATABASE_URL: {response.status_code} - {response.text}")
