import express from 'express';
import crypto from 'crypto';
import { parseUserAgent } from '../services/parser.js';
import { getGeoLocation, truncateIp } from '../services/geo.js';

const router = express.Router();

async function getAddressFromCoords(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&address_details=1`,
      {
        headers: {
          'User-Agent': 'TraceLink/1.0'
        }
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.address) {
      const addr = data.address;
      const parts = [];
      if (addr.city || addr.town || addr.village || addr.municipality) {
        parts.push(addr.city || addr.town || addr.village || addr.municipality);
      }
      if (addr.state || addr.region) {
        parts.push(addr.state || addr.region);
      }
      if (addr.country) {
        parts.push(addr.country);
      }
      return {
        fullAddress: parts.join(', '),
        city: addr.city || addr.town || addr.village || null,
        state: addr.state || addr.region || null,
        country: addr.country || null,
        postcode: addr.postcode || null,
        road: addr.road || null,
        houseNumber: addr.house_number || null,
        neighborhood: addr.neighbourhood || addr.suburb || null
      };
    }
    return null;
  } catch (e) {
    console.error('Reverse geocoding failed:', e.message);
    return null;
  }
}

const FINGERPRINT_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="destination" content="{{DESTINATION_URL}}">
  <meta name="tracking-id" content="{{TRACKING_ID}}">
  <title>Redirecting...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      min-height: 100vh; 
      background: #0a0a0a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .loader {
      width: 48px;
      height: 48px;
      border: 3px solid #222;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loader"></div>
  <script src="/fingerprint-quantum.js"></script>
</body>
</html>`;

router.get('/', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { id: trackingId, destination, utm_source, utm_medium, utm_campaign, utm_term, utm_content } = req.query;

  if (!trackingId) {
    return res.status(400).json({ error: 'Missing tracking ID' });
  }

  const link = await prisma.link.findUnique({
    where: { trackingId },
  });

  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const destinationUrl = destination || link.destinationUrl;
  
  const page = FINGERPRINT_PAGE
    .replace('{{DESTINATION_URL}}', encodeURIComponent(destinationUrl))
    .replace('{{TRACKING_ID}}', trackingId);
  
  res.setHeader('Content-Type', 'text/html');
  res.send(page);
});


