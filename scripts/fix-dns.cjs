require('dotenv').config();
const https = require('https');

const DOMAINS = [
  'thr0ne.com',
  'chris.quest',
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

async function deleteRecord(domain, recordId) {
  try {
    await porkbunRequest(`/dns/delete/${domain}/${recordId}`);
    console.log(`  Deleted record ${recordId}`);
  } catch (e) {
    console.log(`  Failed to delete record ${recordId}: ${e.message}`);
  }
}

async function setupDomainDNS(domain) {
  console.log(`\n=== Configuring ${domain} ===`);
  
  try {
    const dns = await porkbunRequest(`/dns/retrieve/${domain}`);
    if (dns.status !== 'SUCCESS') {
      console.log(`  ERROR: ${dns.message || 'Unknown error'}`);
      return false;
    }

    const records = dns.records || [];
    
    // Find records to delete (ALIAS to pixie.porkbun.com, A records that aren't Netlify)
    const toDelete = records.filter(r => {
      if (r.type === 'ALIAS' && r.content === 'pixie.porkbun.com') return true;
      if (r.type === 'A' && r.content !== LB_IP) return true;
      if (r.type === 'CNAME' && r.content !== CNAME_TARGET && !r.name.startsWith('go.') && !r.name.startsWith('track.')) return true;
      return false;
    });

    console.log(`  Found ${toDelete.length} records to delete`);
    for (const r of toDelete) {
      await deleteRecord(domain, r.id);
    }

    // Check if we need to add A record
    const hasApexA = records.some(r => r.name === domain && r.type === 'A' && r.content === LB_IP);
    if (!hasApexA) {
      console.log(`  Creating A record for apex...`);
      await porkbunRequest(`/dns/create/${domain}`, {
        name: '',
        type: 'A',
        content: LB_IP,
        ttl: '600'
      });
      console.log(`  Created A record`);
    } else {
      console.log(`  A record already correct`);
    }

    // Check if we need to add www CNAME
    const wwwName = `www.${domain}`;
    const hasWwwCname = records.some(r => r.name === wwwName && r.type === 'CNAME' && r.content === CNAME_TARGET);
    if (!hasWwwCname) {
      console.log(`  Creating CNAME for www...`);
      await porkbunRequest(`/dns/create/${domain}`, {
        name: 'www',
        type: 'CNAME',
        content: CNAME_TARGET,
        ttl: '600'
      });
      console.log(`  Created CNAME`);
    } else {
      console.log(`  CNAME already correct`);
    }

    return true;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('Fixing DNS for all domains to point to Netlify...\n');
  
  let successCount = 0;
  for (const domain of DOMAINS) {
    const ok = await setupDomainDNS(domain);
    if (ok) successCount++;
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Configured: ${successCount}/${DOMAINS.length} domains`);
  console.log(`\nNOTE: snapchat.cv is not opted into API and needs manual configuration.`);
}

main().catch(console.error);
