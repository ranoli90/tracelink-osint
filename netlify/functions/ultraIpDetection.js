/**
 * ULTRA-ADVANCED IP Intelligence System v2033 - ZERO REGISTRATION EDITION
 * Works with 100% free, no-registration APIs and open-source data
 * - IP-API (free, 45 req/min, no key needed)
 * - Proxycheck (free tier, no key for basic)
 * - GetIPIntel (free, no key)
 * - Open-source IP blocklists
 * - Heuristic detection (always free)
 */

import crypto from 'crypto';

// API Keys (optional - system works 100% without them)
// Add these later for enhanced detection:
const IPINFO_TOKEN = process.env.IPINFO_TOKEN || '';
const ABUSEIPDB_KEY = process.env.ABUSEIPDB_KEY || '';
const GREYNOISE_KEY = process.env.GREYNOISE_KEY || '';
const IPREGISTRY_KEY = process.env.IPREGISTRY_KEY || '';

// ==================== FREE NO-REGISTRATION APIs ====================

// IP-API - FREE, no registration, 45 requests/minute
// Fields: geo, ISP, proxy/hosting flags
const IPAPI_FREE = (ip) =>
  `http://ip-api.com/json/${ip}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting&lang=en`;

// Proxycheck - FREE tier, no key required for basic checks
// Provides: VPN, proxy, threat score
const PROXYCHECK_FREE = (ip) =>
  `https://proxycheck.io/v2/${ip}?vpn=1&asn=1&node=1&time=1&inf=1&port=1&seen=1&days=7&tag=tracelink`;

// GetIPIntel - FREE, no registration required
// Provides: proxy probability score (0-1)
const GETIPINTEL_FREE = (ip) =>
  `https://check.getipintel.net/check.php?ip=${ip}&contact=test@example.com&flags=b&format=json`;

// IPInfo - FREE tier with 50k requests/month (optional, key needed)
// Without key: limited to basic geo only
const IPINFO_FREE = (ip) =>
  `https://ipinfo.io/${ip}/json`;

// ==================== OPEN SOURCE THREAT INTEL ====================

// Free blocklists - no registration, updated regularly
const BLOCKLIST_URLS = {
  // FireHOL Level 1 - aggregated threat intel
  firehol_l1: 'https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset',
  // FireHOL Level 2 - supplementary threats
  firehol_l2: 'https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level2.netset',
  // Blocklist.de - brute force attackers
  blocklist_de: 'https://lists.blocklist.de/lists/all.txt',
  // Abuse.ch Feodo Tracker - botnet C2
  feodo: 'https://feodotracker.abuse.ch/downloads/ipblocklist.txt',
  // Spamhaus DROP list
  spamhaus_drop: 'https://www.spamhaus.org/drop/drop.txt',
  // Tor exit nodes
  tor_exits: 'https://check.torproject.org/torbulkexitlist',
  // VPN providers (aggregated)
  vpn_ipv4: 'https://raw.githubusercontent.com/josephrocca/is-vpn/main/vpn-or-datacenter-ipv4-ranges.txt',
  // Datacenter ranges
  datacenter: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/datacenter/ipv4.txt'
};

// Cache for blocklists (refresh every 6 hours)
let blocklistCache = {
  data: new Map(),
  lastUpdate: 0,
  updating: false
};

