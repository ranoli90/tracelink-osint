# OSINT Telegram Mini App - Complete Deployment Guide

## Current Status

### ✅ Created on Render.com:
- **Web Service**: `osint-api` (srv-d6sofka4d50c73bs6s7g)
- **URL**: https://osint-api-6t21.onrender.com
- **Database**: `osint_db` (dpg-d6sogba4d50c73bs79gg-a)
- **Telegram Webhook**: ✅ Set to `/bot/webhook`

### ⚠️ Manual Steps Required:

## Step 1: Push Code to GitHub

Since Render deploys from GitHub, you need to push your code:

```bash
# In your local terminal with the code:
cd c:/Users/Administrator/Desktop/grabber

# Create a new repo on GitHub (via web or CLI)
# Then:
git init
git add .
git commit -m "Initial OSINT Telegram Mini App"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tracelink-osint.git
git push -u origin main
```

## Step 2: Update Render Service

After pushing to GitHub, run:
```bash
python update_osint_repo.py
# Edit the file to use your actual repo URL
# Then uncomment the patch line
```

## Step 3: Set Environment Variables

Go to **Render Dashboard → osint-api → Environment** and add:

```
DATABASE_URL=postgres://osint_db_e9wl_user:se7l3ss2TySdKq07hGMgZXmjyQgSfdIT@dpg-d6sogba4d50c73bs79gg-a.oregon-postgres.render.com/osint_db_e9wl
BOT_TOKEN=8692641453:AAGZa2cgGbVw2-IZN2ivV4xLhIgFkoc2Chg
NODE_ENV=production
PORT=3000
WEBAPP_URL=https://osint-api-6t21.onrender.com
BASE_URL=https://osint-api-6t21.onrender.com
```

## Step 4: Test

Send `/start` to your Telegram bot - it should reply with:
- Welcome message
- "Open Dashboard" button that launches the Mini App

## Features Included:

### Telegram Mini App:
- ✅ Bottom-left "Open Dashboard" button
- ✅ WebApp SDK integration
- ✅ Dark/Light theme support
- ✅ Link maker/tracking features
- ✅ Analytics dashboard

### OSINT Features:
- ✅ Enhanced scanner
- ✅ Dark web scanner
- ✅ Correlation engine
- ✅ AI integration (Ollama)

### Telegram Bot Commands:
- `/start` - Opens Mini App with WebApp button
- `/admin` - Admin dashboard
- `/help` - Help message

## Files Created:
- `Dockerfile` - Container config for Render
- `deploy_osint_complete.py` - Complete deploy script
- `update_osint_repo.py` - Update service repo
- `.env.render` - Environment template
