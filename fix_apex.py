import os
import urllib.request
import json
import ssl

def get_env():
    env = {}
    try:
        with open('.env', 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    k, v = line.strip().split('=', 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    env[k] = v
    except Exception as e:
        print(f"Error reading .env: {e}")
    return env

env = get_env()
API_KEY = env.get('PORKBUN_API_KEY')
SECRET_KEY = env.get('PORKBUN_SECRET_KEY')
DOMAIN = 'chris.quest'

def request(path, payload={}):
    data = {"apikey": API_KEY, "secretapikey": SECRET_KEY}
    data.update(payload)
    data = json.dumps(data).encode('utf-8')
    
    url = f"https://api.porkbun.com/api/json/v3/dns/{path}"
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason} -> {e.read().decode()}")
        return None
    except Exception as e:
        print(f"Request failed: {url} - {e}")
        return None

def fix_records():
    print(f"Fixing DNS for {DOMAIN}... (API_KEY: {API_KEY[:5]}...)")
    
    records_response = request(f"retrieve/{DOMAIN}")
    if not records_response or records_response.get('status') != 'SUCCESS':
        print("Failed to pull records.")
        return

    records = records_response.get('records', [])
    
    # 1. Delete Porkbun Parked IPs
    for r in records:
        if r['name'] == DOMAIN and r['type'] == 'A' and r['content'] == '119.8.104.22':
            print(f"Deleting parked IP {r['id']}...")
            request(f"delete/{DOMAIN}/{r['id']}")

    # 2. Add Netlify Load Balancer (75.2.60.5)
    netlify_a = any(r['name'] == DOMAIN and r['type'] == 'A' and r['content'] == '75.2.60.5' for r in records)
    if not netlify_a:
        print("Adding Netlify Apex A Record (75.2.60.5)...")
        res = request(f"create/{DOMAIN}", {"name": "", "type": "A", "content": "75.2.60.5", "ttl": "600"})
        print(res)
    else:
        print("Netlify Apex A Record already exists.")

    print("✅ DNS checks completed.")

if __name__ == '__main__':
    fix_records()
