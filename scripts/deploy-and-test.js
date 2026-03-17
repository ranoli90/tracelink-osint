#!/usr/bin/env node
/**
 * Deploy to Netlify and test the setup
 * Run: node scripts/deploy-and-test.js
 */
import { execSync } from 'child_process';

async function deployAndWait() {
  console.log('=== Deploying to Netlify ===');
  
  try {
    // Deploy to production
    console.log('Starting production deployment...');
    const deployOutput = execSync('npx netlify deploy --prod', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log('✓ Deployment completed');
    console.log(deployOutput);
    
    return true;
  } catch (error) {
    console.error('✗ Deployment failed:', error.message);
    return false;
  }
}

async function testDomains() {
  console.log('\n=== Testing Domain Setup ===');
  
  const domains = [
    'thr0ne.com',
    'chris.quest', 
    'snapchat.cv',
    'myaccount.lol'
  ];
  
  for (const domain of domains) {
    try {
      console.log(`Testing ${domain}...`);
      const response = await fetch(`https://${domain}`);
      if (response.ok) {
        console.log(`✓ ${domain} is responding`);
      } else {
        console.log(`⚠ ${domain} responded with status: ${response.status}`);
      }
    } catch (error) {
      console.log(`✗ ${domain} failed: ${error.message}`);
    }
  }
}

async function main() {
  console.log('Netlify Deployment and Testing Script\n');
  
  // Wait for any ongoing processes to complete
  console.log('Waiting for background tasks to complete...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  const deploySuccess = await deployAndWait();
  
  if (deploySuccess) {
    console.log('\nWaiting 30 seconds for DNS propagation...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    await testDomains();
  }
  
  console.log('\n=== Summary ===');
  console.log('Setup process completed. Check the results above.');
  console.log('If domains are not working yet, wait a few more minutes for DNS propagation.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
