#!/usr/bin/env node
/**
 * Update DNS records for chris.quest to point to Netlify.
 * Requires: PORKBUN_API_KEY, PORKBUN_SECRET_API_KEY in env (or .env)
 */
import 'dotenv/config';
import { porkbunPost } from '../netlify/functions/porkbun.js';

const ROOT = 'chris.quest';
const NETLIFY_LB = 'apex-loadbalancer.netlify.com';
const NETLIFY_LB_IP = '75.2.60.5';

async function main() {
  console.log(`Updating DNS for ${ROOT} to point to Netlify\n`);

  // Records to delete: [id, name, type]
  const recordsToDelete = [
    { id: '530442211', name: '@', type: 'ALIAS' }, // chris.quest ALIAS
    { id: '530607084', name: 'www', type: 'CNAME' } // www.chris.quest CNAME
  ];

  for (const record of recordsToDelete) {
    try {
      await porkbunPost(`/dns/delete/${ROOT}`, { id: record.id });
      console.log(`✓ Deleted ${record.name || '@'} ${record.type} record`);
    } catch (e) {
      console.error(`✗ Failed to delete ${record.name || '@'} ${record.type}:`, e.message);
    }
  }

  // Wait a moment for deletion to propagate
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Records to create: [name, type, content]
  const recordsToCreate = [
    { name: '', type: 'A', content: NETLIFY_LB_IP }, // Apex A record
    { name: 'www', type: 'CNAME', content: NETLIFY_LB } // www CNAME
  ];

  for (const record of recordsToCreate) {
    try {
      await porkbunPost(`/dns/create/${ROOT}`, {
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

  console.log('\nDone. Wait for DNS propagation, then add', ROOT, 'and www.', ROOT, 'in Netlify → Domain settings.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});