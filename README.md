# TraceLink

A privacy-compliant link tracking and fingerprinting tool. Track clicks, device info, and geolocation without collecting personally identifiable information.

## Features

- **Link Generation**: Create trackable short links from any destination URL
- **Click Tracking**: Capture device, browser, OS, geolocation, and referrer data
- **Analytics Dashboard**: View click counts, country breakdowns, device stats
- **Privacy Compliant**: IP truncation, no cookies, no PII collection
- **Built-in GeoIP**: Uses free IP geolocation databases (no MaxMind account required)

## Prerequisites

- Node.js 18+

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
NODE_ENV=development
BASE_URL="http://localhost:3000"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-secure-password"
PORT=3000
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
```

For Netlify production, set `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and optionally `BASE_URL` in the Netlify dashboard (see Deployment).

### 3. Initialize Database

```bash
npm run db:generate
npm run db:migrate
```

### 4. Run

```bash
npm start
```

- **Dashboard**: http://localhost:3000/admin
- **API**: http://localhost:3000/api

## API Endpoints

### Create Link

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"destinationUrl": "https://example.com"}'
```

Response:
```json
{
  "trackingId": "abc123defg",
  "destinationUrl": "https://example.com",
  "shortUrl": "http://localhost:3000/click?id=abc123defg",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### List Links

```bash
curl http://localhost:3000/api/links
```

### Get Link Analytics

```bash
curl http://localhost:3000/api/links/abc123defg/events
```

### Track Click (Redirect)

```bash
curl -L http://localhost:3000/click?id=abc123defg
```

### Get Statistics

```bash
curl http://localhost:3000/api/analytics/stats
```

## Deployment

### Netlify (no GitHub)

Deploy from your machine using the Netlify CLI. No GitHub or Git connection required.

1. **Set environment variables** in the Netlify dashboard (**Site settings → Environment variables**):

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `DATABASE_URL` | **Yes** | PostgreSQL connection string (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com)). |
   | `ADMIN_USERNAME` | Yes | Dashboard login username. |
   | `ADMIN_PASSWORD` | Yes | Dashboard login password (use a strong password). |
   | `BASE_URL` | No | Full site URL (e.g. `https://thr0ne.com`). Used for short links. |
   | `PORKBUN_API_KEY` | No | Porkbun API key (for auto DNS when adding custom domains). |
   | `PORKBUN_SECRET_API_KEY` | No | Porkbun secret API key. |
   | `PORKBUN_ROOT_DOMAIN` | No | Root domain (e.g. `thr0ne.com`). |
   | `NETLIFY_DNS_TARGET` | No | CNAME target for subdomains (default: `apex-loadbalancer.netlify.com`). |

2. **Create a Netlify site** (if you don’t have one): [app.netlify.com](https://app.netlify.com) → Add new site → **Deploy manually** or **Import from Git** (you can still deploy with CLI later).

3. **Deploy from the project folder:**

   ```bash
   npm install
   npm run build
   npx netlify deploy --prod --dir=public --functions=netlify/functions
   ```

   When prompted, link to an existing site or create a new one. The build (Prisma generate + migrate) uses `DATABASE_URL` from your **local** `.env` when you run `npm run build`; for production, set `DATABASE_URL` in the Netlify UI so future builds (e.g. from Netlify’s build step) use it. If you only deploy with CLI, you can run `npm run build` locally before `netlify deploy` so migrations run against your production DB.

   To have Netlify run the build on deploy, use **Build settings** in the dashboard: Build command `npm run build`, Publish directory `public`, Functions directory `netlify/functions`. Then deploy with:

   ```bash
   npx netlify deploy --prod --build
   ```

   That runs the build on Netlify’s servers (using the env vars you set in the dashboard).

**Summary:** Use **Netlify CLI** to deploy; ignore GitHub. Set `DATABASE_URL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in Netlify. Deploy with `npx netlify deploy --prod --build` or run `npm run build` locally and `npx netlify deploy --prod --dir=public --functions=netlify/functions`.

## Database Schema

### Links Table
| Column | Type | Description |
|--------|------|-------------|
| id | string | Internal ID |
| tracking_id | string | Unique tracking identifier |
| destination_url | string | Target URL |
| created_at | datetime | Creation timestamp |

### Click Events Table
| Column | Type | Description |
|--------|------|-------------|
| id | string | Event ID |
| tracking_id | string | Link reference |
| ip_truncated | string | Truncated IP (GDPR compliant) |
| country | string | Country name |
| region | string | Region/state |
| city | string | City |
| device_type | string | Mobile/Tablet/Desktop |
| browser | string | Browser name |
| os | string | Operating system |
| timestamp | datetime | Click timestamp |

## Privacy Compliance

- **IP Truncation**: Only first 3 octets stored (e.g., `192.168.1.0`)
- **No Cookies**: No persistent tracking without consent
- **No PII**: Names, emails, and personal data never collected
- **Region-level Geo**: Exact coordinates not stored

## IP Geolocation

This project uses:
- **@ip-location-db/dbip-city** - City-level geolocation (CC BY 4.0)
- **@ip-location-db/geo-whois-asn-country** - Country-level fallback (CC0)

No external API calls or MaxMind account required.

## Project Structure

```
grabber/
├── src/
│   ├── index.js           # Entry point
│   ├── routes/
│   │   ├── links.js       # Link CRUD
│   │   ├── click.js       # Redirect & tracking
│   │   └── analytics.js   # Analytics API
│   ├── middleware/
│   │   └── auth.js        # HTTP Basic Auth
│   ├── services/
│   │   ├── geo.js         # IP geolocation
│   │   └── parser.js      # User-agent parsing
│   └── utils/
│       └── helpers.js
├── public/
│   ├── index.html         # Dashboard UI
│   ├── styles.css
│   └── app.js
├── prisma/
│   └── schema.prisma      # Database schema
├── scripts/
│   └── seed.js            # Sample data
├── .env.example
└── package.json
```

## License

MIT
