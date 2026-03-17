# Grabber (tracelink) Setup Status

## ✅ Completed

1. **Environment Configuration**
   - `.env` file contains Porkbun API keys, database URL, and other secrets
   - Netlify site linked (`tracelink-app`, ID: 0d57ec43-14a2-43c4-bdf2-235d49ea4f15)

2. **DNS Configuration via Porkbun** ✅
   - **thr0ne.com**:
     - A record (apex) → 75.2.60.5 (Netlify load balancer IP)
     - CNAME record (www) → apex-loadbalancer.netlify.com
   - **chris.quest**:
     - A record (apex) → 75.2.60.5
     - CNAME record (www) → apex-loadbalancer.netlify.com
   - All existing records (MX, NS, TXT, etc.) preserved

3. **Netlify Deployment** ✅
   - Site deployed at: https://snapchat.cv (primary custom domain)
   - Deploys triggered via `netlify deploy --prod --build` or Git pushes
   - Functions (api, porkbun, etc.) deployed and accessible

## ⚠️ Pending: Netlify Domain Aliases

Due to conflicts and certificate provisioning, the following domain aliases need to be added manually:

- `thr0ne.com`
- `www.thr0ne.com`
- `www.chris.quest`

*(Note: `chris.quest` was successfully added as an alias)*

## 📋 Manual Steps to Complete Setup

### 1. Wait for Certificate Provisioning
Check Netlify dashboard: Site settings > Domain management
Wait for "DNS verification" and "Certificate provisioning" to complete.

### 2. Add Remaining Domain Aliases

**Option A: Netlify Dashboard (Recommended)**
1. Go to: https://app.netlify.com/sites/tracelink-app/domain
2. Under "Domain aliases", click "Add domain alias"
3. Add each domain:
   - `thr0ne.com`
   - `www.thr0ne.com`
   - `www.chris.quest`
4. Save after each addition

**Option B: Netlify CLI (after certificate provisioning completes)**
```bash
npx netlify domain:add thr0ne.com
npx netlify domain:add www.thr0ne.com
npx netlify domain:add www.chris.vest
```

### 3. Verify DNS Propagation
After adding aliases, wait 5-30 minutes for DNS to propagate, then verify:
```bash
nslookup thr0ne.com        # Should show 75.2.60.5
nslookup www.thr0ne.com    # Should show apex-loadbalancer.netlify.com
nslookup chris.quest       # Should show 75.2.60.5
nslookup www.chris.quest   # Should show apex-loadbalancer.netlify.com
```

### 4. Test the Sites
Visit in browser:
- http://thr0ne.com
- http://www.thr0ne.com
- http://chris.quest
- http://www.chris.quest
All should serve your Netlify site (same content as snapchat.cv).

### 5. Optional: Set Primary Domain
If you prefer one of these domains as the main domain (instead of snapchat.cv):
1. In Netlify dashboard, go to Domain settings
2. Add the desired domain as a custom domain (not alias)
3. Move snapchat.cv to domain aliases if needed

## 🔧 Available Scripts

- `scripts/setup-domain-dns.js <domain>` - Configure Porkbun DNS for any domain to point to Netlify
- `scripts/list-thr0ne-dns.js` - View current DNS records for thr0ne.com
- `scripts/update-netlify-site.js` - Update Netlify site via API (requires auth token)

## 🚀 Deploy Latest Code
To ensure your site is up-to-date:
```bash
netlify deploy --prod --build
```
or push to your connected Git repository.

## 📞 Support
If you encounter issues:
1. Check Netlify dashboard for error messages
2. Verify Porkbun API keys in `.env` are correct
3. Ensure you're logged into Netlify CLI: `npx netlify status`