// VPN/Proxy detection patterns (2026 updated)
const VPN_PATTERNS = {
  commercial: [
    'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'private internet access',
    'pia', 'ipvanish', 'vyprvpn', 'tunnelbear', 'hotspot shield', 'windscribe',
    'protonvpn', 'mullvad', 'airvpn', 'torguard', 'perfect privacy', 'ovpn',
    'ivacy', 'purevpn', 'strongvpn', 'hide.me', 'zenmate', 'safervpn',
    'cactusvpn', 'ibvpn', 'trust.zone', 'vpn.ac', 'cryptostorm', 'azirevpn',
    'mozvpn', 'atlas vpn', 'surf vpn', 'veePN', 'hola', 'betternet',
    'touchvpn', 'speedify', 'psiphon', 'outline', 'shadowsocks', 'wireguard',
    'algo', 'riseup', 'blackvpn', 'boleh', 'boxpn', 'buffered',
    'cloak', 'defencevpn', 'dotvpn', 'encrypt.me', 'exprebpn', 'faceless',
    'freedome', 'frootvpn', 'goose', 'hidemyass', 'hma', 'hoxx',
    'keenow', 'le vpn', 'limevpn', 'mcafee safe connect', 'octane',
    'onevpn', 'personalvpn', 'ra4w', 'sectovpn', 'slick', 'slickvpn',
    'sunshine', 'supernet', 'swissvpn', 'switchvpn', 'totalvpn',
    'unblock-us', 'unlocator', 'unspyable', 'usa ip', 'uvpn', 'vpn4all',
    'vpn.ht', 'vpnarea', 'vpnbaron', 'vpnfacile', 'vpnland', 'vpnranks',
    'vpnsecure', 'vpnunlimited', 'vpnwise', 'worldvpn', 'zenvpn'
  ],
  datacenter: [
    'amazon web services', 'aws', 'google cloud', 'gcp', 'microsoft azure',
    'digitalocean', 'linode', 'vultr', 'ovh', 'hetzner', 'choopa', 'psychz',
    'colocrossing', 'frantech', 'buyvm', 'ramnode', 'contabo', 'scaleway',
    'upcloud', 'packet', 'equinix', 'datapacket', 'webnx', 'nexeon',
    'hostwinds', 'dedipath', 'hivelocity', 'quadranet', 'clouvider',
    'zare', 'koddos', 'blazingseo', 'luxhosting', 'terrhost', 'maxided',
    'snel', 'netcup', 'servercentral', 'softlayer', 'rackspace', 'dreamhost',
    'bluehost', 'hostgator', 'godaddy', 'siteground', 'inmotion', 'liquidweb',
    'hostinger', 'a2hosting', 'greengeeks', 'hostpapa', 'fatcow', 'ipage',
    'justhost', 'aruba', 'ionos', '1&1', 'strato', 'gandi', 'ovhcloud',
    'alibaba cloud', 'tencent cloud', 'baidu cloud', 'huawei cloud',
    'oracle cloud', 'ibm cloud', 'salesforce', 'vmware', 'citrix'
  ],
  residential: [
    'luminati', 'brightdata', 'bright data', 'oxylabs', 'smartproxy',
    'soax', 'netnut', 'packetstream', 'iproyal', 'proxyrack',
    'stormproxies', 'rotatingproxy', 'shifter', 'geosurf', 'microleaves',
    'scrapinghub', 'crawlera', 'scrapingbee', 'scrapingant', 'zenrows',
    'scraperapi', 'webshare', 'proxy-cheap', 'rayobyte', 'blazingproxies',
    'highproxies', 'sslproxies', 'usproxy', 'ukproxies', 'proxymesh',
    'anonymizer', 'privateproxy', 'buyproxies', 'instantproxies',
    'squidproxies', 'actproxy', 'proxy-n-vpn', 'sslprivateproxy',
    'proxyhub', 'newipnow', 'webproxies', 'proxybonanza'
  ],
  tor: [
    'tor-exit', 'tornode', 'tor exit', 'tor node', 'tor relay',
    'dannet', 'onion', 'torproject'
  ],
  hosting: [
    'hosting', 'dedicated', 'vps', 'virtual private server',
    'cloud server', 'root server', 'bare metal', 'colo', 'colocation'
  ]
};

// ASN Reputation Database (2026) - Known VPS/hosting ASNs
const SUSPICIOUS_ASNS = new Set([
  14061, 16509, 15169, 8075, 16276, 24940, 20473, 40676,
  51167, 12876, 28753, 60068, 20454, 8100, 46844, 55286,
  63473, 29802, 55293, 19969, 54290, 36352, 36114, 32780,
  11878, 29873, 46816, 397373, 53667, 62744, 206092
]);

// Cache system
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const cache = new Map();

