import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const AUTO_UPDATE = process.env.IP_DB_AUTO_UPDATE === 'true';
const UPDATE_CHECK_INTERVAL = 12 * 60 * 60 * 1000;
const IS_SERVERLESS = process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;

let ipv4Ranges = [];
let ipv6Ranges = [];
let cityIpv4Ranges = [];
let cityIpv6Ranges = [];
let dbInitialized = false;
let lastUpdateCheck = 0;

const COUNTRY_NAMES = {
  US: 'United States', CA: 'Canada', MX: 'Mexico', GB: 'United Kingdom', DE: 'Germany',
  FR: 'France', ES: 'Spain', IT: 'Italy', NL: 'Netherlands', BE: 'Belgium',
  CH: 'Switzerland', AT: 'Austria', PT: 'Portugal', IE: 'Ireland', SE: 'Sweden',
  NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland', CZ: 'Czech Republic',
  RU: 'Russia', UA: 'Ukraine', RO: 'Romania', HU: 'Hungary', GR: 'Greece',
  TR: 'Turkey', CN: 'China', JP: 'Japan', KR: 'South Korea', IN: 'India',
  ID: 'Indonesia', TH: 'Thailand', VN: 'Vietnam', MY: 'Malaysia', PH: 'Philippines',
  SG: 'Singapore', HK: 'Hong Kong', TW: 'Taiwan', AU: 'Australia', NZ: 'New Zealand',
  BR: 'Brazil', AR: 'Argentina', CL: 'Chile', CO: 'Colombia', PE: 'Peru',
  VE: 'Venezuela', ZA: 'South Africa', EG: 'Egypt', NG: 'Nigeria', KE: 'Kenya',
  MA: 'Morocco', SA: 'Saudi Arabia', AE: 'United Arab Emirates', IL: 'Israel',
  PK: 'Pakistan', BD: 'Bangladesh', NP: 'Nepal', LK: 'Sri Lanka', MM: 'Myanmar',
  KH: 'Cambodia', LA: 'Laos', BN: 'Brunei', AF: 'Afghanistan', IR: 'Iran',
  IQ: 'Iraq', SY: 'Syria', YE: 'Yemen', LY: 'Libya', TN: 'Tunisia', DZ: 'Algeria',
  SD: 'Sudan', ET: 'Ethiopia', TZ: 'Tanzania', UG: 'Uganda', GH: 'Ghana',
  CI: 'Ivory Coast', SN: 'Senegal', DO: 'Dominican Republic', CR: 'Costa Rica',
  PA: 'Panama', GT: 'Guatemala', CU: 'Cuba', JM: 'Jamaica', TT: 'Trinidad and Tobago',
  BH: 'Bahrain', KW: 'Kuwait', QA: 'Qatar', OM: 'Oman', JO: 'Jordan', LB: 'Lebanon',
  CY: 'Cyprus', IS: 'Iceland', LU: 'Luxembourg', SI: 'Slovenia', SK: 'Slovakia',
  HR: 'Croatia', RS: 'Serbia', BA: 'Bosnia', MK: 'North Macedonia', AL: 'Albania',
  ME: 'Montenegro', MD: 'Moldova', BG: 'Bulgaria', BY: 'Belarus', GE: 'Georgia',
  AM: 'Armenia', AZ: 'Azerbaijan', KZ: 'Kazakhstan', UZ: 'Uzbekistan', TM: 'Turkmenistan',
  KG: 'Kyrgyzstan', TJ: 'Tajikistan', MN: 'Mongolia', BT: 'Bhutan', MV: 'Maldives',
  FJ: 'Fiji', PG: 'Papua New Guinea', WS: 'Samoa', TO: 'Tonga', VU: 'Vanuatu',
  NR: 'Nauru', TV: 'Tuvalu', KI: 'Kiribati', SB: 'Solomon Islands', PW: 'Palau',
};

function ipToLong(ip) {
  if (!ip) return 0;
  
  if (ip.includes(':')) {
    return ipv6ToLong(ip);
  }
  
  const parts = ip.split('.');
  if (parts.length !== 4) return 0;
  
  return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function ipv6ToLong(ip) {
  const parts = ip.split(':');
  let num = 0n;
  
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      num = (num << 16n) + BigInt(parseInt(parts[i], 16));
    } else {
      const missing = 8 - parts.length + 1;
      num = num << (missing * 16n);
    }
  }
  
  return num;
}

function ipToBigInt(ip) {
  if (!ip) return 0n;
  
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  if (ip.includes(':')) {
    return ipv6ToLong(ip);
  }
  
  return BigInt(ipToLong(ip));
}

