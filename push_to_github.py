#!/usr/bin/env python3
"""Push code to GitHub using GitHub API"""
import requests
import base64
import os

# GitHub configuration
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')  # Need user's token
REPO_NAME = 'tracelink-osint'
ORG = 'ranoli90'  # Using same org as jobhuntin

# Files to upload (we'll just do a simple push)
# This requires a personal access token with repo scope

print("=" * 60)
print("Push to GitHub")
print("=" * 60)

# Check if user has GitHub token
if not GITHUB_TOKEN:
    print("\n⚠️  GITHUB_TOKEN not set")
    print("\nTo push to GitHub, you need to:")
    print("1. Go to https://github.com/settings/tokens")
    print("2. Create a personal access token with 'repo' scope")
    print("3. Set it as GITHUB_TOKEN environment variable")
    print("\nOr use these commands in your terminal:")
    print(f"""
    cd c:/Users/Administrator/Desktop/grabber
    
    # Create repo on GitHub (via web)
    # Then push:
    git init
    git add .
    git commit -m "TraceLink OSINT Telegram Mini App"
    git branch -M main
    git remote add origin https://github.com/{ORG}/{REPO_NAME}.git
    git push -u origin main
    """)
