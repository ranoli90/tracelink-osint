# TraceLink OSINT Upgrade Documentation

## Overview

This document describes the comprehensive upgrade from the base TraceLink application to the enhanced TraceLink OSINT platform with advanced scanning, dark web monitoring, correlation engine, and AI-powered analysis.

## Version History

- **v1.0.0** - Base TraceLink application (link tracking, fingerprinting, basic OSINT)
- **v2.0.0** - Enhanced OSINT platform (this upgrade)

## New Features

### 1. Enhanced OSINT Scanner (`src/services/osint/enhancedScanner.js`)

The enhanced scanner provides 50+ OSINT modules across multiple categories:

| Category | Modules |
|----------|---------|
| Social Media | maigret, sherlock, social-analyzer, instagram, twitter, facebook, linkedin, tiktok, reddit, github, mastodon |
| Email & Identity | holehe, emailformat, hunter, breachdirectory, dehashed, emailrep, haveibeenpwned, ghostproject |
| Phone & Telecom | phoneinfoga, phonenumbers, truecaller, twilio-lookup |
| Domain & Infrastructure | spiderfoot, amass, subfinder, assetfinder, whois, dnsenum, dnsrecon, shodan, censys |
| Network & IP | nmap, masscan, netcraft, ipinfo, ipapi, bgpview, robtex, circl |
| Dark Web | tor-exit-nodes, onion-crawl, ahmia, darksearch |

#### Usage

```javascript
import EnhancedScanner from './services/osint/enhancedScanner.js';

const scanner = new EnhancedScanner();

// Quick scan
const result = await scanner.runComprehensiveScan('user@example.com', { quick: true });

// Full scan
const result = await scanner.runComprehensiveScan('example.com', { comprehensive: true });

// Specific categories
const result = await scanner.runComprehensiveScan('target', { 
    categories: ['SOCIAL', 'EMAIL'] 
});
```

### 2. Dark Web Scanner (`src/services/osint/darkWebScanner.js`)

Comprehensive dark web scanning capabilities:

- **Search Engines**: Ahmia, Torch, NotEvil, Haystak, DarkSearch
- **Breach Databases**: Dehashed, BreachDirectory, HudsonRock
- **Threat Feeds**: AlienVault, AbuseIPDB, URLhaus, ThreatFox
- **Onion Scanning**: HSv3 service scanning
- **Tor Intelligence**: Exit node detection, circuit info

#### Usage

```javascript
import DarkWebScanner from './services/osint/darkWebScanner.js';

const scanner = new DarkWebScanner();

// Search dark web
const results = await scanner.searchDarkWeb('query');

// Check threat feeds
const threatResults = await scanner.checkThreatFeeds('8.8.8.8');

// Check Tor exit nodes
const torStatus = await scanner.checkTorExitNode('1.2.3.4');
```

### 3. Correlation Engine (`src/services/osint/correlationEngine.js`)

YAML-based correlation rules engine with 95+ rules:

- **Rule Types**: indicator_match, threshold, sequence, anomaly, enrichment
- **Severity Levels**: critical, high, medium, low, info
- **Actions**: log, webhook, notify, block, enrich
- **Caching**: Configurable TTL for performance

#### Configuration

Rules are loaded from `correlation-rules.yaml` which includes rules for:
- Identity & Breach Detection (20 rules)
- Social Media Analysis (15 rules)
- Phone & Telecom (10 rules)
- Domain & Infrastructure (15 rules)
- Network & IP (15 rules)
- Dark Web (10 rules)
- Threat Intelligence (10 rules)

#### Usage

```javascript
import CorrelationEngine from './services/osint/correlationEngine.js';

const engine = new CorrelationEngine();
await engine.loadRulesFromYAML('./correlation-rules.yaml');

// Evaluate indicators
const results = await engine.evaluate({
    email: 'user@example.com',
    riskScore: 75,
    breaches: ['LinkedIn', 'Adobe']
});
```

### 4. AI Integration (`src/services/ai/ollamaClient.js`)

Ollama-powered AI analysis:

- **Summarization**: OSINT scan results summary
- **Threat Analysis**: Risk assessment and recommendations
- **Entity Extraction**: IOCs from text
- **Report Generation**: Comprehensive reports

#### Usage

