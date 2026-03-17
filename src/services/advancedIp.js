import crypto from 'crypto';

const IP_API_PRO = process.env.IP_API_PRO_KEY || '';
const IPINFO_TOKEN = process.env.IPINFO_TOKEN || '';
const IPREGISTRY_KEY = process.env.IPREGISTRY_KEY || '';
const IPHUB_KEY = process.env.IPHUB_KEY || '';
const GETIPINTEL_KEY = process.env.GETIPINTEL_KEY || '';

// Advanced VPN/Proxy detection with multiple sources
export async function getAdvancedIpInfo(ip) {
  if (!ip || ip === 'unknown' || isLocalIp(ip)) {
    return getLocalIpInfo(ip);
  }

  const cleanIp = ip.replace(/^::ffff:/, '');
  const isIPv6 = cleanIp.includes(':');

  try {
    // Parallel fetching from multiple sources
    const [geoData, ipInfoData, ipRegistryData] = await Promise.allSettled([
      getIpApiData(cleanIp, isIPv6),
      IPINFO_TOKEN ? getIpInfoData(cleanIp) : Promise.resolve(null),
      IPREGISTRY_KEY ? getIpRegistryData(cleanIp) : Promise.resolve(null)
    ]);

    const geo = geoData.status === 'fulfilled' ? geoData.value : null;
    const ipInfo = ipInfoData.status === 'fulfilled' ? ipInfoData.value : null;
    const ipRegistry = ipRegistryData.status === 'fulfilled' ? ipRegistryData.value : null;

    // Merge data from all sources
    const merged = mergeIpData(geo, ipInfo, ipRegistry);

    // Advanced VPN detection
    const vpnAnalysis = analyzeVpnIndicators(merged, cleanIp);

    return {
      ipFull: cleanIp,
      ipVersion: isIPv6 ? 6 : 4,
      ipRaw: ip,
      ...merged,
      ...vpnAnalysis,
      isTor: detectTor(merged),
      dataSources: {
        ipApi: !!geo,
        ipInfo: !!ipInfo,
        ipRegistry: !!ipRegistry
      }
    };
  } catch (error) {
    console.error('Error fetching IP info:', error.message);
    return getBasicIpInfo(cleanIp, isIPv6);
  }
}

async function getIpApiData(ip, isIPv6) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    let endpoint;
    if (IP_API_PRO && !isIPv6) {
      endpoint = `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,reverse,continent,continentCode,currency,mobile,proxy,hosting&lang=en&apiKey=${IP_API_PRO}`;
    } else {
      endpoint = `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,reverse,continent,continentCode,currency,mobile,proxy,hosting&lang=en`;
    }

    const response = await fetch(endpoint, { signal: controller.signal });
    const data = await response.json();
    clearTimeout(timeout);

    if (data.status === 'success') {
      return {
        country: data.country,
        countryCode: data.countryCode,
        region: data.regionName,
        regionCode: data.region,
        city: data.city,
        district: data.district,
        cityPostalCode: data.zip,
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
        currency: data.currency,
        mobile: data.mobile,
        proxy: data.proxy,
        hosting: data.hosting,
        threatScore: data.proxy || data.hosting ? 50 : 0
      };
    }
    return null;
  } catch (error) {
    clearTimeout(timeout);
    console.error('IP-API error:', error.message);
    return null;
  }
}

async function getIpInfoData(ip) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  
  try {
    const response = await fetch(
      `https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`,
      { signal: controller.signal }
    );
    const data = await response.json();
    clearTimeout(timeout);

    // Parse loc string "lat,lng"
    let latitude = null, longitude = null;
    if (data.loc) {
      const [lat, lng] = data.loc.split(',');
      latitude = parseFloat(lat);
      longitude = parseFloat(lng);
    }

    return {
      country: data.country,
      region: data.region,
      city: data.city,
      latitude,
      longitude,
      timezone: data.timezone,
      org: data.org,
      asn: data.asn,
      privacy: data.privacy || {},
      // ipinfo has specific privacy fields
      vpn: data.privacy?.vpn || false,
      proxy: data.privacy?.proxy || false,
      tor: data.privacy?.tor || false,
      hosting: data.privacy?.hosting || false,
      threatScore: (data.privacy?.vpn || data.privacy?.proxy) ? 75 : 0
    };
  } catch (error) {
    clearTimeout(timeout);
    console.error('IPInfo error:', error.message);
    return null;
  }
}

