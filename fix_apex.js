const fs = require('fs');
const https = require('https');

// Simple .env parser to avoid dot-env dependency
function getEnv() {
    const file = fs.readFileSync('.env', 'utf-8');
    const env = {};
    file.split('\n').forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length > 0) {
            env[key.trim()] = rest.join('=').trim();
        }
    });
    return env;
}

const env = getEnv();
const API_KEY = env.PORKBUN_API_KEY;
const SECRET_KEY = env.PORKBUN_SECRET_KEY;
const DOMAIN = 'chris.quest';

function request(path, payload = {}) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            apikey: API_KEY,
            secretapikey: SECRET_KEY,
            ...payload
        });

        const options = {
            hostname: 'api.porkbun.com',
            port: 443,
            path: '/api/json/v3/domain/dns/' + path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let result = '';
            res.on('data', (d) => { result += d; });
            res.on('end', () => {
                resolve(JSON.parse(result));
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function fixRecords() {
    console.log(`Fixing DNS for ${DOMAIN}...`);
    try {
        const records = await request(`retrieve/${DOMAIN}`);
        if (records.status !== 'SUCCESS') {
            console.error('Failed to retrieve records:', records);
            return;
        }

        const parkingRecords = records.records.filter(r => r.name === DOMAIN && r.type === 'A' && r.content === '119.8.104.22');
        for (const r of parkingRecords) {
            console.log(`Deleting parked IP record ${r.id}...`);
            await request(`delete/${DOMAIN}/${r.id}`);
        }

        // Check if Nelify ALIAS A is present
        const netlifyA_Record = records.records.find(r => r.name === DOMAIN && r.type === 'A' && r.content === '75.2.60.5');
        if (!netlifyA_Record) {
            console.log(`Adding Netlify ALIAS/A record...`);
            const addResult = await request(`create/${DOMAIN}`, {
                name: '',
                type: 'A',
                content: '75.2.60.5',
                ttl: 600
            });
            console.log('Result:', addResult);
        } else {
            console.log('Network ALIAS/A record already exists.');
        }

        // Also check wildcard and www just in case
        const wwwRecord = records.records.find(r => r.name === `www.${DOMAIN}`);
        if (!wwwRecord) {
            console.log(`Adding Netlify WWW CNAME...`);
            await request(`create/${DOMAIN}`, {
                name: 'www',
                type: 'CNAME',
                content: 'dazzling-semifreddo.netlify.app',
                ttl: 600
            });
        } else {
            console.log('WWW record already exists.');
        }

        console.log('✅ DNS records fixed. Propagation takes about 5 minutes.');
    } catch (err) {
        console.error('Error:', err);
    }
}

fixRecords();
