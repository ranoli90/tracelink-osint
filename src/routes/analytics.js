import express from 'express';
import { basicAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');

  const [totalLinks, totalClicks, recentClicks] = await Promise.all([
    prisma.link.count(),
    prisma.clickEvent.count(),
    prisma.clickEvent.count({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  res.json({
    totalLinks,
    totalClicks,
    recentClicks,
  });
});

router.get('/links/:trackingId/events', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;
  const { limit = 100, offset = 0 } = req.query;

  const events = await prisma.clickEvent.findMany({
    where: { trackingId },
    orderBy: { timestamp: 'desc' },
    take: parseInt(limit, 10),
    skip: parseInt(offset, 10),
  });

  res.json(events);
});

router.get('/links/:trackingId/countries', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const countries = await prisma.clickEvent.groupBy({
    by: ['country'],
    where: {
      trackingId,
      country: { not: null },
    },
    _count: true,
    orderBy: {
      _count: { country: 'desc' },
    },
  });

  res.json(countries.map(c => ({
    country: c.country || 'Unknown',
    count: c._count,
  })));
});

router.get('/links/:trackingId/devices', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const devices = await prisma.clickEvent.groupBy({
    by: ['deviceType'],
    where: {
      trackingId,
      deviceType: { not: null },
    },
    _count: true,
    orderBy: {
      _count: { deviceType: 'desc' },
    },
  });

  res.json(devices.map(d => ({
    deviceType: d.deviceType || 'Unknown',
    count: d._count,
  })));
});

router.get('/links/:trackingId/browsers', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const browsers = await prisma.clickEvent.groupBy({
    by: ['browser'],
    where: {
      trackingId,
      browser: { not: null },
    },
    _count: true,
    orderBy: {
      _count: { browser: 'desc' },
    },
  });

  res.json(browsers.map(b => ({
    browser: b.browser || 'Unknown',
    count: b._count,
  })));
});

router.get('/links/:trackingId/timeline', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;
  const { days = 7 } = req.query;

  const events = await prisma.clickEvent.findMany({
    where: {
      trackingId,
      timestamp: {
        gte: new Date(Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      timestamp: true,
    },
  });

  const dailyCounts = events.reduce((acc, event) => {
    const date = event.timestamp.toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  res.json(
    Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  );
});

router.get('/links/:trackingId/os', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const os = await prisma.clickEvent.groupBy({
    by: ['os'],
    where: {
      trackingId,
      os: { not: null },
    },
    _count: true,
    orderBy: {
      _count: { os: 'desc' },
    },
  });

  res.json(os.map(o => ({
    os: o.os || 'Unknown',
    count: o._count,
  })));
});

router.get('/links/:trackingId/languages', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const languages = await prisma.clickEvent.groupBy({
    by: ['language'],
    where: {
      trackingId,
      language: { not: null },
    },
    _count: true,
    orderBy: {
      _count: { language: 'desc' },
    },
  });

  res.json(languages.map(l => ({
    language: l.language || 'Unknown',
    count: l._count,
  })));
});

router.get('/links/:trackingId/referrers', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const referrers = await prisma.clickEvent.groupBy({
    by: ['referrer'],
    where: {
      trackingId,
    },
    _count: true,
    orderBy: {
      _count: { referrer: 'desc' },
    },
    take: 10,
  });

  res.json(referrers.map(r => ({
    referrer: r.referrer || 'Direct',
    count: r._count,
  })));
});

router.get('/links/:trackingId/cities', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const cities = await prisma.clickEvent.groupBy({
    by: ['city', 'country'],
    where: {
      trackingId,
      city: { not: null },
    },
    _count: true,
    orderBy: {
      _count: { city: 'desc' },
    },
    take: 10,
  });

  res.json(cities.map(c => ({
    city: c.city && c.country ? `${c.city}, ${c.country}` : (c.city || 'Unknown'),
    count: c._count,
  })));
});

