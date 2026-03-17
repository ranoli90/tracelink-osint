#!/usr/bin/env node
/**
 * Update Netlify site using the Netlify API directly with an auth token.
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const SITE_ID = '0d57ec43-14a2-43c4-bdf2-235d49ea4f15';

// Function to get the Netlify auth token from the config file
function getNetlifyToken() {
  const configPath = require('os').homedir() + '/AppData/Roaming/netlify/Config/config.json';
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const userId = Object.keys(config.users)[0]; // Assuming the first user is the current one
  return config.users[userId].auth.token;
}

async function main() {
  let token;
  try {
    token = getNetlifyToken();
    console.log('Got Netlify auth token');
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
    // Use execSync to run curl, but we can also use fetch in Node.js.
    // Since we are in Node.js, we can use the built-in fetch (Node.js v18+).
    const response = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(siteData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
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