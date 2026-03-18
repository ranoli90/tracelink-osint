#!/bin/sh
echo "--- Starting TraceLink OSINT Setup ---"
cd /app

# Run Prisma migrations
npx prisma migrate deploy

# Function to install OSINT tools in background to speed up startup
install_tools() {
    echo "Starting background installation of OSINT tools..."
    
    # Install SpiderFoot (use older version that supports SQLite)
    if [ ! -d "/app/spiderfoot" ]; then
        # Clone specific version that supports SQLite
        git clone --depth 1 --branch 3.5.0 https://github.com/poppopjmp/spiderfoot.git /app/spiderfoot || \
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
    # SpiderFoot uses SQLite for local data storage
    if [ -f "/app/spiderfoot/sfapi.py" ]; then
        python3 /app/spiderfoot/sfapi.py -l 0.0.0.0:5001 &
        echo "SpiderFoot API started on port 5001"
    fi
}

# Start background installation
install_tools &

# Start the main Node application immediately
node src/index.js
