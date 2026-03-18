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
    if [ -f "/app/spiderfoot/sfapi.py" ]; then
        # Pass SF_POSTGRES_DSN if available in environment
        if [ -n "$SF_POSTGRES_DSN" ]; then
            SF_POSTGRES_DSN="$SF_POSTGRES_DSN" python3 /app/spiderfoot/sfapi.py -l 0.0.0.0:5001 &
        elif [ -n "$DATABASE_URL" ]; then
            SF_POSTGRES_DSN="$DATABASE_URL" python3 /app/spiderfoot/sfapi.py -l 0.0.0.0:5001 &
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
