#!/bin/bash
# GitHub Push Script - Run this in your terminal

echo "=== Pushing to GitHub ==="
echo ""
echo "First, authenticate with GitHub:"
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Create a Personal Access Token with 'repo' scope"
echo "3. Copy the token"
echo ""
echo "Then run:"
echo 'echo "YOUR_GH_TOKEN" | gh auth login --with-token'
echo ""
echo "OR just run: gh auth login"
echo ""
echo "After authentication, run these commands:"
echo ""
echo "cd c:/Users/Administrator/Desktop/grabber"
echo "gh repo create tracelink-osint --public --source=. --description 'TraceLink OSINT Telegram Mini App' --push"
echo ""
echo "This will create the repo and push all code!"
