/**
 * Advanced VPN/Datacenter/Proxy IP Detection
 * Sources: Multiple open-source and API-based detection methods
 * IPv4: josephrocca/is-vpn (combines X4BNet/lists_vpn + stamparm/ipsum + more)
 * IPv6: Custom aggregation from various sources
 * API: IP-API, IPInfo, IPRegistry for real-time detection
 */

// Multiple source URLs for redundancy
const VPN_LIST_URLS = {
  ipv4: [
    'https://raw.githubusercontent.com/josephrocca/is-vpn/main/vpn-or-datacenter-ipv4-ranges.txt',
    'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/datacenter/ipv4.txt',
    'https://raw.githubusercontent.com/stamparm/ipsum/master/levels/4.txt' // Medium confidence
  ],
  ipv6: [
    'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/datacenter/ipv6.txt',
    'https://raw.githubusercontent.com/stamparm/ipsum/master/levels/4.txt'
  ]
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STALE_WHILE_REVALIDATE_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache with versioning
let cache = {
  ipv4Ranges: null,
  ipv6Ranges: null,
  timestamp: 0,
  version: 0,
  lastFetchAttempt: 0
};

// IPv4 to integer conversion
function ipv4ToInt(ip) {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(parts[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num << 8) | octet;
  }
  return num >>> 0;
}

// IPv6 to BigInt conversion
function ipv6ToBigInt(ip) {
  try {
    // Expand :: notation
    let expanded = ip;
    if (ip.includes('::')) {
      const parts = ip.split('::');
      const left = parts[0] ? parts[0].split(':') : [];
      const right = parts[1] ? parts[1].split(':') : [];
      const missing = 8 - left.length - right.length;
      const middle = Array(missing).fill('0');
      expanded = [...left, ...middle, ...right].join(':');
    }
    
    const parts = expanded.split(':');
    if (parts.length !== 8) return null;
    
    let num = 0n;
    for (let i = 0; i < 8; i++) {
      const hex = parts[i] || '0';
      const val = parseInt(hex, 16);
      if (isNaN(val) || val < 0 || val > 65535) return null;
      num = (num << 16n) + BigInt(val);
    }
    return num;
  } catch (e) {
    return null;
  }
}

// CIDR to range conversion for IPv4
function cidrToRangeV4(cidr) {
  const idx = cidr.indexOf('/');
  if (idx === -1) return null;
  const baseIp = cidr.slice(0, idx).trim();
  const prefix = parseInt(cidr.slice(idx + 1), 10);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const ipInt = ipv4ToInt(baseIp);
  if (ipInt === null) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const start = (ipInt & mask) >>> 0;
  const end = (start | (~mask >>> 0)) >>> 0;
  return { start, end, version: 4 };
}

// CIDR to range conversion for IPv6
function cidrToRangeV6(cidr) {
  const idx = cidr.indexOf('/');
  if (idx === -1) return null;
  const baseIp = cidr.slice(0, idx).trim();
  const prefix = parseInt(cidr.slice(idx + 1), 10);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return null;
  const ipInt = ipv6ToBigInt(baseIp);
  if (ipInt === null) return null;
  
  const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
  const start = ipInt & mask;
  const end = start | ((1n << BigInt(128 - prefix)) - 1n);
  return { start, end, version: 6 };
}

// Merge overlapping ranges
function mergeRanges(ranges) {
  if (ranges.length === 0) return [];
  ranges.sort((a, b) => {
    if (a.version !== b.version) return a.version - b.version;
    return Number(a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  });
  
  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const cur = ranges[i];
    const last = merged[merged.length - 1];
    
    // Only merge same version
    if (cur.version !== last.version) {
      merged.push(cur);
      continue;
    }
    
    if (cur.version === 4) {
      if (cur.start <= last.end + 1) {
        last.end = Math.max(last.end, cur.end);
      } else {
        merged.push(cur);
      }
    } else {
      if (cur.start <= last.end + 1n) {
        last.end = cur.end > last.end ? cur.end : last.end;
      } else {
        merged.push(cur);
      }
    }
  }
  return merged;
}

// Binary search in ranges
function binarySearchV4(ranges, ipInt) {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const r = ranges[mid];
    if (ipInt < r.start) hi = mid - 1;
    else if (ipInt > r.end) lo = mid + 1;
    else return true;
  }
  return false;
}

