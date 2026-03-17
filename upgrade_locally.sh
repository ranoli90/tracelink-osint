#!/bin/bash
# TraceLink OSINT Local Upgrade Script
# Run this script to upgrade your local TraceLink installation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  TraceLink OSINT Local Upgrade${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check Node.js version
echo -e "${YELLOW}Checking Node.js...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ required${NC}"
    exit 1
fi
echo -e "${GREEN}Node.js version OK${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}Installing npm dependencies...${NC}"
npm install yaml node-fetch --save 2>/dev/null || npm install yaml node-fetch
echo -e "${GREEN}Dependencies installed${NC}"
echo ""

# Check if Prisma is set up
echo -e "${YELLOW}Checking Prisma setup...${NC}"
if [ ! -d "node_modules/.prisma" ]; then
    echo -e "${YELLOW}Generating Prisma client...${NC}"
    npx prisma generate
fi
echo -e "${GREEN}Prisma ready${NC}"
echo ""

# Create necessary directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p osint-results
mkdir -p src/services/osint
mkdir -p src/services/ai
echo -e "${GREEN}Directories created${NC}"
echo ""

# Check environment variables
echo -e "${YELLOW}Checking environment configuration...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env from template...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}.env created from .env.example${NC}"
        echo -e "${YELLOW}Please edit .env and add your configuration${NC}"
    fi
fi
echo ""

# Check correlation rules
echo -e "${YELLOW}Checking correlation rules...${NC}"
if [ -f "correlation-rules.yaml" ]; then
    echo -e "${GREEN}Correlation rules found${NC}"
    RULE_COUNT=$(grep -c "^  - id:" correlation-rules.yaml || echo "0")
    echo -e "${GREEN}Found $RULE_COUNT correlation rules${NC}"
else
    echo -e "${YELLOW}Warning: correlation-rules.yaml not found${NC}"
fi
echo ""

# Test database connection
echo -e "${YELLOW}Testing database connection...${NC}"
if [ -n "$DATABASE_URL" ]; then
    npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1 && \
        echo -e "${GREEN}Database connection OK${NC}" || \
        echo -e "${YELLOW}Warning: Could not connect to database${NC}"
else
    echo -e "${YELLOW}Warning: DATABASE_URL not set${NC}"
fi
echo ""

# Start the server
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}Upgrade complete!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo "To start the server:"
echo "  npm run dev    # Development"
echo "  npm start      # Production"
echo ""
echo "Available endpoints:"
echo "  GET  /api/osint-upgraded/status"
echo "  POST /api/osint-upgraded/scan"
echo "  POST /api/osint-upgraded/email"
echo "  POST /api/osint-upgraded/phone"
echo "  POST /api/osint-upgraded/domain"
echo "  POST /api/osint-upgraded/username"
echo "  POST /api/osint-upgraded/darkweb/search"
echo "  POST /api/osint-upgraded/threat"
echo ""
echo "Telegram commands:"
echo "  /scan <target>      - Quick OSINT scan"
echo "  /scanfull <target>  - Full scan"
echo "  /email <email>      - Check breaches"
echo "  /domain <domain>    - Domain research"
echo "  /darkweb <query>    - Dark web search"
echo "  /threat <indicator> - Check threats"
echo "  /analyze <scan_id>  - AI analysis"
echo ""

# Optional: Start Ollama check
echo -e "${YELLOW}Checking Ollama (optional)...${NC}"
if command -v curl &> /dev/null; then
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}Ollama is running${NC}"
    else
        echo -e "${YELLOW}Ollama not running (optional)${NC}"
        echo "  To start: ollama serve && ollama pull llama3.2"
    fi
fi
echo ""

# Optional: Start Tor check
echo -e "${YELLOW}Checking Tor proxy (optional)...${NC}"
if command -v nc &> /dev/null; then
    if nc -z 127.0.0.1 9050 2>/dev/null; then
        echo -e "${GREEN}Tor proxy is running${NC}"
    else
        echo -e "${YELLOW}Tor proxy not running (optional)${NC}"
        echo "  Install Tor or Docker image: dperson/torproxy"
    fi
fi
echo ""

echo -e "${BLUE}Happy OSINT hunting!${NC}"
