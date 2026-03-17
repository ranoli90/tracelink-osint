/**
 * Porkbun API v3 - DNS management
 * Uses fetch to avoid extra dependencies.
 * Set PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY in env.
 */

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

/**
 * Create a DNS record for a domain.
 * @param {string} domain - Root domain (e.g. thr0ne.com)
 * @param {object} record - { name, type, content, ttl? }
 * @returns {Promise<{id: string}>}
 */
export async function createDnsRecord(domain, record) {
  const { name, type, content, ttl = 600 } = record;
  const data = await porkbunPost(`/dns/create/${domain}`, {
    name: name || '',
    type,
    content,
    ttl: String(ttl),
  });
  return { id: data.id };
}

/**
 * Create CNAME record for subdomain pointing to Netlify.
 * @param {string} subdomain - e.g. "track" for track.thr0ne.com
 * @param {string} rootDomain - e.g. thr0ne.com
 * @param {string} target - e.g. apex-loadbalancer.netlify.com or your-site.netlify.app
 */
export async function createCnameRecord(subdomain, rootDomain, target) {
  return createDnsRecord(rootDomain, {
    name: subdomain,
    type: 'CNAME',
    content: target,
    ttl: 600,
  });
}

/**
 * Create A records for apex domain (Netlify load balancer IPs).
 */
export async function createApexRecords(rootDomain) {
  const lbIp = '75.2.60.5';
  const res = await porkbunPost(`/dns/create/${rootDomain}`, {
    name: '',
    type: 'A',
    content: lbIp,
    ttl: 600,
  });
  return { id: res.id };
}

/**
 * Check if Porkbun API is configured and working.
 */
export async function ping() {
  const data = await porkbunPost('/ping');
  return { yourIp: data.yourIp };
}

/**
 * List all domains in the Porkbun account.
 * Paginates automatically (1000 per page).
 * @returns {Promise<Array<{domain, status, tld, createDate, expireDate, autoRenew}>>}
 */
export async function listAllDomains() {
  const allDomains = [];
  let start = 0;
  while (true) {
    const data = await porkbunPost('/domain/listAll', { start: String(start) });
    const page = data.domains || [];
    allDomains.push(...page);
    if (page.length < 1000) break;
    start += 1000;
  }
  return allDomains.map(d => ({
    domain: d.domain,
    status: d.status,
    tld: d.tld,
    createDate: d.createDate,
    expireDate: d.expireDate,
    autoRenew: d.autoRenew,
  }));
}