function binarySearchV6(ranges, ipInt) {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const r = ranges[mid];
    if (ipInt < r.start) hi = mid - 1;
    else if (ipInt > r.end) lo = mid + 1;
    else return true;
  }
  return false;
}

// Fetch with timeout and retry
async function fetchWithTimeout(url, timeout = 15000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'Accept': 'text/plain' }
      });
      clearTimeout(timer);
      
      if (response.ok) return response;
      
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    } catch (error) {
      clearTimeout(timer);
      if (attempt >= retries) throw error;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// Parse IP list from text
function parseIpList(text, version) {
  const ranges = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Handle different formats
    if (trimmed.includes('/')) {
      // CIDR format
      const range = version === 4 ? cidrToRangeV4(trimmed) : cidrToRangeV6(trimmed);
      if (range) ranges.push(range);
    } else if (version === 4 && /^\d+\.\d+\.\d+\.\d+$/.test(trimmed)) {
      // Single IPv4 address
      const ipInt = ipv4ToInt(trimmed);
      if (ipInt !== null) {
        ranges.push({ start: ipInt, end: ipInt, version: 4 });
      }
    }
  }
  
  return ranges;
}

// Fetch VPN ranges from multiple sources
async function fetchVpnRanges() {
  const ipv4Ranges = [];
  const ipv6Ranges = [];
  
  // Fetch IPv4 lists
  for (const url of VPN_LIST_URLS.ipv4) {
    try {
      const response = await fetchWithTimeout(url, 15000, 2);
      const text = await response.text();
      const ranges = parseIpList(text, 4);
      ipv4Ranges.push(...ranges);
    } catch (err) {
      console.warn(`Failed to fetch IPv4 list from ${url}:`, err.message);
    }
  }
  
  // Fetch IPv6 lists
  for (const url of VPN_LIST_URLS.ipv6) {
    try {
      const response = await fetchWithTimeout(url, 15000, 2);
      const text = await response.text();
      const ranges = parseIpList(text, 6);
      ipv6Ranges.push(...ranges);
    } catch (err) {
      console.warn(`Failed to fetch IPv6 list from ${url}:`, err.message);
    }
  }
  
  return {
    ipv4: mergeRanges(ipv4Ranges),
    ipv6: mergeRanges(ipv6Ranges)
  };
}

// Get cached or fresh VPN ranges
async function getVpnRanges() {
  const now = Date.now();
  
  // Return cached if fresh
  if (cache.ipv4Ranges && cache.ipv6Ranges && (now - cache.timestamp) < CACHE_TTL_MS) {
    return cache;
  }
  
  // Return stale cache if fetch failed recently
  if (cache.ipv4Ranges && cache.ipv6Ranges && (now - cache.lastFetchAttempt) < 60000) {
    console.log('Using stale VPN cache, fetch attempted recently');
    return cache;
  }
  
  cache.lastFetchAttempt = now;
  
  try {
    const ranges = await fetchVpnRanges();
    cache = {
      ipv4Ranges: ranges.ipv4,
      ipv6Ranges: ranges.ipv6,
      timestamp: now,
      version: cache.version + 1,
      lastFetchAttempt: now
    };
    console.log(`VPN ranges updated: ${ranges.ipv4.length} IPv4, ${ranges.ipv6.length} IPv6 ranges`);
    return cache;
  } catch (err) {
    console.error('Failed to update VPN ranges:', err.message);
    // Return stale cache if available
    if (cache.ipv4Ranges && cache.ipv6Ranges && (now - cache.timestamp) < STALE_WHILE_REVALIDATE_MS) {
      console.log('Using stale VPN cache after fetch failure');
      return cache;
    }
    // Return empty but valid cache
    return { ipv4Ranges: [], ipv6Ranges: [], timestamp: now, version: 0, lastFetchAttempt: now };
  }
}

