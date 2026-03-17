#!/usr/bin/env node
import 'dotenv/config';
const API_BASE = 'https://api.porkbun.com/api/json/v3';

function getCredentials() {
  const apiKey = process.env.PORKBUN_API_KEY;
  const secretKey = process.env.PORKBUN_SECRET_API_KEY;
  if (!apiKey || !secretKey) return null;
  return { apikey: apiKey, secretapikey: secretKey };
}

async function porkbunPost(endpoint, body = {}) {
  const creds = getCredentials();
  if (!creds) throw new Error('Porkbun API keys not configured');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.status === 'ERROR') throw new Error(data.message || 'Porkbun API error');
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

async function main() {
  try {
    const data = await porkbunPost('/dns/retrieve/thr0ne.com', {});
    console.log('DNS records for thr0ne.com:');
    const records = data.records || [];
    for (const r of records) {
      console.log(`${r.name || '@'} ${r.type} → ${r.content} (TTL: ${r.ttl}, ID: ${r.id})`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();