```javascript
import OllamaClient from './services/ai/ollamaClient.js';

const ollama = new OllamaClient({
    host: 'ollama',
    port: 11434,
    model: 'llama3.2'
});

// Summarize scan results
const summary = await ollama.summarizeResults(scanResults);

// Threat analysis
const analysis = await ollama.analyzeThreat(indicators);

// Generate report
const report = await ollama.generateReport(data);
```

### 5. Upgraded Telegram Bot (`src/bot/telegramUpgraded.js`)

New commands for the Telegram bot:

| Command | Description |
|---------|-------------|
| `/scan <target>` | Quick OSINT scan |
| `/scanfull <target>` | Comprehensive scan |
| `/email <email>` | Check email breaches |
| `/phone <number>` | Phone lookup |
| `/domain <domain>` | Domain research |
| `/username <name>` | Social media search |
| `/darkweb <query>` | Dark web search |
| `/threat <indicator>` | Check threat feeds |
| `/analyze <scan_id>` | AI summary |
| `/tools` | List available tools |
| `/status` | Bot and API status |

### 6. Upgraded Routes (`src/routes/osintUpgraded.js`)

New API endpoints:

```
POST /api/osint-upgraded/scan          - Run scan
POST /api/osint-upgraded/email          - Email lookup
POST /api/osint-upgraded/phone          - Phone lookup
POST /api/osint-upgraded/domain         - Domain research
POST /api/osint-upgraded/username       - Username search
POST /api/osint-upgraded/darkweb/search - Dark web search
POST /api/osint-upgraded/darkweb/scan   - Onion scan
POST /api/osint-upgraded/threat         - Threat check
POST /api/osint-upgraded/correlate      - Run correlation
GET  /api/osint-upgraded/analyze/:scanId - AI analysis
POST /api/osint-upgraded/analyze/threat  - Threat analysis
```

## Database Schema Updates

The upgrade requires the following Prisma schema additions:

```prisma
// New model for OSINT scans
model OsintScan {
  id          String   @id @default(cuid())
  scanId      String   @unique
  userId      BigInt
  target      String
  targetType  String
  scanType    String
  results     Json?
  correlations Json?
  riskScore   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Environment Variables

### Required

```env
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token
ADMIN_TELEGRAM_IDS=comma_separated_ids

# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...
```

### Optional API Keys

```env
# OSINT Tools
SHODAN_API_KEY=
HUNTER_API_KEY=
HIBP_API_KEY=
DEHASHED_API_KEY=
BREACHDIRECTORY_API_KEY=
ABUSEIPDB_API_KEY=
ALIENVAULT_API_KEY=

# AI
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
OLLAMA_MODEL=llama3.2

# Dark Web
TOR_PROXY=socks5://127.0.0.1:9050
```

## Deployment

### Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Start development server
npm run dev
```

### Render.com Deployment

Using the provided `render.yaml` blueprint:

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Deploy blueprint
render blueprint apply render.yaml
```

Or use the Python deployment script:

```bash
# Check connection
python deploy_to_render.py --check

# Deploy with blueprint
python deploy_to_render.py --blueprint
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Telegram Bot                        │
│              (telegramUpgraded.js)                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  Express Routes                        │
│              (osintUpgraded.js)                        │
└──────┬──────────────┬──────────────┬──────────────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────────┬──────────────┬──────────────┐
│  Enhanced    │   Dark Web   │  Correlation │
│  Scanner     │   Scanner    │    Engine    │
└──────┬───────┴──────┬───────┴──────┬───────┘
       │              │              │
       ▼              ▼              ▼
┌─────────────────────────────────────────────────────────┐
│                    Ollama AI                          │
│               (ollamaClient.js)                        │
└─────────────────────────────────────────────────────────┘
```

## Security Considerations

1. **API Key Protection**: Store all API keys as environment variables
2. **Rate Limiting**: Implement rate limiting for all OSINT endpoints
3. **Authentication**: All scan endpoints require admin authentication
4. **Data Retention**: Configure automatic cleanup of old scan results
5. **Tor Security**: Use Tor proxy for dark web scanning only

## Troubleshooting

### Common Issues

1. **Ollama Not Connecting**
   - Ensure Ollama is running and accessible
   - Check firewall rules
   - Verify network configuration

2. **Dark Web Scans Failing**
   - Verify Tor proxy is running
   - Check network connectivity
   - Some dark web services may be temporarily unavailable

3. **Correlation Rules Not Loading**
   - Validate YAML syntax
   - Check file path
   - Ensure rules directory exists

## License

This upgrade is provided as part of the TraceLink OSINT platform.