router.post('/complete', async (req, res) => {
  const prisma = req.app.get('prisma');
  const body = req.body;

  const { trackingId, redirectUrl, sessionId, visitorId, entropyScore } = body;
  const fp = body.fingerprint || {};

  if (!trackingId) {
    return res.status(400).json({ error: 'trackingId is required' });
  }

  const link = await prisma.link.findUnique({ where: { trackingId } });
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const destinationUrl = redirectUrl ? decodeURIComponent(redirectUrl) : link.destinationUrl;

  // Extract IP
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIpHeader = req.headers['x-real-ip'];
  const ip = realIpHeader || (forwardedFor ? forwardedFor.split(',')[0].trim() : req.ip || req.connection?.remoteAddress || 'unknown');

  const userAgent = req.headers['user-agent'] || fp.browser?.userAgent || '';
  const parsedUA = parseUserAgent(userAgent);
  const geo = getGeoLocation(ip);
  const ipTruncated = truncateIp(ip);

  // Extract nested fingerprint data safely
  const canvas = fp.canvas || {};
  const webgl = fp.webgl || {};
  const webrtc = fp.webrtc || {};
  const audio = fp.audio || {};
  const fonts = fp.fonts || {};
  const display = fp.display || {};
  const win = fp.window || {};
  const device = fp.device || {};
  const browser = fp.browser || {};
  const osData = fp.os || {};
  const storage = fp.storage || {};
  const permissions = fp.permissions || {};
  const media = fp.media || {};
  const network = fp.network || {};
  const security = fp.security || {};
  const bot = fp.bot || {};
  const vpn = fp.vpn || {};
  const page = fp.page || {};

  // Referrer
  const referrer = page.referrer || req.headers['referer'] || req.headers['referrer'] || null;
  let referrerDomain = null;
  try {
    if (referrer) referrerDomain = new URL(referrer).hostname;
  } catch (e) { /* invalid URL */ }

  const language = osData.language || req.headers['accept-language']?.split(',')[0] || null;

  // Screen resolution
  let screenResolution = null;
  if (display.width && display.height) {
    screenResolution = `${display.width}x${display.height}`;
  }

  // Build fingerprint hash from stable components
  const fingerprintString = [
    canvas.standardHash || '',
    webgl.vendor || '',
    webgl.renderer || '',
    audio.fingerprintHash || '',
    (fonts.detected || []).join(','),
    osData.platform || '',
    display.width || '',
    display.height || '',
    language || ''
  ].join('|');

  const fingerprintHash = crypto.createHash('sha256')
    .update(fingerprintString)
    .digest('hex')
    .substring(0, 32);

  // Bot detection
  const isLikelyBot = bot.isBot || bot.isHeadless || (bot.indicators || []).length > 2 || parsedUA.isBot;

  // WebRTC data
  const webrtcPublicIps = webrtc.publicIPs || [];
  const webrtcSrflxIps = webrtc.srflxIPs || [];
  const webrtcAllIps = [...new Set([...webrtcPublicIps, ...webrtcSrflxIps])];
  const webrtcRealIp = webrtc.realIP || null;
  const webrtcLeakDetected = webrtc.leakDetected || webrtcAllIps.length > 0;

  // VPN detection: compare WebRTC real IP vs server-seen IP
  let vpnDetectedByWebrtc = false;
  if (webrtcRealIp && webrtcRealIp !== ip) {
    vpnDetectedByWebrtc = true;
  }

  // Reverse geocode
  let addressData = null;
  const lat = geo?.latitude || null;
  const lon = geo?.longitude || null;
  if (lat && lon) {
    addressData = await getAddressFromCoords(lat, lon);
  }

  try {
    const clickEvent = await prisma.clickEvent.create({
      data: {
        trackingId,
        ipFull: ip,
        ipTruncated,
        ipVersion: ip.includes(':') ? 6 : 4,

        country: geo?.country || addressData?.country || null,
        countryCode: geo?.countryCode || null,
        region: geo?.region || addressData?.state || null,
        regionCode: geo?.regionCode || null,
        city: geo?.city || addressData?.city || null,
        cityPostalCode: addressData?.postcode || geo?.postalCode || null,
        latitude: lat,
        longitude: lon,
        timezone: geo?.timezone || osData.timezone || null,
        isp: geo?.isp || null,
        org: geo?.org || null,
        asn: geo?.asn || null,
        continent: geo?.continent || null,
        continentCode: geo?.continentCode || null,
        currency: geo?.currency || null,

        address: addressData?.fullAddress || geo?.address || null,
        reverseDns: geo?.reverseDns || null,

        isVpn: vpn.detected || vpnDetectedByWebrtc || geo?.isVpn || false,
        isProxy: geo?.isProxy || false,
        isTor: false,
        isHosting: geo?.isHosting || false,

        deviceType: parsedUA.deviceType || (device.touchSupport ? 'mobile' : 'desktop'),
        deviceBrand: parsedUA.deviceBrand || device.deviceVendor || null,
        deviceModel: parsedUA.deviceModel || device.deviceModel || null,
        browser: parsedUA.browser || browser.name || null,
        browserVersion: parsedUA.browserVersion || browser.version || null,
        os: parsedUA.os || osData.name || null,
        osVersion: parsedUA.osVersion || osData.version || null,
        screenResolution,

        language,
        referrer,
        referrerDomain,
        userAgent,
        fingerprintHash,
        visitorId: visitorId || null,
        sessionId: sessionId || null,

        timezoneOffset: osData.timezoneOffset != null ? osData.timezoneOffset : new Date().getTimezoneOffset(),

        isLikelyBot,
        clientBot: bot.isBot || false,
        isHeadless: bot.isHeadless || false,
        isAutomated: bot.isAutomated || false,
        botScore: bot.score || 0,
        botIndicators: bot.indicators ? JSON.stringify(bot.indicators) : null,

        utmSource: body.utm_source || null,
        utmMedium: body.utm_medium || null,
        utmCampaign: body.utm_campaign || null,
        utmTerm: body.utm_term || null,
        utmContent: body.utm_content || null,

        viewportWidth: win.innerWidth || null,
        viewportHeight: win.innerHeight || null,
        colorDepth: display.colorDepth || null,
        pixelRatio: display.pixelRatio || null,
        deviceMemory: device.memory || null,
        hardwareConcurrency: device.cores || null,
        platform: osData.platform || null,
        maxTouchPoints: device.maxTouchPoints || null,
        effectiveConnectionType: network.effectiveType || null,
        connectionType: network.type || null,
        isMobile: device.touchSupport || parsedUA.deviceType === 'mobile',

        webrtcIps: webrtcAllIps.length > 0 ? JSON.stringify(webrtcAllIps) : null,
        webrtcRealIp,
        webrtcLeakDetected,

        canvasFingerprint: canvas.standardHash || null,
        canvasFingerprintHash: canvas.standardHash || null,
        canvasGpuAccelerated: canvas.gpuAccelerated != null ? canvas.gpuAccelerated : null,
        webglVendor: webgl.vendor || null,
        webglRenderer: webgl.renderer || null,
        webglVersion: webgl.version || null,
        webglShadingVersion: webgl.shadingLanguageVersion || null,
        webglFingerprintHash: webgl.fingerprintHash || null,
        webgl2Enabled: webgl.webgl2?.supported || false,
        webgl2Vendor: webgl.webgl2?.vendor || null,
        webgl2Renderer: webgl.webgl2?.renderer || null,

        audioFingerprint: audio.fingerprint || null,
        audioFingerprintHash: audio.fingerprintHash || null,
        audioSampleRate: audio.sampleRate || null,

        fontsDetected: fonts.detected ? JSON.stringify(fonts.detected) : null,
        fontCount: fonts.count || 0,

        sessionStorageEnabled: storage.sessionStorage || false,
        localStorageEnabled: storage.localStorage || false,
        indexedDBEnabled: storage.indexedDB || false,
        cookieEnabled: osData.cookieEnabled || false,

        permissions: Object.keys(permissions).length > 0 ? JSON.stringify(permissions) : null,

        batteryLevel: device.battery?.level || null,
        batteryCharging: device.battery?.charging || null,
        batterySupported: device.battery?.supported || false,

        doNotTrack: device.doNotTrack || null,
        online: network.online,

        entropyScore: entropyScore || null,
        humanScore: 100,

        networkDownlink: network.downlink || null,
        networkRtt: network.rtt || null,
        networkSaveData: network.saveData || false,
        networkEffectiveType: network.effectiveType || null,

        vpnScore: vpn.score || 0,
        vpnDetected: vpn.detected || vpnDetectedByWebrtc || false,

        clickSource: 'fingerprint-quantum',
      },
    });

    // Increment click count
    await prisma.link.update({
      where: { trackingId },
      data: { clickCount: { increment: 1 } },
    });

    res.json({
      success: true,
      clickId: clickEvent.id,
      redirectUrl: destinationUrl,
    });
  } catch (error) {
    console.error('Failed to log click event:', error);
    res.status(500).json({
      success: false,
      redirectUrl: destinationUrl,
    });
  }
});


