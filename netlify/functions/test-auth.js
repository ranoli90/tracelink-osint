export async function handler(event, context) {
  const NETLIFY_SITE_ID = '0d57ec43-14a2-43c4-bdf2-235d49ea4f15';
  const domains = [
    'thr0ne.com', 'chris.quest', 'myaccount.lol', 'tiktok.gen.in',
    'tiktok.name', 'tiktok.org.in', 'chris.forum', 'nike.org.in',
    'y0utube.buzz', 'y0utube.cv', 'y0utube.vip', 'googie.one',
    'netfiix.cloud', 'y0utube.help', 'reddit.com.de', 'lnstagram.lol',
    'lnstagram.pics', 'googie.pics', 'chris.autos', 'tikt0k.help',
    'netfiix.lol'
  ];

  // Try to get auth token from Netlify headers
  const authToken = event.headers['x-netlify-token'] || event.headers['authorization']?.replace('Bearer ', '');
  
  if (!authToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'No auth token provided' })
    };
  }

  // First get current site to see what we're working with
  const siteResponse = await fetch(`https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const site = await siteResponse.json();
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      custom_domain: site.custom_domain,
      domain_aliases: site.domain_aliases,
      available_domains: domains
    })
  };
}
