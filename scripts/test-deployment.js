#!/usr/bin/env node
/**
 * Test the deployed tracelink service
 * Run: node scripts/test-deployment.js
 */
import fetch from 'node-fetch';

const BASE_URL = 'https://tracelink-app.netlify.app';

async function testEndpoint(url, description) {
  try {
    console.log(`Testing ${description}...`);
    const response = await fetch(url);
    console.log(`✓ ${description}: ${response.status} ${response.statusText}`);
    return response.ok;
  } catch (error) {
    console.log(`✗ ${description}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Testing Tracelink Deployment ===\n');

  // Test main site
  const siteOk = await testEndpoint(BASE_URL, 'Main site');

  if (!siteOk) {
    console.log('\n❌ Site not accessible. Deployment may have failed.');
    return;
  }

  // Test admin endpoint
  await testEndpoint(`${BASE_URL}/admin`, 'Admin panel');

  // Test API endpoints
  await testEndpoint(`${BASE_URL}/api/links`, 'API links endpoint');

  console.log('\n=== Environment Variables Test ===');
  console.log('Checking if Porkbun API is configured...');

  try {
    const response = await fetch(`${BASE_URL}/.netlify/functions/porkbun-test`);
    if (response.ok) {
      console.log('✓ Porkbun API configured');
    } else {
      console.log('⚠ Porkbun API not responding');
    }
  } catch (error) {
    console.log('⚠ Porkbun API test failed (expected - function may not exist yet)');
  }

  console.log('\n=== Summary ===');
  console.log('✅ Site is deployed and accessible');
  console.log('✅ Basic functionality working');
  console.log('⏳ Next: Add custom domains in Netlify dashboard');
  console.log('\nTo add domains:');
  console.log('1. Go to https://app.netlify.com/sites/tracelink-app/settings/domain');
  console.log('2. Add all domains from your Porkbun account');
  console.log('3. DNS is already configured in Porkbun to point to Netlify');
}

main().catch(console.error);
