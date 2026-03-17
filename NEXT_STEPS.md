# Next Steps - TraceLink OSINT Upgrade

## Quick Start Commands

Execute these commands in order to complete the upgrade:

### 1. Install Required Dependencies

```bash
# Install additional npm packages
npm install yaml node-fetch

# Install OSINT tools (optional - for local scanning)
# pip install sherlock maigret holehe phoneinfoga spiderfoot
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Database Migration (if needed)

```bash
# Create migration for new tables
npx prisma migrate dev --name add_osint_scans
```

### 4. Start Local Server

```bash
# Development mode
npm run dev

# Or production
npm start
```

### 5. Test the API

```bash
# Check API health
curl http://localhost:3000/api/osint-upgraded/status

# Run a quick scan
curl -X POST http://localhost:3000/api/osint-upgraded/scan \
  -H "Content-Type: application/json" \
  -d '{"target": "test@example.com", "quick": true}'
```

### 6. Configure Telegram Bot

```bash
# Set your bot token
export BOT_TOKEN=your_bot_token_here

# Set admin IDs
export ADMIN_TELEGRAM_IDS=your_telegram_id

# Start bot (in another terminal)
node -e "import('./src/bot/telegramUpgraded.js').then(m => m.startBotLongPolling())"
```

## Render.com Deployment

### Option A: Using Python Script

```bash
# Install Python dependencies (if needed)
pip install requests pyyaml

# Check connection
python deploy_to_render.py --check

# Deploy with blueprint
python deploy_to_render.py --blueprint

# Create environment group
python deploy_to_render.py --env-group
```

### Option B: Using Render CLI

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Deploy blueprint
render blueprint apply render.yaml --yes

# Or deploy from Git
render create service --repo https://github.com/your-repo/tracelink --name tracelink-api
```

## Configuration Checklist

- [ ] Configure `BOT_TOKEN` in environment
- [ ] Set `ADMIN_TELEGRAM_IDS` 
- [ ] Set `DATABASE_URL` (auto-configured on Render)
- [ ] Set `REDIS_URL` (auto-configured on Render)
- [ ] Configure API keys (optional):
  - `SHODAN_API_KEY`
  - `HUNTER_API_KEY`
  - `ABUSEIPDB_API_KEY`
  - `ALIENVAULT_API_KEY`
- [ ] Configure Ollama (optional):
  - `OLLAMA_HOST`
  - `OLLAMA_PORT`
  - `OLLAMA_MODEL`

## Testing New Features

### Test Enhanced Scanner

```bash
# Test email scan
curl -X POST http://localhost:3000/api/osint-upgraded/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Test domain scan
curl -X POST http://localhost:3000/api/osint-upgraded/domain \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com"}'

# Test username search
curl -X POST http://localhost:3000/api/osint-upgraded/username \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser"}'
```

### Test Dark Web Scanner

```bash
# Search dark web
curl -X POST http://localhost:3000/api/osint-upgraded/darkweb/search \
  -H "Content-Type: application/json" \
  -d '{"query": "stolen credentials"}'

# Check threat feeds
curl -X POST http://localhost:3000/api/osint-upgraded/threat \
  -H "Content-Type: application/json" \
  -d '{"indicator": "8.8.8.8"}'
```

### Test Telegram Commands

Send these commands to your bot:

```
/start
/help
/scan test@example.com
/domain example.com
/tools
/status
```

### Test AI Analysis

```bash
# After running a scan, get AI summary
curl http://localhost:3000/api/osint-upgraded/analyze/{scan_id}

# Or generate a full report
curl -X POST http://localhost:3000/api/osint-upgraded/analyze/report \
  -H "Content-Type: application/json" \
  -d '{"scanId": "your_scan_id"}'
```

## Verify Installation

Check these files were created:

```bash
# List created files
ls -la src/services/osint/
ls -la src/services/ai/
ls -la src/bot/
ls -la src/routes/
ls -la correlation-rules.yaml
ls -la render.yaml
ls -la .env.render
ls -la deploy_to_render.py
```

## Troubleshooting

### Issue: Module not found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Prisma errors

```bash
# Reset Prisma
npx prisma migrate reset
npx prisma generate
```

### Issue: Telegram bot not responding

1. Check bot token is correct
2. Verify webhook is set (for production)
3. Check admin IDs are configured

### Issue: Ollama not connecting

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Or start Ollama
ollama serve
ollama pull llama3.2
```

## API Reference

Base URL: `http://localhost:3000/api/osint-upgraded`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | API status |
| GET | `/modules` | Available modules |
| POST | `/scan` | Run OSINT scan |
| POST | `/email` | Email lookup |
| POST | `/phone` | Phone lookup |
| POST | `/domain` | Domain research |
| POST | `/username` | Username search |
| POST | `/darkweb/search` | Dark web search |
| POST | `/threat` | Threat feed check |
| POST | `/correlate` | Correlation analysis |
| GET | `/analyze/:scanId` | AI analysis |
| GET | `/scan/:scanId` | Get scan results |

## Support

For issues and questions:
1. Check UPGRADE.md for detailed documentation
2. Review correlation-rules.yaml for rule configurations
3. Check server logs for error details
