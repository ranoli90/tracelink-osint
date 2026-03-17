#!/usr/bin/env node
/**
 * Set up DNS for all domains in Porkbun account to work with Netlify
 * Run: node scripts/setup-all-domains.js
 */
import 'dotenv/config';
import { createDnsRecord, listAllDomains } from '../netlify/functions/porkbun.js';

const NETLIFY_LB = 'apex-loadbalancer.netlify.com';
const NETLIFY_IP = '75.2.60.5';

async function setupDomain(domain) {
  console.log(`\n=== Setting up ${domain} ===`);
  
  // Try ALIAS first for apex domain
  try {
    await createDnsRecord(domain, { name: '', type: 'ALIAS', content: NETLIFY_LB, ttl: 600 });
    console.log(`✓ Apex ${domain} → ${NETLIFY_LB} (ALIAS)`);
  } catch (e) {
    if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
      console.log(`  Apex ALIAS already exists for ${domain}`);
    } else if (e.message?.includes('ALIAS') || e.message?.includes('invalid')) {
      // Fall back to A record
      try {
        await createDnsRecord(domain, { name: '', type: 'A', content: NETLIFY_IP, ttl: 600 });
        console.log(`✓ Apex ${domain} → ${NETLIFY_IP} (A record)`);
      } catch (e2) {
        if (e2.message?.includes('already exists') || e2.message?.includes('duplicate')) {
          console.log(`  Apex A record already exists for ${domain}`);
        } else {
          console.log(`✗ Apex A record failed for ${domain}: ${e2.message}`);
        }
      }
    } else {
      console.log(`✗ Apex record failed for ${domain}: ${e.message}`);
    }
  }

  // Setup www subdomain
  try {
    await createDnsRecord(domain, { name: 'www', type: 'CNAME', content: NETLIFY_LB, ttl: 600 });
    console.log(`✓ www.${domain} → ${NETLIFY_LB}`);
  } catch (e) {
    if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
      console.log(`  www CNAME already exists for ${domain}`);
    } else {
      console.log(`✗ www CNAME failed for ${domain}: ${e.message}`);
    }
  }

  // Setup tracking subdomain (for link tracking)
  try {
    await createDnsRecord(domain, { name: 'track', type: 'CNAME', content: NETLIFY_LB, ttl: 600 });
    console.log(`✓ track.${domain} → ${NETLIFY_LB}`);
  } catch (e) {
    if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
      console.log(`  track CNAME already exists for ${domain}`);
    } else {
      console.log(`✗ track CNAME failed for ${domain}: ${e.message}`);
    }
  }

  // Setup go subdomain (for short links)
  try {
    await createDnsRecord(domain, { name: 'go', type: 'CNAME', content: NETLIFY_LB, ttl: 600 });
    console.log(`✓ go.${domain} → ${NETLIFY_LB}`);
  } catch (e) {
    if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
      console.log(`  go CNAME already exists for ${domain}`);
    } else {
      console.log(`✗ go CNAME failed for ${domain}: ${e.message}`);
    }
  }
}

async function main() {
  console.log('Setting up DNS for all domains in Porkbun account → Netlify\n');

  try {
    const domains = await listAllDomains();
    
    if (domains.length === 0) {
      console.log('No domains found in account.');
      return;
    }

    console.log(`Found ${domains.length} domains. Setting up DNS for each...\n`);
    
    for (const domainInfo of domains) {
      await setupDomain(domainInfo.domain);
    }

    console.log('\n=== Summary ===');
    console.log('DNS setup completed for all domains.');
    console.log('\nNext steps:');
    console.log('1. Deploy your site to Netlify');
    console.log('2. Add all domains to Netlify → Domain settings');
    console.log('3. Wait for DNS propagation (usually 5-30 minutes)');
    console.log('4. Test link generation on each domain');

  } catch (e) {
    console.error('✗ Setup failed:', e.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
