#!/usr/bin/env node
/**
 * One-time script to set up thr0ne.com DNS for Netlify via Porkbun API.
 * Run: node scripts/setup-thr0ne-dns.js
 * Requires: PORKBUN_API_KEY, PORKBUN_SECRET_API_KEY in env (or .env)
 */
import 'dotenv/config';
import { createDnsRecord, ping } from '../netlify/functions/porkbun.js';

const ROOT = 'thr0ne.com';
const NETLIFY_LB = 'apex-loadbalancer.netlify.com';

async function main() {
  console.log('Porkbun DNS setup for thr0ne.com → Netlify\n');

  try {
    const { yourIp } = await ping();
    console.log('✓ Porkbun API connected (your IP:', yourIp, ')\n');
  } catch (e) {
    console.error('✗ Porkbun API failed:', e.message);
    console.error('  Set PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY in .env');
    process.exit(1);
  }

  // Apex: use ALIAS/CNAME if supported, else A record
  try {
    await createDnsRecord(ROOT, { name: '', type: 'ALIAS', content: NETLIFY_LB, ttl: 600 });
    console.log('✓ Apex thr0ne.com →', NETLIFY_LB);
  } catch (e) {
    if (e.message?.includes('ALIAS') || e.message?.includes('invalid')) {
      try {
        await createDnsRecord(ROOT, { name: '', type: 'A', content: '75.2.60.5', ttl: 600 });
        console.log('✓ Apex thr0ne.com → 75.2.60.5 (Netlify LB)');
      } catch (e2) {
        console.error('✗ Apex A record failed:', e2.message);
      }
    } else {
      console.error('✗ Apex record:', e.message);
    }
  }

  // www subdomain
  try {
    await createDnsRecord(ROOT, { name: 'www', type: 'CNAME', content: NETLIFY_LB, ttl: 600 });
    console.log('✓ www.thr0ne.com →', NETLIFY_LB);
  } catch (e) {
    if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
      console.log('  www CNAME already exists');
    } else {
      console.error('✗ www CNAME:', e.message);
    }
  }

  console.log('\nDone. Add thr0ne.com and www.thr0ne.com in Netlify → Domain settings.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
