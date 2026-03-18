FROM node:20-alpine

WORKDIR /app

# Increase memory limit to utilize the upgraded Pro tier resources (2GB+ recommended)
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Install system dependencies
RUN apk add --no-cache openssl g++ make python3 py3-pip git wget

# Install Node dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Install OSINT tools
RUN pip3 install --no-cache-dir --break-system-packages maigret holehe git+https://github.com/sherlock-project/sherlock.git

# Install PhoneInfoga (Go-based tool)
RUN wget https://github.com/sundowndev/phoneinfoga/releases/download/v2.11.0/phoneinfoga_Linux_x86_64.tar.gz && \
    tar -xzf phoneinfoga_Linux_x86_64.tar.gz && \
    mv phoneinfoga /usr/local/bin/ && \
    rm phoneinfoga_Linux_x86_64.tar.gz

# Copy Prisma schema
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY src ./src/
COPY public ./public/
COPY .env.production.example .env

# Initialize SpiderFoot
RUN git clone --depth 1 https://github.com/poppopjmp/spiderfoot.git /app/spiderfoot
WORKDIR /app/spiderfoot
RUN if [ -f requirements.txt ]; then pip3 install --no-cache-dir --break-system-packages -r requirements.txt; fi
RUN pip3 install --no-cache-dir --break-system-packages -e .

WORKDIR /app

# Expose ports (3000 for app, 5001 for SpiderFoot)
EXPOSE 3000 5001

# Copy start script
COPY scripts/start.sh /app/scripts/start.sh
RUN chmod +x /app/scripts/start.sh

# Start both Node app and SpiderFoot using the start script
CMD ["/app/scripts/start.sh"]
