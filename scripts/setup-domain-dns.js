#!/usr/bin/env node
/**
 * Set up DNS records for a domain to point to Netlify.
 * Requires: PORKBUN_API_KEY, PORKBUN_SECRET_API_KEY in env (or .env)
 * Usage: node scripts/setup-domain-dns.js <domain>
 * Example: node scripts/setup-domain-dns.js thr0ne.com
 */
import 'dotenv/config';
const API_BASE = 'https://api.porkbun.com/api/json/v3';

function getCredentials() {
  const apiKey = process.env.PORKBUN_API_KEY;
  const secretKey = process.env.PORKBUN_SECRET_API_KEY;
  if (!apiKey || !secretKey) return null;
  return { apikey: apiKey, secretapikey: secretKey };
}

async function porkbunPost(endpoint, body = {}) {
  const creds = getCredentials();
  if (!creds) throw new Error('Porkbun API keys not configured');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.status === 'ERROR') throw new Error(data.message || 'Porkbun API error');
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

async function setupDomainDNS(domain) {
  console.log(`Setting up DNS for ${domain} to point to Netlify\n`);

  // Step 1: Get current DNS records
  let records;
  try {
    const data = await porkbunPost(`/dns/retrieve/${domain}`, {});
    records = data.records || [];
    console.log(`Retrieved ${records.length} existing DNS records for ${domain}`);
  } catch (e) {
    console.error(`Failed to retrieve DNS records for ${domain}:`, e.message);
    process.exit(1);
  }

  // Step 2: Identify records to delete
  const recordsToDelete = [];
  const netlifyLB = 'apex-loadbalancer.netlify.com';
  const netlifyIP = '75.2.60.5';

  for (const record of records) {
    const { name, type, content, id } = record;
    // For apex: we want to replace any A or ALIAS record with an A record pointing to Netlify IP
    if ((name === '' || name === '@') && (type === 'A' || type === 'ALIAS')) {
      if (content !== netlifyIP) {
        recordsToDelete.push({ id, name: name || '@', type, content });
        console.log(`Marking for deletion: ${name || '@'} ${type} → ${content}`);
      }
    }
    // For www: we want to replace any CNAME record pointing to Netlify LB
    if (name === 'www' && type === 'CNAME') {
      if (content !== netlifyLB) {
        recordsToDelete.push({ id, name: 'www', type, content });
        console.log(`Marking for deletion: www CNAME → ${content}`);
      }
    }
  }

  // Step 3: Delete marked records
  for (const record of recordsToDelete) {
    try {
      await porkbunPost(`/dns/delete/${domain}`, { id: record.id });
      console.log(`✓ Deleted ${record.name || '@'} ${record.type} record`);
    } catch (e) {
      console.error(`✗ Failed to delete ${record.name || '@'} ${record.type}:`, e.message);
    }
  }

  // Wait a bit for deletions to propagate
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 4: Create new records
  const recordsToCreate = [
    { name: '', type: 'A', content: netlifyIP, ttl: 600 }, // Apex A record
    { name: 'www', type: 'CNAME', content: netlifyLB, ttl: 600 } // www CNAME
  ];

  for (const record of recordsToCreate) {
    try {
      const data = await porkbunPost(`/dns/create/${domain}`, {
        name: record.name,
        type: record.type,
        content: record.content,
        ttl: String(record.ttl)
      });
      console.log(`✓ Created ${record.name || '@'} ${record.type} → ${record.content} (ID: ${data.id})`);
    } catch (e) {
      console.error(`✗ Failed to create ${record.name || '@'} ${record.type}:`, e.message);
    }
  }

  console.log(`\nDNS setup for ${domain} complete.`);
  console.log(`Note: It may take some time for DNS changes to propagate.`);
  console.log(`After propagation, add ${domain} and www.${domain} to Netlify → Domain settings (if not already added).`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/setup-domain-dns.js <domain>');
    console.error('Example: node scripts/setup-domain-dns.js thr0ne.com');
    process.exit(1);
  }
  const domain = args[0];
  await setupDomainDNS(domain);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});