router.post('/behavior', async (req, res) => {
  const prisma = req.app.get('prisma');
  const body = req.body;

  const { trackingId, sessionId, behavior, performance: perf, isFinal } = body;

  if (!trackingId) {
    return res.status(400).json({ error: 'Missing tracking ID' });
  }

  try {
    // Find the most recent event for this session
    const existingEvent = await prisma.clickEvent.findFirst({
      where: { trackingId, sessionId: sessionId || undefined },
      orderBy: { timestamp: 'desc' },
    });

    if (existingEvent) {
      const updateData = {};

      if (behavior) {
        if (behavior.mouseMovements) {
          updateData.mouseMovements = JSON.stringify(behavior.mouseMovements.slice(-50));
        }
        if (behavior.scrollDepth != null) updateData.scrollDepth = behavior.scrollDepth;
        if (behavior.clickCount != null) updateData.clicks = behavior.clickCount;
        if (behavior.keyCount != null) updateData.keypresses = behavior.keyCount;
        if (behavior.humanScore != null) updateData.humanScore = behavior.humanScore;
        if (behavior.timeOnPage != null) updateData.timeOnPage = Math.round(behavior.timeOnPage / 1000);
      }

      if (perf) {
        if (perf.timeOnPage != null) updateData.timeOnPage = Math.round(perf.timeOnPage / 1000);
        if (perf.scrollDepth != null) updateData.scrollDepth = perf.scrollDepth;
        if (perf.clickCount != null) updateData.clicks = perf.clickCount;
        if (perf.keyCount != null) updateData.keypresses = perf.keyCount;
        if (perf.humanScore != null) updateData.humanScore = perf.humanScore;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.clickEvent.update({
          where: { id: existingEvent.id },
          data: updateData,
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update behavior:', error);
    res.json({ success: false });
  }
});

export default router;
