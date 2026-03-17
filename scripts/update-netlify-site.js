#!/usr/bin/env node
/**
 * Update Netlify site using the Netlify API directly with an auth token from the config file.
 */
import { readFileSync } from 'fs';

const SITE_ID = '0d57ec43-14a2-43c4-bdf2-235d49ea4f15';

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

async function main() {
  let token;
  try {
    token = getNetlifyToken();
    console.log('Got Netlify auth token for user:', '69b6d4db94a18814fe823ee5');
  } catch (error) {
    console.error('Failed to get Netlify auth token:', error.message);
    process.exit(1);
  }

  const siteData = {
    custom_domain: 'snapchat.cv',
    domain_aliases: [
      'thr0ne.com',
      'www.thr0ne.com',
      'chris.quest',
      'www.chris.quest'
    ]
  };

  console.log('Updating site with domain_aliases...');
  try {
    // Use fetch to call the Netlify API
    const response = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(siteData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Update successful!');
    console.log('Custom domain:', result.custom_domain);
    console.log('Domain aliases:', result.domain_aliases);
  } catch (error) {
    console.error('Failed to update site:', error.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});