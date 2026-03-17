#!/usr/bin/env node
/**
 * Update Netlify site domain_aliases to include all desired domains.
 */
import { execSync } from 'child_process';

const SITE_ID = '0d57ec43-14a2-43c4-bdf2-235d49ea4f15';

async function main() {
  console.log('Fetching current site settings...');
  let site;
  try {
    const getSiteOutput = execSync('npx', ['netlify', 'api', 'getSite', '--data', JSON.stringify({ site_id: SITE_ID })], { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    site = JSON.parse(getSiteOutput);
    console.log(`Current custom_domain: ${site.custom_domain}`);
    console.log(`Current domain_aliases: ${JSON.stringify(site.domain_aliases)}`);
  } catch (error) {
    console.error('✗ Failed to get site:', error.message);
    if (error.stdout) console.error('STDOUT:', error.stdout.toString());
    if (error.stderr) console.error('STDERR:', error.stderr.toString());
    process.exit(1);
  }

  // Update domain_aliases - keep custom_domain as is, update domain_aliases
  site.domain_aliases = [
    'thr0ne.com',
    'www.thr0ne.com',
    'chris.quest',
    'www.chris.quest'
  ];

  console.log('\nUpdating site with new domain_aliases...');
  try {
    const updateOutput = execSync('npx', ['netlify', 'api', 'updateSite', '--data', JSON.stringify(site)], { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const result = JSON.parse(updateOutput);
    console.log(`\nUpdate successful!`);
    console.log(`Custom domain: ${result.custom_domain}`);
    console.log(`Domain aliases: ${JSON.stringify(result.domain_aliases)}`);
  } catch (error) {
    console.error('✗ Failed to update site:', error.message);
    if (error.stdout) console.error('STDOUT:', error.stdout.toString());
    if (error.stderr) console.error('STDERR:', error.stderr.toString());
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});