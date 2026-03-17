#!/usr/bin/env python3
"""Configure Telegram webhook for OSINT service"""
import requests

BOT_TOKEN = '8692641453:AAGZa2cgGbVw2-IZN2ivV4xLhIgFkoc2Chg'
WEBHOOK_URL = 'https://osint-api-6t21.onrender.com/telegram'

# Set Telegram webhook
url = f'https://api.telegram.org/bot{BOT_TOKEN}/setWebhook'
data = {'url': WEBHOOK_URL}

print("=== Setting Telegram Webhook ===")
print(f"URL: {url}")
print(f"Webhook: {WEBHOOK_URL}")

r = requests.post(url, json=data)
print(f"Status: {r.status_code}")
print(f"Response: {r.text}")