router.get('/links/:trackingId/fingerprint', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;
  const { limit = 50 } = req.query;

  const events = await prisma.clickEvent.findMany({
    where: { trackingId },
    orderBy: { timestamp: 'desc' },
    take: parseInt(limit, 10),
    select: {
      id: true,
      timestamp: true,
      fingerprintHash: true,
      canvasFingerprintHash: true,
      webglVendor: true,
      webglRenderer: true,
      webgl2Supported: true,
      audioFingerprintHash: true,
      fontsDetected: true,
      isHeadless: true,
      isMobile: true,
      isLikelyBot: true,
      clientBot: true,
      botIndicators: true,
      webrtcEnabled: true,
      webrtcIps: true,
      webrtcRealIp: true,
      webrtcLeakDetected: true,
      sessionStorageEnabled: true,
      localStorageEnabled: true,
      cookieEnabled: true,
      doNotTrack: true,
      pluginsLength: true,
      viewportWidth: true,
      viewportHeight: true,
      screenResolution: true,
      screenPixelRatio: true,
      deviceMemory: true,
      hardwareConcurrency: true,
      language: true,
      languages: true,
      platform: true,
      connectionType: true,
      effectiveConnectionType: true,
      networkDownlink: true,
      networkRtt: true,
      timezone: true,
      timezoneOffset: true,
      batteryLevel: true,
      batteryCharging: true,
      timeOnPage: true,
      scrollDepth: true,
      clicks: true,
      keypresses: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmTerm: true,
      utmContent: true,
    },
  });

  res.json(events);
});

router.get('/links/:trackingId/fingerprint-stats', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const [
    totalBots,
    clientBots,
    headless,
    uniqueFingerprints,
    webglEnabled,
    webrtcLeaks,
    mobileDevices,
    desktopDevices,
    unknownDevices,
    screenSizes,
    connectionTypes,
    browserVendors,
    timezoneOffsets,
    avgTimeOnPage,
    avgScrollDepth,
    utmSources,
  ] = await Promise.all([
    prisma.clickEvent.count({ where: { trackingId, isLikelyBot: true } }),
    prisma.clickEvent.count({ where: { trackingId, clientBot: true } }),
    prisma.clickEvent.count({ where: { trackingId, isHeadless: true } }),
    prisma.clickEvent.groupBy({ by: ['fingerprintHash'], where: { trackingId, fingerprintHash: { not: null } }, _count: true }),
    prisma.clickEvent.count({ where: { trackingId, webglRenderer: { not: null } } }),
    prisma.clickEvent.count({ where: { trackingId, webrtcLeakDetected: true } }),
    prisma.clickEvent.count({ where: { trackingId, isMobile: true } }),
    prisma.clickEvent.count({ where: { trackingId, isMobile: false } }),
    prisma.clickEvent.count({ where: { trackingId, isMobile: null } }),
    prisma.clickEvent.groupBy({ by: ['screenResolution'], where: { trackingId, screenResolution: { not: null } }, _count: true, orderBy: { _count: { screenResolution: 'desc' } }, take: 10 }),
    prisma.clickEvent.groupBy({ by: ['connectionType'], where: { trackingId, connectionType: { not: null } }, _count: true }),
    prisma.clickEvent.groupBy({ by: ['browser'], where: { trackingId, browser: { not: null } }, _count: true, orderBy: { _count: { browser: 'desc' } }, take: 10 }),
    prisma.clickEvent.groupBy({ by: ['timezoneOffset'], where: { trackingId, timezoneOffset: { not: null } }, _count: true, orderBy: { _count: { timezoneOffset: 'desc' } }, take: 10 }),
    prisma.clickEvent.aggregate({ where: { trackingId, timeOnPage: { not: null } }, _avg: { timeOnPage: true } }),
    prisma.clickEvent.aggregate({ where: { trackingId, scrollDepth: { not: null } }, _avg: { scrollDepth: true } }),
    prisma.clickEvent.groupBy({ by: ['utmSource'], where: { trackingId, utmSource: { not: null } }, _count: true, orderBy: { _count: { utmSource: 'desc' } } }),
  ]);

  res.json({
    botDetection: {
      totalBots,
      clientBots,
      headless,
      uniqueFingerprints: uniqueFingerprints.length,
    },
    devices: {
      mobile: mobileDevices,
      desktop: desktopDevices,
      unknown: unknownDevices,
    },
    fingerprinting: {
      webglEnabled,
      webrtcLeaks,
    },
    screenSizes: screenSizes.map(s => ({ resolution: s.screenResolution, count: s._count })),
    connectionTypes: connectionTypes.map(c => ({ type: c.connectionType, count: c._count })),
    browsers: browserVendors.map(b => ({ browser: b.browser, count: b._count })),
    timezones: timezoneOffsets.map(t => ({ offset: t.timezoneOffset, count: t._count })),
    averages: {
      timeOnPage: avgTimeOnPage._avg.timeOnPage ? Math.round(avgTimeOnPage._avg.timeOnPage) : null,
      scrollDepth: avgScrollDepth._avg.scrollDepth ? Math.round(avgScrollDepth._avg.scrollDepth) : null,
    },
    utmSources: utmSources.map(u => ({ source: u.utmSource, count: u._count })),
  });
});