async function getIpRegistryData(ip) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  
  try {
    const response = await fetch(
      `https://api.ipregistry.co/${ip}?key=${IPREGISTRY_KEY}`,
      { signal: controller.signal }
    );
    const data = await response.json();
    clearTimeout(timeout);

    return {
      country: data.location?.country?.name,
      countryCode: data.location?.country?.code,
      region: data.location?.region?.name,
      city: data.location?.city,
      latitude: data.location?.latitude,
      longitude: data.location?.longitude,
      timezone: data.time_zone?.id,
      isp: data.connection?.isp,
      org: data.connection?.organization,
      asn: data.connection?.asn?.number,
      asname: data.connection?.asn?.name,
      // Security data
      isVpn: data.security?.vpn || false,
      isProxy: data.security?.proxy || false,
      isTor: data.security?.tor || false,
      isAnonymous: data.security?.anonymous || false,
      isAttacker: data.security?.attacker || false,
      isAbuser: data.security?.abuser || false,
      isThreat: data.security?.threat || false,
      threatScore: data.security?.score || 0
    };
  } catch (error) {
    clearTimeout(timeout);
    console.error('IPRegistry error:', error.message);
    return null;
  }
}

function mergeIpData(geo, ipInfo, ipRegistry) {
  const sources = [geo, ipInfo, ipRegistry].filter(Boolean);
  if (sources.length === 0) return getBasicIpInfo(null, false);

  // Priority: ipRegistry > ipInfo > geo
  return {
    country: ipRegistry?.country || ipInfo?.country || geo?.country || null,
    countryCode: ipRegistry?.countryCode || ipInfo?.country || geo?.countryCode || null,
    region: ipRegistry?.region || ipInfo?.region || geo?.region || null,
    regionCode: geo?.regionCode || null,
    city: ipRegistry?.city || ipInfo?.city || geo?.city || null,
    district: geo?.district || null,
    cityPostalCode: geo?.cityPostalCode || null,
    latitude: ipRegistry?.latitude || ipInfo?.latitude || geo?.latitude || null,
    longitude: ipRegistry?.longitude || ipInfo?.longitude || geo?.longitude || null,
    timezone: ipRegistry?.timezone || ipInfo?.timezone || geo?.timezone || null,
    isp: geo?.isp || ipRegistry?.isp || null,
    org: ipRegistry?.org || ipInfo?.org || geo?.org || null,
    asn: ipRegistry?.asn || geo?.asn || null,
    asname: ipRegistry?.asname || geo?.asname || null,
    reverseDns: geo?.reverseDns || null,
    continent: geo?.continent || null,
    continentCode: geo?.continentCode || null,
    currency: geo?.currency || null,
    mobile: geo?.mobile || false,
    // Security flags from any source
    proxy: geo?.proxy || ipInfo?.proxy || ipRegistry?.isProxy || false,
    hosting: geo?.hosting || ipInfo?.hosting || false,
    threatScore: Math.max(
      geo?.threatScore || 0,
      ipInfo?.threatScore || 0,
      ipRegistry?.threatScore || 0
    )
  };
}

