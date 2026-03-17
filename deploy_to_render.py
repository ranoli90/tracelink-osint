import os
import requests
import json
import time

RENDER_API_KEY = "rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB"
RENDER_API_URL = "https://api.render.com/v1"
BOT_TOKEN = "8692641453:AAGZa2cgGbVw2-IZN2ivV4xLhIgFkoc2Chg"

def update_env_and_deploy():
    print("=== TASK: Render.com API Configuration & Deployment ===")
    headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(f"{RENDER_API_URL}/services", headers=headers)
        if response.status_code == 200:
            services = response.json()
            # Try to find the service. Note: previously user had 'osint-api', now we called it 'spiderfoot-core' in render.yaml
            sf_service = next((s for s in services if s['service']['name'] in ['spiderfoot-core', 'osint-api']), None)
            
            if sf_service:
                service_id = sf_service['service']['id']
                service_url = sf_service['service'].get('url', '')
                print(f"[*] Found service {sf_service['service']['name']} with ID: {service_id}")
                
                # Update Env Vars
                print("[*] Updating Environment Variables...")
                env_data = [
                    {"envVar": {"key": "PORT", "value": "5001"}},
                    {"envVar": {"key": "SPIDERFOOT_UI_PORT", "value": "5001"}},
                    {"envVar": {"key": "SPIDERFOOT_PROFILE", "value": "scan"}},
                    {"envVar": {"key": "BOT_TOKEN", "value": BOT_TOKEN}},
                    {"envVar": {"key": "WEBAPP_URL", "value": service_url}}
                ]
                env_res = requests.put(f"{RENDER_API_URL}/services/{service_id}/env-vars", headers=headers, json=env_data)
                if env_res.status_code == 200:
                    print("[*] Env vars updated successfully!")
                else:
                    print(f"[!] Failed to update env vars: {env_res.text}")

                # Update Telegram Mini App URL if we have a service URL
                if service_url:
                    print(f"[*] Updating Telegram Menu Button to point to {service_url} ...")
                    tg_url = f"https://api.telegram.org/bot{BOT_TOKEN}/setChatMenuButton"
                    tg_data = {
                        "menu_button": {
                            "type": "web_app",
                            "text": "Open Mirage UI",
                            "web_app": {
                                "url": service_url
                            }
                        }
                    }
                    requests.post(tg_url, json=tg_data)

                # Trigger deployment
                print(f"[*] Triggering deployment for {service_id}")
                deploy_res = requests.post(f"{RENDER_API_URL}/services/{service_id}/deploys", headers=headers)
                if deploy_res.status_code == 201:
                    print("[*] Deployment triggered successfully!")
                else:
                    print(f"[!] Failed to trigger deployment. {deploy_res.text}")
            else:
                print("[!] target service not found in Render account. Please run Blueprint Sync via dashboard first.")
        else:
            print(f"[!] Failed to fetch services. {response.text}")
    except Exception as e:
        print(f"[!] Error: {str(e)}")

if __name__ == "__main__":
    update_env_and_deploy()
