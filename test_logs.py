import requests

response = requests.get(
    'https://api.render.com/v1/logs',
    headers={'Authorization': 'Bearer rnd_KouZ2bkVN3fZ1sWU3fc7mmp7ZE07'},
    params={
        'resource[id]': 'srv-d6sofka4d50c73bs6s7g',
        'resource[type]': 'server',
        'limit': 100,
        'direction': 'backward'
    },
    stream=True
)

print('Status:', response.status_code)

for line in response.iter_lines():
    if line:
        decoded = line.decode('utf-8')
        if decoded.startswith('data:'):
            print(decoded[5:].strip())
