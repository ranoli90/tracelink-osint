# Mini App Setup Guide

This document covers the setup and deployment of the Telegram Mini App.

## Prerequisites

1. A Telegram Bot Token (obtained from @BotFather)
2. A Netlify account with the project connected
3. The database must be migrated (see Database Setup)

## Environment Variables

Add the following environment variables to your `.env` file and Netlify site settings:

```env
# Required
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL=your_postgresql_connection_string
WEBAPP_URL=https://your-site.netlify.app

# Optional - comma-separated Telegram IDs for admin access
ADMIN_TELEGRAM_IDS=123456789,987654321
```

## BotFather Setup

1. Open Telegram and talk to @BotFather
2. Use `/newbot` to create a new bot (or select existing bot)
3. Copy the bot token
4. Run `/setmenubutton` to configure the menu button
5. Select your bot and provide the Mini App URL:
   - For Netlify: `https://your-site-name.netlify.app/app`
   - Or use your custom domain if configured

Commands:
- `/setmenubutton` - Configure the menu button
- `/setdescription` - Set bot description
- `/setabouttext` - Set about text

## Database Setup

Run the migration to create the required tables:

```bash
npm run db:migrate
```

This creates:
- `telegram_users` - Stores user information
- Adds `user_id` column to `links` and `click_events` tables

## Running Locally

1. Copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. For local testing without Telegram:
   - Use ngrok or similar to expose localhost
   - Set the webhook to your ngrok URL: `https://your-ngrok-url/bot/webhook`

## Deployment

### Netlify Deployment

The project is configured for Netlify deployment:

```bash
# Deploy to production
npm run deploy

# Or use Netlify CLI
netlify deploy --prod
```

The deployment will:
1. Install dependencies
2. Run Prisma migrations
3. Deploy the static site and functions

### Setting Webhooks

After deployment, set the Telegram webhook:

```bash
# Using curl
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://your-site.netlify.app/bot/webhook"
```

Replace `<BOT_TOKEN>` with your actual bot token.

## API Endpoints

The Mini App uses these API endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me` | Get current user info |
| GET | `/api/me/stats` | Get user statistics |
| GET | `/api/me/links` | Get user's links |
| POST | `/api/me/links` | Create a new link |
| DELETE | `/api/me/links/:trackingId` | Delete a link |
| GET | `/api/me/links/:trackingId/analytics` | Get link analytics |
| GET | `/api/me/events` | Get click events |

All endpoints require Telegram initData authentication via the `Authorization: tma <initData>` header.

## Testing

Run the unit tests:

```bash
npm test
```

The tests validate:
- HMAC signature validation
- Expiration checking
- Tampering detection

## Security

- All API requests are validated server-side using HMAC-SHA256
- User data is isolated per Telegram ID
- No user ID is trusted from client - always resolved from initData
- Rate limiting is recommended (not implemented in this version)