router.get('/links/:trackingId/fingerprint-analysis', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const fingerprintGroups = await prisma.clickEvent.groupBy({
    by: ['fingerprintHash'],
    where: { trackingId, fingerprintHash: { not: null } },
    _count: true,
    orderBy: { _count: { fingerprintHash: 'desc' } },
    take: 20,
  });

  const browserFingerprints = await prisma.clickEvent.groupBy({
    by: ['browser', 'webglRenderer'],
    where: { trackingId, webglRenderer: { not: null } },
    _count: true,
    orderBy: { _count: { webglRenderer: 'desc' } },
    take: 20,
  });

  const webglAnalysis = await prisma.clickEvent.findMany({
    where: { trackingId, webglRenderer: { not: null } },
    select: { webglVendor: true, webglRenderer: true, _count: true },
    distinct: ['webglRenderer'],
    take: 20,
  });

  res.json({
    topFingerprints: fingerprintGroups.map(f => ({
      fingerprint: f.fingerprintHash,
      count: f._count,
    })),
    browserFingerprints: browserFingerprints.map(b => ({
      browser: b.browser,
      webglRenderer: b.webglRenderer,
      count: b._count,
    })),
    webglDevices: webglAnalysis.map(w => ({
      vendor: w.webglVendor,
      renderer: w.webglRenderer,
    })),
  });
});

router.get('/links/:trackingId/utm-analysis', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const [sources, mediums, campaigns, terms, contents] = await Promise.all([
    prisma.clickEvent.groupBy({
      by: ['utmSource'],
      where: { trackingId, utmSource: { not: null } },
      _count: true,
      orderBy: { _count: { utmSource: 'desc' } },
    }),
    prisma.clickEvent.groupBy({
      by: ['utmMedium'],
      where: { trackingId, utmMedium: { not: null } },
      _count: true,
      orderBy: { _count: { utmMedium: 'desc' } },
    }),
    prisma.clickEvent.groupBy({
      by: ['utmCampaign'],
      where: { trackingId, utmCampaign: { not: null } },
      _count: true,
      orderBy: { _count: { utmCampaign: 'desc' } },
    }),
    prisma.clickEvent.groupBy({
      by: ['utmTerm'],
      where: { trackingId, utmTerm: { not: null } },
      _count: true,
      orderBy: { _count: { utmTerm: 'desc' } },
    }),
    prisma.clickEvent.groupBy({
      by: ['utmContent'],
      where: { trackingId, utmContent: { not: null } },
      _count: true,
      orderBy: { _count: { utmContent: 'desc' } },
    }),
  ]);

  res.json({
    sources: sources.map(s => ({ source: s.utmSource, count: s._count })),
    mediums: mediums.map(m => ({ medium: m.utmMedium, count: m._count })),
    campaigns: campaigns.map(c => ({ campaign: c.utmCampaign, count: c._count })),
    terms: terms.map(t => ({ term: t.utmTerm, count: t._count })),
    contents: contents.map(c => ({ content: c.utmContent, count: c._count })),
  });
});

// ISPs endpoint
router.get('/links/:trackingId/isps', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const isps = await prisma.clickEvent.groupBy({
    by: ['isp'],
    where: { trackingId, isp: { not: null } },
    _count: true,
    orderBy: { _count: { isp: 'desc' } },
    take: 20,
  });

  res.json(isps.map(i => ({ isp: i.isp, count: i._count })));
});

// Security/VPN detection endpoint
router.get('/links/:trackingId/security', basicAuth, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const [vpn, proxy, tor, hosting, webrtcLeaks, bots] = await Promise.all([
    prisma.clickEvent.count({ where: { trackingId, isVpn: true } }),
    prisma.clickEvent.count({ where: { trackingId, isProxy: true } }),
    prisma.clickEvent.count({ where: { trackingId, isTor: true } }),
    prisma.clickEvent.count({ where: { trackingId, isHosting: true } }),
    prisma.clickEvent.count({ where: { trackingId, webrtcLeakDetected: true } }),
    prisma.clickEvent.count({ where: { trackingId, isLikelyBot: true } }),
  ]);

  res.json({ vpn, proxy, tor, hosting, webrtcLeaks, bots });
});

// UTM endpoint (alias for utm-analysis)
router.get('/links/:trackingId/utm', basicAuth, async (req, res) => {
  req.url = req.url.replace('/utm', '/utm-analysis');
  req.app.handle(req, res);
});

export default router;