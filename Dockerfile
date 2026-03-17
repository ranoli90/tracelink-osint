# TraceLink OSINT - Dockerfile for Render.com
FROM node:18-alpine

WORKDIR /app

# Install system dependencies needed by Prisma/OpenSSL
RUN apk add --no-cache openssl

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

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/index.js"]
