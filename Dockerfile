# TraceLink OSINT - Dockerfile for Render.com
FROM node:18-alpine

WORKDIR /app

# Install system dependencies needed by Prisma/OpenSSL and Python for SpiderFoot
RUN apk add --no-cache openssl python3 py3-pip

# Install Node dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy Prisma schema
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY src ./src/
COPY public ./public/
COPY .env.production.example .env

# Initialize and update git submodule for SpiderFoot
RUN git clone --depth 1 https://github.com/poppopjmp/spiderfoot.git /app/spiderfoot || \
    (git submodule init && git submodule update --recursive)

# Install SpiderFoot dependencies
WORKDIR /app/spiderfoot
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Install SpiderFoot CLI
RUN pip3 install --no-cache-dir --break-system-packages -e .

WORKDIR /app

# Expose ports (3000 for app, 5001 for SpiderFoot)
EXPOSE 3000 5001

# Start both Node app and SpiderFoot
CMD ["sh", "-c", "python3 spiderfoot/sfapi.py -l 0.0.0.0:5001 & node src/index.js"]
