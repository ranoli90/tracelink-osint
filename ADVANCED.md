# Going Further: Maximum Data & Open Source Tools

This document outlines how to make TraceLink more advanced using open source tools and the maximum amount of information you can collect per click (while staying within privacy/legal bounds).

---

## Implemented: UTM, BotD, Export

- **UTM parameters** — Captured from the click URL (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) and stored per event. Use links like `/click?id=xxx&utm_source=google&utm_medium=cpc&utm_campaign=launch`. Dashboard shows Campaign (UTM) charts and a UTM column in the events table.
- **BotD (FingerprintJS)** — Client-side bot detection via [openfpcdn.io/botd/v1](https://openfpcdn.io/botd/v1). Result sent to backend as `clientBot` (true/false). Shown in the events table as “Client Bot”.
- **Export CSV** — “Export CSV” in the Analytics section downloads up to 5,000 events (timestamp, location, address, IP, ISP, device, browser, OS, screen, TZ, bot flags, UTM, security).

---

## 1. Design & UX Changes (Done)

- **Header**: No longer sticky — scrolls with the page so Refresh/Domains don’t stay pinned.
- **Tracked Links**: Switched from a wide table to a **card grid**. No horizontal scroll; each link is a card with ID, destination, clicks, date, domains, and actions.
- **Design**: Inter font, tighter palette, clearer hierarchy.

---

## 2. Open Source Projects Worth Using

### Link / Click Analytics

| Project | GitHub | Notes |
|--------|--------|--------|
| **Dub** | [dubinc/dub](https://github.com/dubinc/dub) | Full link attribution platform (short links, conversions, analytics). 20k+ stars. Uses Tinybird for analytics. |
| **Plausible Tracker** | [plausible/plausible-tracker](https://github.com/plausible/plausible-tracker) | Lightweight, privacy-focused event/click tracking. Open source. |
| **Django-Clickify** | [romjanxr/django-clickify](https://github.com/romjanxr/django-clickify) | Django app: click tracking, rate limiting, IP filtering, geolocation. |

### IP Geolocation (Max Data, No/Minimal Cost)

| Source | Data | License / Limit |
|--------|------|------------------|
| **ip-api.com** | Country, region, city, zip, lat/lon, timezone, ISP, org, ASN, reverse DNS | Free tier; 45 req/min. Used in this project. |
| **reallyfreegeoip.org** | City, country, timezone, lat/lon | Free, no key, no stated limit. |
| **IPLocate.io** | Free **downloadable** IP→Country and IP→ASN DBs (daily updates) | CC BY-SA 4.0. Run locally for unlimited lookups. |
| **tdulcet/ip-geolocation-dbs** | IPv4/IPv6 geolocation DBs, auto-updated | GPL-3.0. Self-hosted. |
| **MaxMind GeoLite2** | City, country, ASN, accuracy radius | Free with registration; CSV/MMDB. |

### Device / Browser Fingerprinting

| Project | Purpose |
|--------|--------|
| **FingerprintJS** | [fingerprintjs/fingerprintjs](https://github.com/fingerprintjs/fingerprintjs) — Browser fingerprint (canvas, WebGL, fonts, etc.). ~24k stars. BSL for pro; open source version available. |
| **ua-parser-js** | Already in use. Parses user-agent for device, browser, OS. |

---

## 3. Maximum Data You Can Collect Per Click

Without third-party PII, you can already or could add:

**Already in TraceLink**

- Truncated or full IP (your choice)
- Country, region, city, postal code
- Lat/lon (from IP)
- Timezone
- ISP, org, ASN
- Reverse DNS
- Device type (mobile/tablet/desktop)
- Browser name + version
- OS + version
- Referrer + referrer domain
- Accept-Language
- Simple fingerprint hash (UA + IP + lang)
- VPN/Proxy/Tor/Hosting heuristics (from ISP/org)

**Easy additions**

- **Screen resolution** (from `Sec-CH-Viewport-Width` or JS) — store in `screenResolution`.
- **Color depth / timezone offset** (JS) — for fingerprint entropy.
- **More fingerprint inputs**: canvas hash, WebGL renderer, fonts (e.g. FingerprintJS) → store a single hash.
- **Bot detection**: Headers (`Sec-CH-UA`, `Accept`), missing referrer, no JS — flag possible bots.

**With open source DBs**

- **IP→ASN + org** from IPLocate or tdulcet DBs (no per-request API limit).
- **Better geo**: MaxMind GeoLite2 or DB-IP for city/region/country.

---

## 4. Suggested Next Steps

1. **Add screen + timezone from client**  
   On the redirect page, run a tiny script that sends viewport width, timezone offset, and (optionally) a fingerprint hash to your backend; store with the click event.

2. **Optional: FingerprintJS (open source)**  
   Use the open source build to compute a visitor ID; send it with the click and store. Improves “same visitor” across sessions without cookies.

3. **Fallback / hybrid geo**  
   Keep ip-api for real-time; add a local DB (e.g. IPLocate or tdulcet) for when the API is down or over limit.

4. **Bot flag**  
   Derive a `isLikelyBot` from headers + missing JS; store and filter in analytics.

5. **Refer to Dub / Plausible**  
   Use their approaches (event schema, aggregation) to design more advanced analytics (e.g. conversion funnels, UTM persistence) if you grow in that direction.

---

## 5. Privacy / Legal

- **IP**: Prefer truncated or hashed if you need “EU-friendly” (e.g. GDPR).
- **Fingerprints**: Treat as identifiers; document in privacy policy and get consent if required.
- **Retention**: Add a retention window (e.g. delete raw events after 90 days) and document it.

---

## Summary

- **Design**: Header scrolls; Tracked Links are cards (no horizontal scroll); typography and palette updated.
- **More data**: Screen, timezone, richer fingerprint, bot flag, and optional local geo DBs.
- **Open source**: Dub, Plausible, FingerprintJS, IPLocate/tdulcet, MaxMind GeoLite2 — all usable to make TraceLink more advanced while staying within open source and privacy constraints.