// Threat scoring weights
const THREAT_WEIGHTS = {
  knownVpn: 30,
  knownProxy: 40,
  knownTor: 50,
  datacenter: 25,
  residentialProxy: 45,
  blacklisted: 60,
  malwareHost: 70,
  suspiciousAsn: 20,
  timeMismatch: 15,
  velocityCheck: 25,
  behaviorAnomaly: 35,
  reputationScore: 40
};

/**
 * Load blocklists from open-source URLs (runs in background)
 */
async function updateBlocklists() {
  if (blocklistCache.updating || Date.now() - blocklistCache.lastUpdate < 6 * 60 * 60 * 1000) {
    return;
  }

  blocklistCache.updating = true;

  try {
    // Fetch critical lists in parallel
    const [torList, vpnList] = await Promise.allSettled([
      fetchList(BLOCKLIST_URLS.tor_exits),
      fetchList(BLOCKLIST_URLS.vpn_ipv4)
    ]);

    if (torList.status === 'fulfilled') {
      torList.value.forEach(ip => blocklistCache.data.set(ip, 'tor'));
    }
    if (vpnList.status === 'fulfilled') {
      // Parse CIDR ranges
      vpnList.value.forEach(line => {
        if (line.includes('/')) {
          blocklistCache.data.set(line, 'vpn');
        }
      });
    }

    blocklistCache.lastUpdate = Date.now();
  } catch (e) {
    console.error('Blocklist update failed:', e.message);
  } finally {
    blocklistCache.updating = false;
  }
}

async function fetchList(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await response.text();
    return text.split('\n').filter(line => line && !line.startsWith('#'));
  } catch (e) {
    return [];
  }
}

/**
 * Main IP Analysis Function - 100% FREE
 */
