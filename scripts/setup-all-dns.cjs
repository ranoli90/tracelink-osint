require('dotenv').config();
const https = require('https');

const DOMAINS = [
  'thr0ne.com',
  'chris.quest',
  'snapchat.cv',
  'myaccount.lol',
  'tiktok.gen.in',
  'tiktok.name',
  'tiktok.org.in',
  'chris.forum',
  'nike.org.in',
  'y0utube.buzz',
  'y0utube.cv',
  'y0utube.vip',
  'googie.one',
  'netfiix.cloud',
  'y0utube.help',
  'reddit.com.de',
  'lnstagram.lol',
  'lnstagram.pics',
  'googie.pics',
  'chris.autos',
  'tikt0k.help',
  'netfiix.lol'
];

const LB_IP = '75.2.60.5';
const CNAME_TARGET = 'apex-loadbalancer.netlify.com';

async function porkbunRequest(endpoint, body = {}) {
  return new Promise((resolve, reject) => {
    const creds = {
      apikey: process.env.PORKBUN_API_KEY,
      secretapikey: process.env.PORKBUN_SECRET_API_KEY
    };
    const postData = JSON.stringify({ ...creds, ...body });
    const req = https.request({
      hostname: 'api.porkbun.com',
      port: 443,
      path: `/api/json/v3${endpoint}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(data));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function getDnsRecords(domain) {
  try {
    return await porkbunRequest(`/dns/retrieve/${domain}`);
  } catch (e) {
    return null;
  }
}

async function createARecord(domain) {
  try {
    const result = await porkbunRequest(`/dns/create/${domain}`, {
      name: '',
      type: 'A',
      content: LB_IP,
      ttl: '600'
    });
    console.log(`✓ Created A record for ${domain}: ${result.id}`);
    return result.id;
  } catch (e) {
    console.log(`✗ Failed to create A record for ${domain}: ${e.message}`);
    return null;
  }
}

async function createCnameRecord(domain, name, content) {
  try {
    const result = await porkbunRequest(`/dns/create/${domain}`, {
      name: name,
      type: 'CNAME',
      content: content,
      ttl: '600'
    });
    console.log(`✓ Created CNAME ${name || '(apex)'} for ${domain}: ${result.id}`);
    return result.id;
  } catch (e) {
    console.log(`✗ Failed to create CNAME for ${domain}: ${e.message}`);
    return null;
  }
}

async function setupDomain(domain) {
  console.log(`\n=== Setting up ${domain} ===`);
  
  const dns = await getDnsRecords(domain);
  if (!dns || dns.status === 'ERROR') {
    console.log(`⚠ ${domain}: Cannot access DNS API (not opted in or error)`);
    return false;
  }

  const records = dns.records || [];
  const hasApexA = records.some(r => r.name === domain && r.type === 'A');
  const hasWwwCname = records.some(r => r.name === `www.${domain}` && r.type === 'CNAME');

  if (!hasApexA) {
    await createARecord(domain);
  } else {
    console.log(`✓ A record already exists for ${domain}`);
  }

  if (!hasWwwCname) {
    await createCnameRecord(domain, 'www', CNAME_TARGET);
  } else {
    console.log(`✓ CNAME www already exists for ${domain}`);
  }

  return true;
}

async function main() {
  console.log('Setting up DNS for all domains...\n');
  
  let successCount = 0;
  for (const domain of DOMAINS) {
    const ok = await setupDomain(domain);
    if (ok) successCount++;
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Configured: ${successCount}/${DOMAINS.length} domains`);
}

main().catch(console.error);