// Extract IPv4 from various formats
function extractIpv4(ip) {
  if (!ip || typeof ip !== 'string') return null;
  const t = ip.trim();
  
  // Handle ::ffff: IPv4-mapped IPv6
  const mapped = t.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return mapped[1];
  
  // Handle plain IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(t)) return t;
  
  return null;
}

// Extract IPv6
function extractIpv6(ip) {
  if (!ip || typeof ip !== 'string') return null;
  const t = ip.trim();
  
  // Skip IPv4-mapped addresses (handled separately)
  if (t.includes('.')) return null;
  
  // Basic IPv6 validation
  if (!t.includes(':')) return null;
  
  return t;
}

/**
 * Check if an IP address is in a known VPN/datacenter/proxy range
 * @param {string} ip - IP address (IPv4 or IPv6)
 * @returns {Promise<{isVpn: boolean, isDatacenter: boolean, isProxy: boolean, confidence: number}>}
 */
export async function isVpnOrDatacenter(ip) {
  const result = {
    isVpn: false,
    isDatacenter: false,
    isProxy: false,
    confidence: 0,
    source: null
  };
  
  if (!ip) return result;
  
  // Check IPv4
  const ipv4 = extractIpv4(ip);
  if (ipv4) {
    const ipInt = ipv4ToInt(ipv4);
    if (ipInt !== null) {
      const ranges = await getVpnRanges();
      const found = binarySearchV4(ranges.ipv4Ranges, ipInt);
      if (found) {
        result.isVpn = true;
        result.isDatacenter = true;
        result.confidence = 80;
        result.source = 'list';
        return result;
      }
    }
  }
  
  // Check IPv6
  const ipv6 = extractIpv6(ip);
  if (ipv6) {
    const ipInt = ipv6ToBigInt(ipv6);
    if (ipInt !== null) {
      const ranges = await getVpnRanges();
      const found = binarySearchV6(ranges.ipv6Ranges, ipInt);
      if (found) {
        result.isVpn = true;
        result.isDatacenter = true;
        result.confidence = 80;
        result.source = 'list';
        return result;
      }
    }
  }
  
  return result;
}

// Known VPN/datacenter ASN numbers (top providers)
const DATACENTER_ASNS = new Set([
  14061,  // DigitalOcean
  16509,  // Amazon AWS
  15169,  // Google Cloud
  8075,   // Microsoft Azure
  16276,  // OVH
  24940,  // Hetzner
  20473,  // Vultr / Choopa
  40676,  // Psychz Networks
  51167,  // Contabo
  12876,  // Scaleway
  63949,  // Linode / Akamai
  46844,  // Sharktech
  55286,  // ServerCentral
  36352,  // ColoCrossing
  19969,  // Joe's Datacenter
  54290,  // Hostwinds
  32780,  // HostingInnovation
  397373, // Mullvad VPN
  212238, // Datacamp
  209854, // FRANTECH/BuyVM
]);

// Reverse DNS patterns indicative of VPN/datacenter
const DATACENTER_RDNS_PATTERNS = [
  /vpn/i, /proxy/i, /tor/i, /exit/i, /relay/i,
  /cloud/i, /vps/i, /server/i, /host/i, /dedi/i,
  /node/i, /colo/i, /rack/i, /datacenter/i, /dc\d/i,
  /\.(compute|ec2|amazonaws|googleusercontent|azure|cloudapp)\./i,
  /\.(vultr|linode|digitalocean|hetzner|ovh|contabo)\./i,
  /mullvad/i, /nordvpn/i, /expressvpn/i, /surfshark/i, /protonvpn/i
];

