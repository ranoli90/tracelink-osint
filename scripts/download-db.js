import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/ip-db');

const CC0_DATABASE = 'geo-whois-asn-country';
const CITY_DATABASE = 'dbip-city';

const CC0_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ip-location-db/geo-whois-asn-country';
const CITY_BASE_URL = 'https://unpkg.com/@ip-location-db/dbip-city';

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function resolveRedirectUrl(baseUrl, redirectUrl) {
  if (!redirectUrl) return null;
  if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
    return redirectUrl;
  }
  const base = new URL(baseUrl);
  if (redirectUrl.startsWith('/')) {
    return `${base.protocol}//${base.host}${redirectUrl}`;
  }
  return `${base.protocol}//${base.host}/${redirectUrl}`;
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    ensureDirectory(path.dirname(destPath));
    
    const file = fs.createWriteStream(destPath);
    
    const doDownload = (downloadUrl) => {
      https.get(downloadUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = resolveRedirectUrl(downloadUrl, response.headers.location);
          if (!redirectUrl) {
            file.close();
            reject(new Error('Invalid redirect URL'));
            return;
          }
          https.get(redirectUrl, (redirectResponse) => {
            pipeline(redirectResponse, file)
              .then(() => resolve())
              .catch(err => {
                fs.unlink(destPath, () => {});
                reject(err);
              });
          }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        } else {
          pipeline(response, file)
            .then(() => resolve())
            .catch(err => {
              fs.unlink(destPath, () => {});
              reject(err);
            });
        }
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };
    
    doDownload(url);
  });
}

async function main() {
  console.log('Downloading IP geolocation databases...\n');
  
  console.log('Database licenses:');
  console.log('  - geo-whois-asn-country: CC0 (no attribution required)');
  console.log('  - dbip-city: CC BY 4.0 (attribution required - see https://db-ip.com/)\n');
  
  ensureDirectory(DB_PATH);
  
  const files = [
    { 
      name: 'geo-whois-asn-country IPv4 (CC0)', 
      url: `${CC0_BASE_URL}/geo-whois-asn-country-ipv4-num.csv`, 
      path: path.join(DB_PATH, CC0_DATABASE, 'geo-whois-asn-country-ipv4-num.csv') 
    },
    { 
      name: 'geo-whois-asn-country IPv6 (CC0)', 
      url: `${CC0_BASE_URL}/geo-whois-asn-country-ipv6-num.csv`, 
      path: path.join(DB_PATH, CC0_DATABASE, 'geo-whois-asn-country-ipv6-num.csv') 
    },
    { 
      name: 'dbip-city IPv4 (CC BY 4.0)', 
      url: `${CITY_BASE_URL}/dbip-city-ipv4-num.csv.gz`, 
      path: path.join(DB_PATH, CITY_DATABASE, 'dbip-city-ipv4-num.csv.gz') 
    },
  ];
  
  for (const file of files) {
    try {
      console.log(`Downloading ${file.name}...`);
      await downloadFile(file.url, file.path);
      console.log(`  Downloaded: ${file.path}\n`);
    } catch (error) {
      console.error(`  Failed to download ${file.name}: ${error.message}\n`);
    }
  }
  
  console.log('Database download complete!');
  console.log('\nTo enable auto-updates, set IP_DB_AUTO_UPDATE=true in your .env file');
}

main().catch(console.error);
