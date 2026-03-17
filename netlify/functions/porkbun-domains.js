import { listAllDomains } from './porkbun.js';

export async function handler(event, context) {
  try {
    const domains = await listAllDomains();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(domains)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
