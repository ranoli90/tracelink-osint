#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Manual Render Deployment Helper
Generates commands to deploy to Render.com manually
"""
import json

# Configuration
TELEGRAM_BOT_TOKEN = "8692641453:AAGZa2cgGbVw2-IZN2ivV4xLhIgFkoc2Chg"
RENDER_API_KEY = "rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def main():
    print_section("RENDER.COM DEPLOYMENT INSTRUCTIONS")
    
    print("Your Telegram Bot is already configured!")
    print(f"Bot: @tracklinkosint_bot")
    print(f"Token: {TELEGRAM_BOT_TOKEN}")
    print(f"Commands: /scan, /scanfull, /email, /phone, /domain, /username, /darkweb, /threat, /analyze, /status, /tools, /help")
    
    print_section("STEP 1: Create PostgreSQL Database")
    print("""
1. Go to https://dashboard.render.com
2. Click "New +" and select "PostgreSQL"
3. Configure:
   - Name: tracelink-db
   - Database Name: tracelink
   - Database User: tracelink
   - Plan: $7/month (or $0 for free tier)
4. Click "Create Database"
5. Copy the "Internal Database URL" (starts with postgresql://)
""")

    print_section("STEP 2: Create Redis (Optional)")
    print("""
1. Go to https://dashboard.render.com
2. Click "New +" and select "Redis"
3. Configure:
   - Name: tracelink-redis
   - Plan: $5/month (or $0 for free tier)
4. Click "Create Redis"
5. Copy the "Internal Redis URL"
""")

    print_section("STEP 3: Create Web Service")
    print("""
1. Go to https://dashboard.render.com
2. Click "New +" and select "Web Service"
3. Configure:
   - Name: tracelink-osint
   - Environment: Node
   - Build Command: npm install && npx prisma generate
   - Start Command: npm start
   - Plan: $7/month (Free tier may work)
4. Under "Environment" tab, add these variables:
   
   KEY                    VALUE
   -----                  -----
   BOT_TOKEN              {0}
   DATABASE_URL           (paste from Step 1)
   REDIS_URL              (paste from Step 2, optional)
   NODE_ENV               production
   PORT                   3000
   SESSION_SECRET         (generate a random 32+ char string)
   WEBAPP_URL             https://your-service.onrender.com
   BASE_URL               https://your-service.onrender.com

5. Click "Create Web Service"
6. Wait for deployment to complete (2-5 minutes)
""".format(TELEGRAM_BOT_TOKEN))

    print_section("STEP 4: Set Webhook")
    print("""
After deployment completes:
1. Copy your Render service URL (e.g., https://tracelink-osint.onrender.com)
2. Set the webhook by running:
   
   curl -X POST "https://api.telegram.org/bot{0}/setWebhook" \\
        -d "url=https://YOUR_SERVICE.onrender.com/bot/webhook"

   (Replace YOUR_SERVICE with your actual Render service name)
""".format(TELEGRAM_BOT_TOKEN))

    print_section("STEP 5: Test Your Bot")
    print("""
1. Open Telegram and message @tracklinkosint_bot
2. Send /start to initialize
3. Try commands:
   - /scan example.com basic
   - /tools
   - /help
""")

    print_section("DEPLOYMENT COMPLETE!")
    print(f"""
Summary:
- Bot Token: {TELEGRAM_BOT_TOKEN}
- Bot Username: @tracklinkosint_bot
- Render API Key: {RENDER_API_KEY[:10]}... (hidden)

Next Steps:
1. Create PostgreSQL on Render dashboard
2. Create Web Service with environment variables
3. Set webhook URL
4. Test bot commands
""")

if __name__ == '__main__':
    main()
