FROM node:20-alpine

WORKDIR /app

# Increase memory limit to utilize the upgraded Pro tier resources
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Install minimal system dependencies for build and runtime
RUN apk add --no-cache openssl g++ make python3 py3-pip git wget

# Install Node dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Install lightweight OSINT tools at build time
RUN pip3 install --no-cache-dir --break-system-packages maigret holehe

# Install PhoneInfoga (binary)
RUN wget https://github.com/sundowndev/phoneinfoga/releases/download/v2.11.0/phoneinfoga_Linux_x86_64.tar.gz && \
    tar -xzf phoneinfoga_Linux_x86_64.tar.gz && \
    mv phoneinfoga /usr/local/bin/ && \
    rm phoneinfoga_Linux_x86_64.tar.gz

# Copy Prisma schema
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code and other files
COPY src ./src/
COPY public ./public/
COPY scripts ./scripts/
COPY .env.production.example .env

# Expose ports
EXPOSE 3000 5001

# Fix permissions for the start script
RUN chmod +x /app/scripts/start.sh

# Start using the optimized script
CMD ["/app/scripts/start.sh"]
