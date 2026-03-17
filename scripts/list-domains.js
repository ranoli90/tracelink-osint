#!/usr/bin/env node
/**
 * List all domains in Porkbun account
 * Run: node scripts/list-domains.js
 */
import 'dotenv/config';
import { listAllDomains } from '../netlify/functions/porkbun.js';

async function main() {
  console.log('Listing all domains in Porkbun account...\n');

  try {
    const domains = await listAllDomains();
    
    if (domains.length === 0) {
      console.log('No domains found in account.');
      return;
    }

    console.log(`Found ${domains.length} domains:\n`);
    
    domains.forEach((domain, index) => {
      console.log(`${index + 1}. ${domain.domain}`);
      console.log(`   Status: ${domain.status}`);
      console.log(`   Expires: ${domain.expireDate}`);
      console.log(`   Auto-renew: ${domain.autoRenew ? 'Yes' : 'No'}`);
      console.log('');
    });

  } catch (e) {
    console.error('✗ Failed to list domains:', e.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
