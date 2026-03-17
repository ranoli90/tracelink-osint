#!/usr/bin/env node
/**
 * Add all domains from Porkbun account to Netlify site
 * Run: node scripts/add-domains-to-netlify.js
 */
import 'dotenv/config';
import { listAllDomains } from '../netlify/functions/porkbun.js';
import { execSync } from 'child_process';

const domains = [
  'thr0ne.com',
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
  'netfiix.lol',
  'chris.quest'
];

async function addDomainToNetlify(domain) {
  console.log(`Adding ${domain} to Netlify...`);
  
  try {
    // Add domain to Netlify
    const output = execSync(`npx netlify domains:add ${domain}`, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`✓ Added ${domain} to Netlify`);
  } catch (error) {
    if (error.stdout?.includes('already exists') || error.stdout?.includes('already added')) {
      console.log(`  ${domain} already exists in Netlify`);
    } else {
      console.log(`✗ Failed to add ${domain}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('Adding all domains to Netlify site...\n');

  for (const domain of domains) {
    await addDomainToNetlify(domain);
  }

  console.log('\n=== Summary ===');
  console.log('Domain addition process completed.');
  console.log('\nNext steps:');
  console.log('1. Wait for DNS propagation (5-30 minutes)');
  console.log('2. Verify all domains are working');
  console.log('3. Test link generation on different domains');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