function binarySearch(ranges, ipNum) {
  let left = 0;
  let right = ranges.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const range = ranges[mid];
    
    if (ipNum >= range.start && ipNum <= range.end) {
      return range;
    } else if (ipNum < range.start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  
  return null;
}

function findPackagePath(packageName) {
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', packageName),
    path.join(process.cwd(), '..', 'node_modules', packageName),
    path.join(process.cwd(), '..', '..', 'node_modules', packageName),
    path.join('/var/task', 'node_modules', packageName),
    path.join('/var/task', '..', 'node_modules', packageName),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

function loadCsvFile(filePath, isGzipped = false) {
  try {
    let content;
    if (isGzipped) {
      const compressed = fs.readFileSync(filePath);
      content = zlib.gunzipSync(compressed).toString('utf-8');
    } else {
      content = fs.readFileSync(filePath, 'utf-8');
    }
    return content.trim().split('\n');
  } catch (error) {
    console.error(`Failed to load ${filePath}:`, error.message);
    return null;
  }
}

async function loadDatabase() {
  if (dbInitialized) return;
  
  if (IS_SERVERLESS) {
    console.log('Running in serverless mode - skipping IP database loading');
    dbInitialized = true;
    return;
  }
  
  ipv4Ranges = [];
  ipv6Ranges = [];
  cityIpv4Ranges = [];
  cityIpv6Ranges = [];
  
  const cc0PkgPath = findPackagePath('@ip-location-db/geo-whois-asn-country');
  const cityPkgPath = findPackagePath('@ip-location-db/dbip-city');
  
  if (cc0PkgPath) {
    const ipv4NumPath = path.join(cc0PkgPath, 'geo-whois-asn-country-ipv4-num.csv');
    const ipv6NumPath = path.join(cc0PkgPath, 'geo-whois-asn-country-ipv6-num.csv');
    
    if (fs.existsSync(ipv4NumPath)) {
      console.log('Loading IPv4 CC0 database from npm package...');
      const lines = loadCsvFile(ipv4NumPath);
      if (lines) {
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 3) {
            ipv4Ranges.push({
              start: BigInt(parts[0].trim()),
              end: BigInt(parts[1].trim()),
              country: parts[2].trim().replace(/"/g, '')
            });
          }
        }
        ipv4Ranges.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
        console.log(`Loaded ${ipv4Ranges.length} IPv4 ranges`);
      }
    }
    
    if (fs.existsSync(ipv6NumPath)) {
      console.log('Loading IPv6 CC0 database from npm package...');
      const lines = loadCsvFile(ipv6NumPath);
      if (lines) {
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 3) {
            ipv6Ranges.push({
              start: BigInt(parts[0].trim()),
              end: BigInt(parts[1].trim()),
              country: parts[2].trim().replace(/"/g, '')
            });
          }
        }
        ipv6Ranges.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
        console.log(`Loaded ${ipv6Ranges.length} IPv6 ranges`);
      }
    }
  } else {
    console.warn('CC0 database package not found. Geolocation will return null.');
  }
  
  if (cityPkgPath) {
    const cityIpv4NumPath = path.join(cityPkgPath, 'dbip-city-ipv4-num.csv.gz');
    
    if (fs.existsSync(cityIpv4NumPath)) {
      console.log('Loading DB-IP city IPv4 database from npm package...');
      const lines = loadCsvFile(cityIpv4NumPath, true);
      if (lines) {
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 8) {
            cityIpv4Ranges.push({
              start: BigInt(parts[0].trim()),
              end: BigInt(parts[1].trim()),
              country: parts[2].trim().replace(/"/g, ''),
              city: parts[3].trim().replace(/"/g, ''),
              region: parts[4].trim().replace(/"/g, ''),
              latitude: parseFloat(parts[6].trim()) || null,
              longitude: parseFloat(parts[7].trim()) || null
            });
          }
        }
        cityIpv4Ranges.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
        console.log(`Loaded ${cityIpv4Ranges.length} city IPv4 ranges`);
      }
    }
  } else {
    console.warn('City database package not found. City-level geolocation unavailable.');
  }
  
  dbInitialized = true;
}

export async function initGeo() {
  try {
    await loadDatabase();
    
    if (AUTO_UPDATE) {
      setInterval(async () => {
        const now = Date.now();
        if (now - lastUpdateCheck >= UPDATE_CHECK_INTERVAL) {
          lastUpdateCheck = now;
          console.log('IP database auto-update check (npm packages auto-update via npm)');
        }
      }, UPDATE_CHECK_INTERVAL);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize geo database:', error.message);
    return false;
  }
}

export function getGeoLocation(ip) {
  if (!ip || ip === 'unknown') {
    return {
      country: 'Unknown',
      region: null,
      city: null,
      latitude: null,
      longitude: null,
    };
  }
  
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || (ip.startsWith('172.') && parseInt(ip.split('.')[1], 10) >= 16 && parseInt(ip.split('.')[1], 10) <= 31)) {
    return {
      country: 'Local',
      region: 'Local',
      city: 'Local',
      latitude: null,
      longitude: null,
    };
  }
  
  if (ipv4Ranges.length === 0 && ipv6Ranges.length === 0 && cityIpv4Ranges.length === 0) {
    return {
      country: null,
      region: null,
      city: null,
      latitude: null,
      longitude: null,
    };
  }
  
  try {
    const isIPv6 = ip.includes(':');
    let result = null;
    
    if (cityIpv4Ranges.length > 0 || cityIpv6Ranges.length > 0) {
      const ipNum = ipToBigInt(ip);
      
      if (isIPv6) {
        result = binarySearch(cityIpv6Ranges, ipNum);
      } else {
        result = binarySearch(cityIpv4Ranges, ipNum);
      }
      
      if (result) {
        return {
          country: result.country,
          region: result.region || null,
          city: result.city || null,
          latitude: result.latitude,
          longitude: result.longitude,
        };
      }
    }
    
    const ipNum = ipToBigInt(ip);
    
    if (isIPv6) {
      result = binarySearch(ipv6Ranges, ipNum);
    } else {
      result = binarySearch(ipv4Ranges, ipNum);
    }
    
    if (result) {
      return {
        country: result.country,
        region: null,
        city: null,
        latitude: null,
        longitude: null,
      };
    }
    
    return null;
  } catch (error) {
    console.error('GeoIP lookup error:', error.message);
    return null;
  }
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

export function getCountryName(countryCode) {
  return COUNTRY_NAMES[countryCode] || countryCode;
}

export function getAttribution() {
  return 'IP Geolocation data provided by DB-IP (CC BY 4.0) and geo-whois-asn (CC0)';
}
