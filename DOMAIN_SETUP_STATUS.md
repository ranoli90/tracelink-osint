# Domain Setup - Current Status

## What's Done

### DNS Configuration (Porkbun) ✅
All 22 domains now have correct DNS pointing to Netlify:
- A record for apex domain → 75.2.60.5 (Netlify load balancer)
- CNAME for www → apex-loadbalancer.netlify.com

Domains configured:
- thr0ne.com ✅
- chris.quest ✅
- myaccount.lol ✅
- tiktok.gen.in ✅
- tiktok.name ✅
- tiktok.org.in ✅
- chris.forum ✅
- nike.org.in ✅
- y0utube.buzz ✅
- y0utube.cv ✅
- y0utube.vip ✅
- googie.one ✅
- netfiix.cloud ✅
- y0utube.help ✅
- reddit.com.de ✅
- lnstagram.lol ✅
- lnstagram.pics ✅
- googie.pics ✅
- chris.autos ✅
- tikt0k.help ✅
- netfiix.lol ✅ (propagating)
- snapchat.cv ⚠️ (needs manual DNS config - not opted into API)

### Netlify Site ⚠️
- Site: tracelink-app (ID: 0d57ec43-14a2-43c4-bdf2-235d49ea4f15)
- Custom domain: snapchat.cv (DNS not working)
- Domain aliases: chris.quest ✅

**ISSUE:** Netlify API doesn't allow adding domain aliases programmatically. You need to add domains manually.

## What You Need To Do

### 1. Add Domains in Netlify Dashboard

Go to: https://app.netlify.com/sites/tracelink-app/domain

Add these as domain aliases:
- thr0ne.com
- myaccount.lol
- tiktok.gen.in
- tiktok.name
- tiktok.org.in
- chris.forum
- nike.org.in
- y0utube.buzz
- y0utube.cv
- y0utube.vip
- googie.one
- netfiix.cloud
- y0utube.help
- reddit.com.de
- lnstagram.lol
- lnstagram.pics
- googie.pics
- chris.autos
- tikt0k.help
- netfiix.lol

### 2. Fix snapchat.cv DNS

Since snapchat.cv is not opted into Porkbun API, you need to manually configure it:
- Log into Porkbun dashboard
- Go to snapchat.cv domain settings
- Add A record: @ → 75.2.60.5
- Add CNAME: www → apex-loadbalancer.netlify.com

### 3. Test the Links

Once domains are added, the tracking links will work like:
- https://thr0ne.com/click?id=xxxxx
- https://myaccount.lol/click?id=xxxxx
- https://chris.quest/click?id=xxxxx (already works)

## Verification Commands

```bash
# Check if domain resolves to Netlify
nslookup thr0ne.com  # Should show 75.2.60.5

# Test domain works
curl -kL https://thr0ne.com  # Should return app HTML
```
