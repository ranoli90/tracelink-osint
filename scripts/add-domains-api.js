#!/usr/bin/env node
/**
 * Add all domains to Netlify site using API
 * Run: node scripts/add-domains-api.js
 */
import fetch from 'node-fetch';

const API_BASE = 'https://api.netlify.com/api/v1';
const SITE_ID = '0d57ec43-14a2-43c4-bdf2-235d49ea4f15';
const API_TOKEN = 'nfp_R6gGxwpYzdAPTY5yoHpZHTSgLPxeVnjT6310';

const domains = [
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

async function addDomain(domain) {
  console.log(`Adding ${domain}...`);
  
  try {
    const response = await fetch(`${API_BASE}/sites/${SITE_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        custom_domain: domain
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`✓ Added ${domain}`);
      return true;
    } else {
      if (data.errors?.custom_domain?.includes('must be unique')) {
        console.log(`  ${domain} already exists on another site`);
      } else {
        console.log(`✗ Failed to add ${domain}: ${JSON.stringify(data.errors)}`);
      }
      return false;
    }
  } catch (error) {
    console.log(`✗ Error adding ${domain}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Adding domains to Netlify site...\n');
  
  let successCount = 0;
  let alreadyExistsCount = 0;
  
  for (const domain of domains) {
    const result = await addDomain(domain);
    if (result) successCount++;
    else alreadyExistsCount++;
  }
  
  console.log('\n=== Summary ===');
  console.log(`✅ Successfully added: ${successCount} domains`);
  console.log(`⚠️  Already exist elsewhere: ${alreadyExistsCount} domains`);
  console.log(`📝 Total processed: ${domains.length} domains`);
  
  console.log('\nNext steps:');
  console.log('1. Check Netlify dashboard for added domains');
  console.log('2. For domains that exist elsewhere, you may need to transfer them');
  console.log('3. Test DNS resolution once domains are added');
}

main().catch(console.error);
