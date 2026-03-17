# Setup Complete - Next Steps

## What has been accomplished:

1. **DNS Configuration via Porkbun** ✅
   - For `thr0ne.com`:
     - A record (apex) pointing to `75.2.60.5` (Netlify load balancer IP)
     - CNAME record (www) pointing to `apex-loadbalancer.netlify.com`
   - For `chris.quest`:
     - A record (apex) pointing to `75.2.60.5`
     - CNAME record (www) pointing to `apex-loadbalancer.netlify.com`
   - Existing records (MX, NS, TXT, etc.) preserved.

2. **Netlify Site Configuration** ⚠️ Partially completed
   - Site ID: `0d57ec43-14a2-43c4-bdf2-235d49ea4f15`
   - Site Name: `tracelink-app`
   - Primary Domain (custom_domain): `snapchat.cv` (unchanged)
   - Domain Alias added: `chris.quest` ✅
   - Remaining domain aliases to add:
     - `thr0ne.com`
     - `www.thr0ne.com`
     - `www.chris.quest`

## Why the remaining aliases weren't added automatically:

The Netlify API returned an error indicating that the domain aliases `thr0ne.com`, `www.thr0ne.com`, and `www.chris.quest` are currently conflicting with other sites in the system. Specifically:
- `thr0ne.com` and `www.thr0ne.com` conflict with a site that appears to be deleted (404 when fetching)
- `www.chris.quest` may have a similar conflict

Additionally, the site is currently undergoing certificate provisioning, which temporarily blocks changes to custom domains.

## Manual Steps to Complete Setup:

1. **Wait for certificate provisioning to complete** (if in progress)
   - You can check the status in the Netlify dashboard under Site settings > Domain management
   - Or wait a few minutes and retry the API calls

2. **Add the remaining domain aliases** via one of these methods:

   **Option A: Netlify Dashboard (Recommended)**
   - Go to: https://app.netlify.com/sites/tracelink-app/domain
   - Under "Domain aliases", click "Add domain alias"
   - Add each domain one by one:
     - `thr0ne.com`
     - `www.thr0ne.com`
     - `www.chris.quest`
   - Save after each addition

   **Option B: Netlify CLI (after certificate provisioning)**
   ```bash
   npx netlify domain:add thr0ne.com
   npx netlify domain:add www.thr0ne.com
   npx netlify domain:add www.chris.quest
   ```

   **Option C: Netlify API (after certificate provisioning)**
   Use the PATCH method to update the site's domain_aliases array.

3. **Verify DNS propagation**
   - Use `nslookup thr0ne.com` or `dig thr0ne.com` to confirm it resolves to `75.2.60.5`
   - Use `nslookup www.thr0ne.com` to confirm it resolves to `apex-loadbalancer.netlify.com`
   - Repeat for chris.quest domains

4. **Test the sites**
   - Visit http://thr0ne.com and http://www.thr0ne.com
   - Visit http://chris.quest and http://www.chris.quest
   - You should see your Netlify site (currently serving the same content as snapchat.cv)

5. **Optional: Set a primary domain**
   - If you prefer one of these domains to be the primary (instead of snapchat.cv), you can set it in the Domain settings panel.
   - Example: To make `thr0ne.com` the primary domain, add it as a custom domain and move `snapchat.cv` to domain aliases.

## Troubleshooting

- If you see "DNS propagation" delays, wait 15-30 minutes and test again.
- If a domain alias fails to add due to conflict, double-check that no other site in your Netlify account is using that domain as a custom domain or alias.
- You can list all sites in your account via: `npx netlify sites:list`

## Scripts Available for Future Use

- `scripts/setup-domain-dns.js <domain>` - Set up DNS for any domain in your Porkbun account to point to Netlify
- `scripts/list-thr0ne-dns.js` - Lists DNS records for thr0ne.com (example)
- `scripts/update-netlify-site.js` - Updates site using Netlify API with auth token (requires certificate provisioning to be complete)

## Final Notes

The core functionality is in place: your domains now point to Netlify's servers. Once you add them as domain aliases in Netlify (via dashboard or API), they will serve your site.

You can also trigger a new deploy to ensure the latest code is live:
```bash
netlify deploy --prod --build
```