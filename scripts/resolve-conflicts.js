#!/usr/bin/env node
/**
 * Resolve domain conflicts by updating conflicting sites to free up domain aliases.
 */
import { readFileSync } from 'fs';

const SITE_ID = '0d57ec43-14a2-43c4-bdf2-235d49ea4f15'; // Our site: tracelink-app
const CONFLICTING_SITE_ID = '3f78d1a6-013d-4ea3-8fc6-081ebe0330b3'; // resplendent-kataifi-50d67b (has chris.quest as custom_domain)

// Function to get the Netlify auth token from the config file
function getNetlifyToken() {
  const homedir = process.env.USERPROFILE || process.env.HOME;
  if (!homedir) {
    throw new Error('Could not determine home directory');
  }
  const configPath = homedir + '/AppData/Roaming/netlify/Config/config.json';
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const userId = '69b6d4db94a18814fe823ee5'; // The current user ID from the config
  return config.users[userId].auth.token;
}

async function fetchNetlify(endpoint, method = 'GET', body = null) {
  const token = getNetlifyToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`https://api.netlify.com/api/v1/${endpoint}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  return response.json();
}

async function main() {
  try {
    console.log('Fetching conflicting site (resplendent-kataifi-50d67b)...');
    const conflictingSite = await fetchNetlify(`sites/${CONFLICTING_SITE_ID}`);
    console.log(`Current custom_domain: ${conflictingSite.custom_domain}`);
    console.log(`Current domain_aliases: ${JSON.stringify(conflictingSite.domain_aliases)}`);

    // Check if the conflicting site is using chris.quest as custom_domain
    if (conflictingSite.custom_domain === 'chris.quest') {
      console.log('\nUpdating conflicting site to remove custom_domain (chris.quest)...');
      // Update the site to remove the custom_domain (set to null)
      const updatedSite = await fetchNetlify(`sites/${CONFLICTING_SITE_ID}`, 'PATCH', {
        custom_domain: null
      });
      console.log('✓ Updated conflicting site. New custom_domain:', updatedSite.custom_domain);
    } else {
      console.log('\nConflicting site is not using chris.quest as custom_domain. Nothing to do.');
    }

    // Now try to update our site with the desired domain aliases
    console.log('\nUpdating our site (tracelink-app) with domain aliases...');
    const ourSite = await fetchNetlify(`sites/${SITE_ID}`, 'PATCH', {
      custom_domain: 'snapchat.cv', // Keep the existing custom domain
      domain_aliases: [
        'thr0ne.com',
        'www.thr0ne.com',
        'chris.quest',
        'www.chris.quest'
      ]
    });
    console.log('✓ Updated our site.');
    console.log('  Custom domain:', ourSite.custom_domain);
    console.log('  Domain aliases:', ourSite.domain_aliases);

  } catch (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});