export async function analyzeIpAdvanced(ip, context = {}) {
  const startTime = Date.now();

  if (!ip || isLocalIp(ip)) {
    return getLocalIpResult(ip);
  }

  const cleanIp = normalizeIp(ip);
  const cacheKey = `ip_${cleanIp}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  // Update blocklists in background (wait up to 200ms in serverless context)
  await Promise.race([
    updateBlocklists(),
    new Promise(resolve => setTimeout(resolve, 200))
  ]).catch(() => { });

  try {
    // Fetch from FREE no-registration APIs in parallel
    const [ipApiData, proxycheckData, getipintelData, ipinfoData] = await Promise.allSettled([
      fetchIpApiFree(cleanIp),
      fetchProxycheckFree(cleanIp),
      fetchGetIpIntelFree(cleanIp),
      fetchIpinfoFree(cleanIp)
    ]);

    // Merge intelligence from all sources
    const intelligence = mergeIntelligence({
      ipApi: ipApiData.status === 'fulfilled' ? ipApiData.value : null,
      proxycheck: proxycheckData.status === 'fulfilled' ? proxycheckData.value : null,
      getipintel: getipintelData.status === 'fulfilled' ? getipintelData.value : null,
      ipinfo: ipinfoData.status === 'fulfilled' ? ipinfoData.value : null,
      blocklists: checkBlocklists(cleanIp)
    });

    // Advanced threat analysis
    const threatAnalysis = calculateThreatScore(intelligence, context);

    // VPN bypass detection
    const bypassResult = await attemptVpnBypass(cleanIp, intelligence, context);

    // Behavioral analysis
    const behaviorScore = analyzeBehavior(context, intelligence);

    // Generate comprehensive result
    const result = {
      ip: cleanIp,
      ipVersion: cleanIp.includes(':') ? 6 : 4,

      // Geo-location
      geo: {
        country: intelligence.country,
        countryCode: intelligence.countryCode,
        region: intelligence.region,
        regionCode: intelligence.regionCode,
        city: intelligence.city,
        district: intelligence.district,
        zip: intelligence.zip,
        latitude: intelligence.latitude,
        longitude: intelligence.longitude,
        timezone: intelligence.timezone,
        accuracy: intelligence.accuracy || 'city'
      },

      // Network
      network: {
        isp: intelligence.isp,
        org: intelligence.org,
        asn: intelligence.asn,
        asname: intelligence.asname,
        connectionType: intelligence.connectionType,
        carrier: intelligence.carrier,
        mobile: intelligence.mobile || false,
        proxy: intelligence.proxy || false,
        hosting: intelligence.hosting || false,
        reverseDns: intelligence.reverseDns,
        domain: intelligence.domain
      },

      // Security
      security: {
        threatScore: threatAnalysis.score,
        threatLevel: threatAnalysis.level,
        isVpn: threatAnalysis.isVpn,
        isProxy: threatAnalysis.isProxy,
        isTor: threatAnalysis.isTor,
        isDatacenter: threatAnalysis.isDatacenter,
        isResidentialProxy: threatAnalysis.isResidentialProxy,
        isBadActor: threatAnalysis.isBadActor,
        isAnonymous: threatAnalysis.isAnonymous,
        isAttacker: threatAnalysis.isAttacker,
        isAbuser: threatAnalysis.isAbuser,
        isThreat: threatAnalysis.isThreat,
        reputation: threatAnalysis.reputation,
        vpnType: threatAnalysis.vpnType,
        vpnProvider: threatAnalysis.vpnProvider,
        proxyType: threatAnalysis.proxyType,
        torNodeType: threatAnalysis.torNodeType,
        detectionMethods: threatAnalysis.methods,
        indicators: threatAnalysis.indicators,
        confidence: threatAnalysis.confidence
      },

      // VPN bypass
      bypass: {
        realIpDetected: bypassResult.realIp !== null,
        realIp: bypassResult.realIp,
        realIpGeo: bypassResult.realIpGeo,
        bypassMethod: bypassResult.method,
        bypassConfidence: bypassResult.confidence,
        webrtcLeak: bypassResult.webrtcLeak,
        dnsLeak: bypassResult.dnsLeak,
        timeZoneMismatch: bypassResult.timeZoneMismatch
      },

      // Intelligence
      intelligence: {
        blocklistMatch: intelligence.blocklistMatch,
        blocklistType: intelligence.blocklistType,
        proxycheckRisk: intelligence.proxycheckRisk,
        getipintelScore: intelligence.getipintelScore,
        knownMalicious: intelligence.blocklistMatch !== null
      },

      // Behavior
      behavior: {
        score: behaviorScore.score,
        anomalies: behaviorScore.anomalies,
        riskFactors: behaviorScore.riskFactors
      },

      // Metadata
      metadata: {
        queryTime: Date.now() - startTime,
        sourcesUsed: intelligence.sourcesUsed || [],
        cacheHit: false,
        timestamp: new Date().toISOString()
      }
    };

    // Cache result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error('Advanced IP analysis error:', error);
    return getFallbackResult(cleanIp);
  }
}

/**
 * FREE API: IP-API (no registration, 45 req/min)
 */
async function fetchIpApiFree(ip) {
  try {
    const response = await fetchWithTimeout(IPAPI_FREE(ip), 5000);
    const data = await response.json();

    if (data.status === 'success') {
      return {
        country: data.country,
        countryCode: data.countryCode,
        region: data.regionName,
        regionCode: data.region,
        city: data.city,
        district: data.district,
        zip: data.zip,
        latitude: data.lat,
        longitude: data.lon,
        timezone: data.timezone,
        isp: data.isp,
        org: data.org,
        asn: data.as ? data.as.replace(/^AS\s*/i, '').split(' ')[0] : null,
        asname: data.asname,
        reverseDns: data.reverse,
        continent: data.continent,
        continentCode: data.continentCode,
        mobile: data.mobile,
        proxy: data.proxy,
        hosting: data.hosting
      };
    }
    return null;
  } catch (error) {
    console.error('IP-API error:', error.message);
    return null;
  }
}

/**
 * FREE API: Proxycheck (free tier, no key for basic)
 */
async function fetchProxycheckFree(ip) {
  try {
    const response = await fetchWithTimeout(PROXYCHECK_FREE(ip), 5000);
    const data = await response.json();

    if (data.status === 'ok' && data[ip]) {
      const info = data[ip];
      return {
        proxy: info.proxy === 'yes',
        vpn: info.type === 'VPN',
        type: info.type,
        provider: info.provider,
        country: info.country,
        city: info.city,
        region: info.region,
        risk: info.risk,
        attackHistory: info.attack_history,
        lastSeen: info.last_seen_human,
        port: info.port,
        operator: info.operator,
        asn: info.asn
      };
    }
    return null;
  } catch (error) {
    console.error('Proxycheck error:', error.message);
    return null;
  }
}

/**
 * FREE API: GetIPIntel (free, no registration)
 */
async function fetchGetIpIntelFree(ip) {
  try {
    const response = await fetchWithTimeout(GETIPINTEL_FREE(ip), 5000);
    const data = await response.json();

    return {
      result: data.result,
      isProxy: parseFloat(data.result) > 0.8,
      proxyProbability: parseFloat(data.result),
      queryTime: data.queryTime,
      queryID: data.queryID
    };
  } catch (error) {
    console.error('GetIPIntel error:', error.message);
    return null;
  }
}

/**
 * FREE API: IPInfo (limited without key)
 */
async function fetchIpinfoFree(ip) {
  try {
    const response = await fetchWithTimeout(IPINFO_FREE(ip), 4000);
    const data = await response.json();

    let latitude = null, longitude = null;
    if (data.loc) {
      const [lat, lng] = data.loc.split(',');
      latitude = parseFloat(lat);
      longitude = parseFloat(lng);
    }

    return {
      country: data.country_name || data.country,
      countryCode: data.country,
      region: data.region,
      city: data.city,
      latitude,
      longitude,
      timezone: data.timezone,
      org: data.org,
      asn: data.asn,
      asname: data.asn?.name
    };
  } catch (error) {
    console.error('IPInfo error:', error.message);
    return null;
  }
}

/**
 * Check open-source blocklists (no API, free)
 */
function checkBlocklists(ip) {
  const match = blocklistCache.data.get(ip);
  if (match) {
    return { match: true, type: match };
  }

  // Check CIDR ranges
  for (const [cidr, type] of blocklistCache.data) {
    if (cidr.includes('/') && ipInCidr(ip, cidr)) {
      return { match: true, type };
    }
  }

  return { match: false, type: null };
}

function ipInCidr(ip, cidr) {
  try {
    const [range, bits] = cidr.split('/');
    const mask = parseInt(bits, 10);

    const ipInt = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    const rangeInt = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;

    const maskInt = mask === 0 ? 0 : (0xffffffff << (32 - mask)) >>> 0;

    return (ipInt & maskInt) === (rangeInt & maskInt);
  } catch (e) {
    return false;
  }
}

/**
 * Attempt VPN bypass using free methods
 */
async function attemptVpnBypass(ip, intelligence, context) {
  const result = {
    realIp: null,
    realIpGeo: null,
    method: null,
    confidence: 0,
    webrtcLeak: false,
    dnsLeak: false,
    timeZoneMismatch: false
  };

  // WebRTC leak detection (100% free, no API)
  if (context.webrtcIps && context.webrtcIps.length > 0) {
    const publicWebRTC = context.webrtcIps.filter(wip => !isLocalIp(wip) && !isPrivateIP(wip));

    for (const wip of publicWebRTC) {
      if (wip !== ip) {
        // CGNAT Check: Does the WebRTC IP belong to the same ASN/ISP as the Server IP?
        // If so, it's likely a cellular connection (CGNAT), not a VPN leak.
        let isCgnat = false;
        if (intelligence.asn && intelligence.mobile) {
          try {
            const wipInfo = await fetchIpApiFree(wip);
            if (wipInfo && wipInfo.asn === intelligence.asn) {
              isCgnat = true;
            }
          } catch (e) { }
        }

        if (!isCgnat) {
          result.realIp = wip;
          result.webrtcLeak = true;
          result.method = 'webrtc_bypass';
          result.confidence = 85;
          break;
        }
      }
    }
  }

  // Timezone mismatch (100% free)
  if (context.timezone && intelligence.timezone) {
    const clientOffset = getTimezoneOffset(context.timezone);
    const ipOffset = getTimezoneOffset(intelligence.timezone);

    if (Math.abs(clientOffset - ipOffset) > 180) {
      result.timeZoneMismatch = true;
      if (!result.method) {
        result.method = 'timezone_mismatch';
        result.confidence = 60;
      }
    }
  }

  return result;
}

/**
 * Calculate threat score using free detection methods
 */
function calculateThreatScore(intelligence, context) {
  let score = 0;
  let confidence = 0;
  const methods = [];
  const indicators = [];

  const searchText = `${intelligence.isp || ''} ${intelligence.org || ''} ${intelligence.asname || ''} ${intelligence.reverseDns || ''}`.toLowerCase();

  // Check blocklists (free)
  if (intelligence.blocklistMatch) {
    score += THREAT_WEIGHTS.blacklisted;
    indicators.push(`blocklist:${intelligence.blocklistType}`);
    methods.push('blocklist');
    confidence += 40;
  }

  // VPN detection via patterns (free)
  let isVpn = false;
  let vpnType = null;
  let vpnProvider = null;

  for (const pattern of VPN_PATTERNS.commercial) {
    if (searchText.includes(pattern)) {
      isVpn = true;
      vpnType = 'commercial';
      vpnProvider = pattern;
      score += THREAT_WEIGHTS.knownVpn;
      indicators.push(`vpn_provider:${pattern}`);
      methods.push('isp_heuristic');
      confidence += 25;
      break;
    }
  }

  // Proxy detection via API flags (free)
  let isProxy = intelligence.proxy || false;
  let proxyType = isProxy ? 'unknown' : null;

  if (intelligence.proxy) {
    score += THREAT_WEIGHTS.knownProxy;
    indicators.push('api_flagged_proxy');
    methods.push('api_detection');
    confidence += 20;
  }

  // GetIPIntel score (free)
  if (intelligence.getipintelScore > 0.8) {
    isProxy = true;
    proxyType = 'suspected';
    score += Math.min(intelligence.getipintelScore * 40, THREAT_WEIGHTS.knownProxy);
    indicators.push(`getipintel_score:${intelligence.getipintelScore.toFixed(2)}`);
    methods.push('getipintel');
    confidence += 15;
  }

  // Residential proxy detection (free)
  let isResidentialProxy = false;
  for (const pattern of VPN_PATTERNS.residential) {
    if (searchText.includes(pattern)) {
      isResidentialProxy = true;
      isProxy = true;
      proxyType = 'residential';
      score += THREAT_WEIGHTS.residentialProxy;
      indicators.push(`residential_proxy:${pattern}`);
      methods.push('residential_heuristic');
      confidence += 30;
      break;
    }
  }

  // Tor detection (free)
  let isTor = false;
  let torNodeType = null;
  for (const pattern of VPN_PATTERNS.tor) {
    if (searchText.includes(pattern)) {
      isTor = true;
      torNodeType = pattern.includes('exit') ? 'exit' : 'relay';
      score += THREAT_WEIGHTS.knownTor;
      indicators.push(`tor_node:${torNodeType}`);
      methods.push('tor_heuristic');
      confidence += 35;
      break;
    }
  }

  // Blocklist tor check
  if (intelligence.blocklistType === 'tor') {
    isTor = true;
    torNodeType = 'exit';
    score += THREAT_WEIGHTS.knownTor;
    indicators.push('tor_blocklist');
    methods.push('blocklist');
    confidence += 40;
  }

  // Datacenter detection (free)
  let isDatacenter = intelligence.hosting || false;
  for (const pattern of VPN_PATTERNS.datacenter) {
    if (searchText.includes(pattern)) {
      isDatacenter = true;
      score += THREAT_WEIGHTS.datacenter;
      indicators.push(`datacenter:${pattern}`);
      methods.push('datacenter_heuristic');
      confidence += 15;
      break;
    }
  }

  // ASN reputation (free)
  const asnNum = parseInt(intelligence.asn, 10);
  if (SUSPICIOUS_ASNS.has(asnNum)) {
    score += THREAT_WEIGHTS.suspiciousAsn;
    indicators.push(`suspicious_asn:${asnNum}`);
    methods.push('asn_reputation');
    confidence += 20;
  }

  // Proxycheck risk score (free tier)
  if (intelligence.proxycheckRisk > 50) {
    score += Math.min(intelligence.proxycheckRisk / 2, THREAT_WEIGHTS.blacklisted);
    indicators.push(`proxycheck_risk:${intelligence.proxycheckRisk}`);
    methods.push('proxycheck');
    confidence += 20;
  }

  // Determine threat level
  let threatLevel = 'low';
  if (score >= 80) threatLevel = 'critical';
  else if (score >= 60) threatLevel = 'high';
  else if (score >= 40) threatLevel = 'medium';

  confidence = Math.min(confidence, 100);

  return {
    score: Math.min(score, 100),
    level: threatLevel,
    isVpn,
    isProxy,
    isTor,
    isDatacenter,
    isResidentialProxy,
    isBadActor: score >= 60 || intelligence.blocklistMatch,
    isAnonymous: isVpn || isProxy || isTor,
    isAttacker: intelligence.blocklistMatch && intelligence.blocklistType === 'firehol',
    isAbuser: score > 50,
    isThreat: score >= 50 || intelligence.blocklistMatch,
    reputation: score > 50 ? 'poor' : score > 25 ? 'questionable' : 'good',
    vpnType,
    vpnProvider,
    proxyType,
    torNodeType,
    methods: [...new Set(methods)],
    indicators,
    confidence
  };
}

/**
 * Analyze behavioral patterns (100% free)
 */
function analyzeBehavior(context, intelligence) {
  const anomalies = [];
  const riskFactors = [];

  if (context.fingerprintData) {
    const fp = context.fingerprintData;

    if (fp.timezone && intelligence.timezone) {
      if (fp.timezone !== intelligence.timezone) {
        anomalies.push('timezone_mismatch');
        riskFactors.push('Possible VPN or location spoofing');
      }
    }

    if (fp.language && intelligence.countryCode) {
      const langCountry = getLanguageCountry(fp.language);
      if (langCountry && langCountry !== intelligence.countryCode) {
        anomalies.push('language_country_mismatch');
        riskFactors.push('Language does not match IP country');
      }
    }

    if (fp.isBot || fp.botScore > 50) {
      anomalies.push('automated_behavior');
      riskFactors.push('Bot-like behavior detected');
    }

    if (fp.isHeadless) {
      anomalies.push('headless_browser');
      riskFactors.push('Headless browser detected');
    }
  }

  const score = Math.min(anomalies.length * 15, 100);

  return {
    score,
    anomalies,
    riskFactors
  };
}

/**
 * Merge intelligence from all sources
 */
function mergeIntelligence(sources) {
  const result = {
    sourcesUsed: []
  };

  // Priority: IP-API > IPInfo > Proxycheck
  const geoSources = ['ipApi', 'ipinfo'];
  for (const source of geoSources) {
    if (sources[source]) {
      if (sources[source].country) result.country = sources[source].country;
      if (sources[source].countryCode) result.countryCode = sources[source].countryCode;
      if (sources[source].region) result.region = sources[source].region;
      if (sources[source].city) result.city = sources[source].city;
      if (sources[source].latitude) result.latitude = sources[source].latitude;
      if (sources[source].longitude) result.longitude = sources[source].longitude;
      if (sources[source].timezone) result.timezone = sources[source].timezone;
      if (sources[source].isp) result.isp = sources[source].isp;
      if (sources[source].org) result.org = sources[source].org;
      if (sources[source].asn) result.asn = sources[source].asn;
      if (!result.sourcesUsed.includes(source)) result.sourcesUsed.push(source);
    }
  }

  // Proxycheck security data
  if (sources.proxycheck) {
    result.proxy = sources.proxycheck.proxy;
    result.vpn = sources.proxycheck.vpn;
    result.hosting = sources.proxycheck.type === 'Hosting';
    result.proxycheckRisk = sources.proxycheck.risk;
    result.sourcesUsed.push('proxycheck');
  }

  // GetIPIntel
  if (sources.getipintel) {
    result.getipintelScore = sources.getipintel.proxyProbability;
    result.sourcesUsed.push('getipintel');
  }

  // Blocklists
  if (sources.blocklists) {
    result.blocklistMatch = sources.blocklists.match;
    result.blocklistType = sources.blocklists.type;
    if (sources.blocklists.match) result.sourcesUsed.push('blocklist');
  }

  return result;
}

// Utility functions
async function fetchWithTimeout(url, timeout = 5000, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function normalizeIp(ip) {
  if (!ip) return ip;
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  return ip.trim();
}

function isLocalIp(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1') return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  if (ip.startsWith('fe80:')) return true;
  return false;
}

function isPrivateIP(ip) {
  if (!ip) return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  if (ip.startsWith('fe80:')) return true;
  if (ip.startsWith('::1')) return true;
  return false;
}

function getLocalIpResult(ip) {
  return {
    ip,
    ipVersion: ip?.includes(':') ? 6 : 4,
    geo: { country: 'Local', city: 'Local', timezone: 'Local' },
    network: { isp: 'Local', connectionType: 'local' },
    security: {
      threatScore: 0,
      level: 'low',
      isVpn: false,
      isProxy: false,
      isTor: false,
      isDatacenter: false,
      confidence: 100
    },
    bypass: { realIpDetected: false },
    intelligence: {},
    behavior: { score: 0 },
    metadata: { queryTime: 0, sourcesUsed: [], cacheHit: false }
  };
}

function getFallbackResult(ip) {
  return {
    ip,
    ipVersion: ip?.includes(':') ? 6 : 4,
    geo: { country: null, city: null, timezone: null },
    network: { isp: null, connectionType: null },
    security: {
      threatScore: 0,
      level: 'unknown',
      isVpn: null,
      isProxy: null,
      isTor: null,
      isDatacenter: null,
      confidence: 0
    },
    bypass: { realIpDetected: false },
    intelligence: {},
    behavior: { score: 0 },
    metadata: { queryTime: 0, sourcesUsed: [], cacheHit: false }
  };
}

function getTimezoneOffset(timezone) {
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    if (offsetPart) {
      const match = offsetPart.value.match(/GMT([+-]\d+)/);
      if (match) return parseInt(match[1]) * 60;
    }
  } catch (e) {
    return 0;
  }
  return 0;
}

function getLanguageCountry(language) {
  const langMap = {
    'en': 'US', 'en-GB': 'GB', 'en-US': 'US', 'en-CA': 'CA', 'en-AU': 'AU',
    'es': 'ES', 'es-MX': 'MX', 'es-AR': 'AR', 'es-CO': 'CO',
    'fr': 'FR', 'fr-CA': 'CA', 'fr-BE': 'BE',
    'de': 'DE', 'de-AT': 'AT', 'de-CH': 'CH',
    'it': 'IT', 'pt': 'PT', 'pt-BR': 'BR',
    'ru': 'RU', 'ja': 'JP', 'zh': 'CN', 'zh-TW': 'TW',
    'ko': 'KR', 'ar': 'SA', 'hi': 'IN', 'nl': 'NL',
    'pl': 'PL', 'tr': 'TR', 'sv': 'SE', 'da': 'DK',
    'no': 'NO', 'fi': 'FI', 'cs': 'CZ', 'hu': 'HU',
    'ro': 'RO', 'el': 'GR', 'he': 'IL', 'th': 'TH',
    'vi': 'VN', 'id': 'ID', 'ms': 'MY', 'tl': 'PH',
    'uk': 'UA', 'bg': 'BG', 'hr': 'HR', 'sr': 'RS',
    'sk': 'SK', 'sl': 'SI', 'lt': 'LT', 'lv': 'LV',
    'et': 'EE'
  };
  return langMap[language] || null;
}

export default {
  analyzeIpAdvanced,
  isLocalIp,
  normalizeIp
};
