#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Setup Telegram Bot Commands and Description"""
import requests
import json
import sys

TOKEN = '8692641453:AAGZa2cgGbVw2-IZN2ivV4xLhIgFkoc2Chg'
BASE_URL = f'https://api.telegram.org/bot{TOKEN}'

def set_description():
    desc = requests.post(f'{BASE_URL}/setDescription', json={
        'description': 'TraceLink OSINT Bot - Advanced OSINT scanning with 50+ modules, dark web search, threat intel, AI analysis.'
    })
    print(f'Description: {desc.status_code} - {desc.text[:200] if desc.text else "OK"}')
    return desc.ok

def set_commands():
    cmds = requests.post(f'{BASE_URL}/setMyCommands', json={
        'commands': [
            {'command': 'scan', 'description': 'Quick OSINT scan [target] [profile]'},
            {'command': 'scanfull', 'description': 'Full OSINT scan [target]'},
            {'command': 'email', 'description': 'Email OSINT [email]'},
            {'command': 'phone', 'description': 'Phone OSINT [phone]'},
            {'command': 'domain', 'description': 'Domain OSINT [domain]'},
            {'command': 'username', 'description': 'Username OSINT [username]'},
            {'command': 'darkweb', 'description': 'Dark web search [query]'},
            {'command': 'threat', 'description': 'Threat intel [indicator]'},
            {'command': 'analyze', 'description': 'AI text analysis [text]'},
            {'command': 'status', 'description': 'Check scan status'},
            {'command': 'tools', 'description': 'List available tools'},
            {'command': 'help', 'description': 'Show help'}
        ]
    })
    print(f'Commands: {cmds.status_code} - {cmds.text[:200] if cmds.text else "OK"}')
    return cmds.ok

def get_me():
    info = requests.get(f'{BASE_URL}/getMe')
    data = info.json()
    if data.get('ok'):
        bot = data['result']
        print(f"\n=== BOT VERIFIED ===")
        print(f"Name: {bot['first_name']}")
        print(f"Username: @{bot['username']}")
        print(f"ID: {bot['id']}")
    return info.ok

def set_webhook():
    # This would be set after Render deployment
    print("\nNote: Set webhook after Render deployment:")
    print(f"https://your-render-app.onrender.com/bot/webhook")

if __name__ == '__main__':
    print("Setting up Telegram bot...\n")
    set_description()
    set_commands()
    get_me()
    print("\n=== SETUP COMPLETE ===")