function analyzeVpnIndicators(data, ip) {
  const indicators = [];
  let vpnScore = 0;

  // Check for known VPN keywords in ISP/Org
  const vpnKeywords = [
    'vpn', 'virtual private', 'proxy', 'tunnel', 'expressvpn', 'nordvpn', 
    'surfshark', 'protonvpn', 'mullvad', 'pia', 'private internet access',
    'cyberghost', 'windscribe', 'tunnelbear', 'hidemyass', 'hma',
    'vyprvpn', 'ipvanish', 'strongvpn', 'purevpn', 'ivacy',
    'airvpn', 'ovpn', 'torguard', 'privatevpn', 'hotspot shield',
    'zenmate', 'holavpn', 'betternet', 'speedify', 'psiphon',
    'outline', 'shadowsocks', 'v2ray', 'wireguard', 'openvpn'
  ];

  const searchText = `${data.isp || ''} ${data.org || ''} ${data.asname || ''}`.toLowerCase();
  
  for (const keyword of vpnKeywords) {
    if (searchText.includes(keyword)) {
      indicators.push(`vpn_keyword:${keyword}`);
      vpnScore += 25;
    }
  }

  // Check for datacenter/hosting providers
  const dcKeywords = [
    'digitalocean', 'aws', 'amazon', 'google cloud', 'azure', 'microsoft',
    'linode', 'vultr', 'ovh', 'hetzner', 'choopa', 'psychz',
    'colocrossing', 'frantech', 'buyvm', 'ramnode', 'contabo',
    'scaleway', 'upcloud', 'packet', 'equinix', 'datapacket',
    'webnx', 'nexeon', 'hostwinds', 'dedipath', 'hivelocity',
    'quadranet', 'clouvider', 'zare', 'koddos', 'blazingseo',
    'luxhosting', 'terrhost', 'maxided', 'snel', 'netcup'
  ];

  for (const keyword of dcKeywords) {
    if (searchText.includes(keyword)) {
      indicators.push(`datacenter:${keyword}`);
      vpnScore += 15;
    }
  }

  // Check API-reported flags
  if (data.proxy) {
    indicators.push('api:proxy');
    vpnScore += 40;
  }
  if (data.hosting) {
    indicators.push('api:hosting');
    vpnScore += 20;
  }

  // Check threat score from APIs
  if (data.threatScore > 50) {
    indicators.push(`threat_score:${data.threatScore}`);
    vpnScore += Math.min(data.threatScore, 50);
  }

  // Known residential proxy indicators
  const residentialProxyIndicators = [
    'luminati', 'brightdata', 'oxylabs', 'smartproxy', 'soax',
    'netnut', 'packetstream', 'iproyal', 'proxyrack', 'stormproxies'
  ];

  for (const keyword of residentialProxyIndicators) {
    if (searchText.includes(keyword)) {
      indicators.push(`residential_proxy:${keyword}`);
      vpnScore += 35;
    }
  }

  return {
    isVpn: vpnScore >= 30,
    isProxy: vpnScore >= 20 || data.proxy,
    isHosting: data.hosting || indicators.some(i => i.startsWith('datacenter:')),
    vpnScore: Math.min(vpnScore, 100),
    vpnIndicators: indicators
  };
}

function detectTor(data) {
  const searchText = `${data.isp || ''} ${data.org || ''} ${data.reverseDns || ''}`.toLowerCase();
  return searchText.includes('tor') || 
         searchText.includes('tor-exit') || 
         searchText.includes('tornode');
}

function isLocalIp(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1') return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // IPv6 private
  if (ip.startsWith('fe80:')) return true; // IPv6 link-local
  return false;
}

function getLocalIpInfo(ip) {
  return {
    ipFull: ip || 'unknown',
    ipVersion: 4,
    ipRaw: ip || 'unknown',
    country: 'Local',
    countryCode: 'LO',
    region: 'Local',
    regionCode: 'LO',
    city: 'Local',
    cityPostalCode: null,
    latitude: null,
    longitude: null,
    timezone: null,
    isp: 'Local Network',
    org: 'Local Network',
    asn: null,
    reverseDns: 'localhost',
    address: 'Local Network',
    isVpn: false,
    isProxy: false,
    isTor: false,
    isHosting: false,
    vpnScore: 0,
    vpnIndicators: [],
    dataSources: {}
  };
}

function getBasicIpInfo(ip, isIPv6) {
  return {
    ipFull: ip,
    ipVersion: isIPv6 ? 6 : 4,
    ipRaw: ip,
    country: null,
    countryCode: null,
    region: null,
    regionCode: null,
    city: null,
    district: null,
    cityPostalCode: null,
    latitude: null,
    longitude: null,
    timezone: null,
    isp: null,
    org: null,
    asn: null,
    asname: null,
    reverseDns: null,
    continent: null,
    continentCode: null,
    currency: null,
    mobile: false,
    address: null,
    isVpn: null,
    isProxy: null,
    isTor: null,
    isHosting: null,
    vpnScore: 0,
    vpnIndicators: [],
    dataSources: {}
  };
}

export function formatAddress(data) {
  if (!data) return null;
  
  const parts = [
    data.district,
    data.city,
    data.region,
    data.country
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

export function truncateIp(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::';
  }
  
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  
  return ip;
}

export function getGeoLocation(ip) {
  return getAdvancedIpInfo(ip);
}