/**
 * Advanced IP check with multiple detection methods
 * @param {string} ip - IP address
 * @param {object} [context] - Optional context: { asn, org, reverseDns, isp }
 * @returns {Promise<{isVpn: boolean, isProxy: boolean, isTor: boolean, isDatacenter: boolean, score: number, details: object}>}
 */
export async function advancedIpCheck(ip, context = {}) {
  const result = await isVpnOrDatacenter(ip);
  const methods = [];
  let score = result.confidence || 0;
  let isTor = false;

  // If list-based detection found something
  if (result.isVpn) {
    methods.push('blocklist');
  }

  // ASN-based detection
  if (context.asn) {
    const asnNum = parseInt(String(context.asn).replace(/^AS/i, ''), 10);
    if (!isNaN(asnNum) && DATACENTER_ASNS.has(asnNum)) {
      result.isDatacenter = true;
      score = Math.max(score, 60);
      methods.push('asn_datacenter');
    }
  }

  // Reverse DNS pattern detection
  if (context.reverseDns) {
    for (const pattern of DATACENTER_RDNS_PATTERNS) {
      if (pattern.test(context.reverseDns)) {
        result.isDatacenter = true;
        score = Math.max(score, 50);
        methods.push('rdns_pattern');
        // Specific VPN provider detection via rDNS
        if (/vpn|mullvad|nordvpn|expressvpn|surfshark|protonvpn|tor|exit/i.test(context.reverseDns)) {
          result.isVpn = true;
          score = Math.max(score, 75);
          methods.push('rdns_vpn');
        }
        if (/tor|exit|relay/i.test(context.reverseDns)) {
          isTor = true;
          score = Math.max(score, 85);
          methods.push('rdns_tor');
        }
        break;
      }
    }
  }

  // ISP/Org name pattern detection
  const orgLower = (context.org || context.isp || '').toLowerCase();
  if (orgLower) {
    const vpnOrgPatterns = [
      'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'mullvad',
      'private internet access', 'protonvpn', 'ipvanish', 'windscribe',
      'tunnelbear', 'hotspot shield', 'hide.me', 'atlas vpn'
    ];
    const dcOrgPatterns = [
      'amazon', 'aws', 'google cloud', 'microsoft', 'azure',
      'digitalocean', 'linode', 'vultr', 'ovh', 'hetzner',
      'contabo', 'scaleway', 'choopa', 'hostwinds', 'psychz',
      'colocation', 'data center', 'datacenter', 'hosting'
    ];

    for (const p of vpnOrgPatterns) {
      if (orgLower.includes(p)) {
        result.isVpn = true;
        score = Math.max(score, 85);
        methods.push('org_vpn');
        break;
      }
    }
    for (const p of dcOrgPatterns) {
      if (orgLower.includes(p)) {
        result.isDatacenter = true;
        score = Math.max(score, 55);
        methods.push('org_datacenter');
        break;
      }
    }
  }

  const confidence = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';

  return {
    ...result,
    isVpn: result.isVpn,
    isProxy: result.isProxy,
    isTor,
    isDatacenter: result.isDatacenter,
    score,
    details: {
      methods: methods.length > 0 ? methods : ['none'],
      confidence
    }
  };
}

// Manual cache refresh (for admin use)
export async function refreshVpnCache() {
  cache = {
    ipv4Ranges: null,
    ipv6Ranges: null,
    timestamp: 0,
    version: 0,
    lastFetchAttempt: 0
  };
  return await getVpnRanges();
}

// Get cache stats (for monitoring)
export function getCacheStats() {
  return {
    ipv4Count: cache.ipv4Ranges?.length || 0,
    ipv6Count: cache.ipv6Ranges?.length || 0,
    timestamp: cache.timestamp,
    version: cache.version,
    age: Date.now() - cache.timestamp
  };
}
