#!/bin/sh
echo "--- Starting TraceLink OSINT Setup ---"
cd /app

# Run Prisma migrations
npx prisma migrate deploy

# Function to install OSINT tools in background to speed up startup
install_tools() {
    echo "Starting background installation of OSINT tools..."
    
    # Install SpiderFoot
    if [ ! -d "/app/spiderfoot" ]; then
        git clone --depth 1 https://github.com/poppopjmp/spiderfoot.git /app/spiderfoot
        cd /app/spiderfoot
        pip3 install --no-cache-dir --break-system-packages -r requirements.txt
        pip3 install --no-cache-dir --break-system-packages -e .
        cd /app
    fi

    # Install Sherlock if not already available
    if ! command -v sherlock >/dev/null 2>&1; then
        pip3 install --no-cache-dir --break-system-packages git+https://github.com/sherlock-project/sherlock.git
    fi
    
    echo "Background tool installation complete."
    
    # Start SpiderFoot API after installation
    # SpiderFoot now requires PostgreSQL - configure with SSL for Render
    if [ -f "/app/spiderfoot/sfapi.py" ]; then
        # Use DATABASE_URL from environment and add sslmode=require
        if [ -n "$DATABASE_URL" ]; then
            # Add sslmode=require if not already present
            if echo "$DATABASE_URL" | grep -qv 'sslmode='; then
                export SF_POSTGRES_DSN="${DATABASE_URL}?sslmode=require"
            else
                export SF_POSTGRES_DSN="$DATABASE_URL"
            fi
        fi
        python3 /app/spiderfoot/sfapi.py -l 0.0.0.0:5001 &
        echo "SpiderFoot API started on port 5001"
    fi
}

# Start background installation
install_tools &

# Start the main Node application immediately
node src/index.js
