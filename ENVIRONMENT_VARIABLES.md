# Environment Variables Documentation

This document describes all the environment variables used by the TraceLink application.

## Required Variables

### Database
- `DATABASE_URL`
  - **Description**: PostgreSQL database connection string
  - **Required**: Yes
  - **Example**: `postgresql://username:password@localhost:5432/tracelink`
  - **Notes**: Must be a valid PostgreSQL connection URL

### Telegram Bot
- `BOT_TOKEN`
  - **Description**: Telegram bot token from BotFather
  - **Required**: Yes (for bot functionality)
  - **Example**: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
  - **Notes**: Get this from @BotFather on Telegram

## Optional Variables

### Application Configuration
- `BASE_URL`
  - **Description**: Base URL for the application
  - **Required**: No
  - **Default**: `http://localhost:3000`
  - **Example**: `https://your-domain.com`

- `WEBAPP_URL`
  - **Description**: URL for the Telegram mini-app
  - **Required**: No
  - **Default**: Uses `BASE_URL` if not set
  - **Example**: `https://your-domain.com`

- `PORT`
  - **Description**: Port for the Express server
  - **Required**: No
  - **Default**: `3000`
  - **Example**: `8080`

- `NODE_ENV`
  - **Description**: Environment mode
  - **Required**: No
  - **Default**: `development`
  - **Values**: `development`, `production`, `test`

### Security & Authentication
- `ADMIN_TELEGRAM_IDS`
  - **Description**: Comma-separated list of Telegram user IDs for admin access
  - **Required**: No
  - **Example**: `123456789,987654321`
  - **Notes**: Users with these IDs can access admin features

- `ADMIN_USERNAME`
  - **Description**: Username for basic auth on admin endpoints
  - **Required**: No
  - **Default**: `admin`
  - **Example**: `myadmin`

- `ADMIN_PASSWORD`
  - **Description**: Password for basic auth on admin endpoints
  - **Required**: No
  - **Default**: None (disables auth if not set)
  - **Example**: `securepassword123`

- `CSRF_SECRET`
  - **Description**: Secret key for CSRF token generation
  - **Required**: No
  - **Default**: Randomly generated
  - **Example**: `your-secret-key-here`

### Database Connection Pooling
- `DB_CONNECTION_TIMEOUT`
  - **Description**: Database connection timeout in milliseconds
  - **Required**: No
  - **Default**: `10000`
  - **Example**: `15000`

- `DB_QUERY_TIMEOUT`
  - **Description**: Database query timeout in milliseconds
  - **Required**: No
  - **Default**: `30000`
  - **Example**: `25000`

- `DB_TRANSACTION_TIMEOUT`
  - **Description**: Database transaction timeout in milliseconds
  - **Required**: No
  - **Default**: `60000`
  - **Example**: `45000`

### Caching & Performance
- `REDIS_URL`
  - **Description**: Redis connection URL for caching
  - **Required**: No
  - **Example**: `redis://localhost:6379`
  - **Notes**: If not set, in-memory caching will be used

- `CACHE_TTL`
  - **Description**: Cache time-to-live in seconds
  - **Required**: No
  - **Default**: `3600`
  - **Example**: `7200`

### OSINT Tools Configuration
- `OSINT_TIMEOUT`
  - **Description**: Timeout for OSINT tool execution in seconds
  - **Required**: No
  - **Default**: `300`
  - **Example**: `600`

- `OSINT_OUTPUT_DIR`
  - **Description**: Directory for OSINT tool output files
  - **Required**: No
  - **Default**: `./osint-output`
  - **Example**: `/tmp/osint-results`

### Rate Limiting
- `RATE_LIMIT_WINDOW_MS`
  - **Description**: Rate limiting window in milliseconds
  - **Required**: No
  - **Default**: `900000` (15 minutes)
  - **Example**: `600000`

- `RATE_LIMIT_MAX_REQUESTS`
  - **Description**: Maximum requests per rate limit window
  - **Required**: No
  - **Default**: `5`
  - **Example**: `10`

### Logging & Monitoring
- `LOG_LEVEL`
  - **Description**: Logging level
  - **Required**: No
  - **Default**: `info`
  - **Values**: `debug`, `info`, `warn`, `error`

- `LOG_FILE`
  - **Description**: Path to log file
  - **Required**: No
  - **Default**: Logs to console
  - **Example**: `/var/log/tracelink.log`

### External Services
- `PORKBUN_API_KEY`
  - **Description**: API key for Porkbun domain management
  - **Required**: No
  - **Example**: `your-porkbun-api-key`

- `PORKBUN_SECRET_KEY`
  - **Description**: Secret key for Porkbun domain management
  - **Required**: No
  - **Example**: `your-porkbun-secret-key`

## Environment-Specific Examples

### Development (.env.local)
```bash
# Database
DATABASE_URL=postgresql://dev:dev@localhost:5432/tracelink_dev

# Application
BASE_URL=http://localhost:3000
PORT=3000
NODE_ENV=development

# Security
ADMIN_TELEGRAM_IDS=123456789
ADMIN_USERNAME=admin
ADMIN_PASSWORD=dev123

# Debug
LOG_LEVEL=debug
```

### Production (.env.production)
```bash
# Database
DATABASE_URL=postgresql://user:password@db.example.com:5432/tracelink_prod

# Application
BASE_URL=https://tracelink.example.com
PORT=3000
NODE_ENV=production

# Security
ADMIN_TELEGRAM_IDS=123456789,987654321
ADMIN_USERNAME=admin
ADMIN_PASSWORD=securepassword123
CSRF_SECRET=your-production-secret-key

# Performance
REDIS_URL=redis://redis.example.com:6379
CACHE_TTL=7200

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5

# Logging
LOG_LEVEL=warn
LOG_FILE=/var/log/tracelink.log
```

## Security Considerations

1. **Never commit secrets** to version control
2. **Use strong passwords** and randomly generated secrets
3. **Rotate secrets** regularly
4. **Use environment-specific** configuration files
5. **Limit admin access** to only necessary users
6. **Use HTTPS** in production environments

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check `DATABASE_URL` format
   - Verify database is running
   - Check network connectivity

2. **Bot not responding**
   - Verify `BOT_TOKEN` is correct
   - Check bot is running and has internet access
   - Verify webhook configuration

3. **Admin access denied**
   - Check `ADMIN_TELEGRAM_IDS` format
   - Verify user IDs are correct
   - Check for extra spaces in comma-separated list

4. **Rate limiting issues**
   - Adjust `RATE_LIMIT_MAX_REQUESTS`
   - Check `RATE_LIMIT_WINDOW_MS` settings
   - Verify Redis connection if using Redis

### Validation Commands

```bash
# Validate environment variables
npm run validate-env

# Check database connection
npm run check-db

# Test bot token
npm run test-bot
```

## Additional Resources

- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Environment Variables Best Practices](https://12factor.net/config)
