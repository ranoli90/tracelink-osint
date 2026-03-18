#!/bin/sh
echo "--- Starting TraceLink OSINT Setup ---"
cd /app

# Run Prisma migrations
npx prisma migrate deploy

# Get DATABASE_URL from environment and configure for SpiderFoot with SSL
# The main app uses this for PostgreSQL, we need to add sslmode for SpiderFoot
if [ -n "$DATABASE_URL" ]; then
    # Convert DATABASE_URL to SpiderFoot format with SSL
    # Format: postgresql://user:pass@host:5432/dbname?sslmode=require
    SF_POSTGRES_DSN="${DATABASE_URL}?sslmode=require"
    export SF_POSTGRES_DNS="$SF_POSTGRES_DSN"
    echo "Configured SpiderFoot PostgreSQL with SSL"
fi

# Function to install OSINT tools in background to speed up startup
install_tools() {
    echo "Starting background installation of OSINT tools..."
    
    # Install SpiderFoot
    if [ ! -d "/app/spiderfoot" ]; then
        # Clone SpiderFoot - use version 3.3.0 which has simpler structure
        git clone --depth 1 --branch 3.3.0 https://github.com/smicallef/spiderfoot.git /app/spiderfoot 2>/dev/null || \
        git clone --depth 1 https://github.com/smicallef/spiderfoot.git /app/spiderfoot
        cd /app/spiderfoot
        # Install requirements without editable install
        pip3 install --no-cache-dir --break-system-packages -r requirements.txt
        # Add spiderfoot to Python path so modules can be imported
        export PYTHONPATH="/app/spiderfoot:$PYTHONPATH"
        cd /app
    else
        export PYTHONPATH="/app/spiderfoot:$PYTHONPATH"
    fi
    
    # Install Sherlock if not already available
    if ! command -v sherlock >/dev/null 2>&1; then
        pip3 install --no-cache-dir --break-system-packages git+https://github.com/sherlock-project/sherlock.git
    fi
    
    echo "Background tool installation complete."
    
    # Start SpiderFoot API after installation
    # SpiderFoot uses PostgreSQL for local data storage
    if [ -f "/app/spiderfoot/sfapi.py" ]; then
        # Pass PostgreSQL DSN if available
        if [ -n "$SF_POSTGRES_DNS" ]; then
            python3 /app/spiderfoot/sfapi.py -l 0.0.0.0:5001 -d "$SF_POSTGRES_DNS" &
        else
            python3 /app/spiderfoot/sfapi.py -l 0.0.0.0:5001 &
        fi
        echo "SpiderFoot API started on port 5001"
    fi
}

# Start background installation
install_tools &

# Start the main Node application immediately
node src/index.js
