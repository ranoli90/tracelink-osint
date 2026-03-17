#!/usr/bin/env node
/**
 * Update DNS records for chris.quest to point to Netlify.
 * Requires: PORKBUN_API_KEY, PORKBUN_SECRET_API_KEY in env (or .env)
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

async function main() {
  console.log(`Updating DNS for chris.quest to point to Netlify\n`);

  // Records to delete: [id, name, type]
  const recordsToDelete = [
    { id: '530442211', name: '@', type: 'ALIAS' }, // chris.quest ALIAS
    { id: '530607084', name: 'www', type: 'CNAME' } // www.chris.quest CNAME
  ];

  for (const record of recordsToDelete) {
    try {
      await porkbunPost(`/dns/delete/chris.quest`, { id: record.id });
      console.log(`✓ Deleted ${record.name || '@'} ${record.type} record`);
    } catch (e) {
      console.error(`✗ Failed to delete ${record.name || '@'} ${record.type}:`, e.message);
    }
  }

  // Wait a moment for deletion to propagate
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Records to create: [name, type, content]
  const recordsToCreate = [
    { name: '', type: 'A', content: '75.2.60.5' }, // Apex A record
    { name: 'www', type: 'CNAME', content: 'apex-loadbalancer.netlify.com' } // www CNAME
  ];

  for (const record of recordsToCreate) {
    try {
      await porkbunPost(`/dns/create/chris.quest`, {
        name: record.name,
        type: record.type,
        content: record.content,
        ttl: '600'
      });
      console.log(`✓ Created ${record.name || '@'} ${record.type} → ${record.content}`);
    } catch (e) {
      console.error(`✗ Failed to create ${record.name || '@'} ${record.type}:`, e.message);
    }
  }

  console.log('\nDone. Wait for DNS propagation, then add chris.quest and www.chris.quest in Netlify → Domain settings.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});