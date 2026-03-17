# Setup Summary

## DNS Configuration via Porkbun

### thr0ne.com
- A record (apex): pointing to 75.2.60.5 (Netlify load balancer IP)
- CNAME record (www): pointing to apex-loadbalancer.netlify.com
- Other existing records preserved (MX, NS, TXT, etc.)

### chris.quest
- A record (apex): pointing to 75.2.60.5 (Netlify load balancer IP)
- CNAME record (www): pointing to apex-loadbalancer.netlify.com
- Other existing records preserved (MX, NS, TXT, etc.)

Note: Wildcard records (*.thr0ne.com and *.chris.quest) are left as-is.
  - For thr0ne.com: *.thr0ne.com A → 75.2.60.5
  - For chris.quest: *.chris.quest CNAME → pixie.porkbun.com (existing)

## Netlify Site Configuration

Site ID: 0d57ec43-14a2-43c4-bdf2-235d49ea4f15
Site Name: tracelink-app
Primary Domain (custom_domain): snapchat.cv (unchanged)

Domain Aliases added:
- thr0ne.com
- www.thr0ne.com
- chris.quest
- www.chris.quest

## Next Steps

1. **Wait for DNS propagation**: This can take anywhere from a few minutes to 48 hours, but usually resolves within 15-30 minutes for changes like these.

2. **Verify DNS propagation**:
   - Use `nslookup thr0ne.com` or `dig thr0ne.com` to check that the apex domain resolves to 75.2.60.5.
   - Use `nslookup www.thr0ne.com` or `dig www.thr0ne.com` to check that it resolves to apex-loadbalancer.netlify.com.
   - Repeat for chris.quest and www.chris.quest.

3. **Test the site**:
   - Once DNS propagates, visit http://thr0ne.com and http://www.thr0ne.com in a browser.
   - You should see the Netlify site (currently serving the snapchat.cv domain content, as that is set as the primary custom domain).
   - Similarly for chris.quest domains.

4. **Optional: Set a primary domain** (if you want one of these to be the main domain):
   - You can use the Netlify API or dashboard to set one of these as the primary domain instead of snapchat.cv.
   - Example: To make thr0ne.com the primary domain, update the site with custom_domain: "thr0ne.com" and adjust domain_aliases accordingly.

5. **Trigger a new deploy** (if you've made code changes and want to see them live):
   - Run: `netlify deploy --prod --build` or push to the connected Git repository.

## Troubleshooting

- If DNS records don't appear to be updating, double-check the Porkbun API keys in your `.env` file.
- If Netlify doesn't recognize the domains after DNS propagation, ensure they are added in the Netlify dashboard under Domain settings > Domain aliases, or via the API as we did.

## Scripts Used

- `scripts/setup-domain-dns.js`: Generic script to set up DNS for a domain to point to Netlify.
- `scripts/list-thr0ne-dns.js`: Lists DNS records for thr0ne.com (for verification).
- `scripts/finalize-netlify-domains.js`: Updates the Netlify site's domain_aliases.

These scripts can be reused for other domains in the Porkbun account.
