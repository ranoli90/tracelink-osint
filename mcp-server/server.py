#!/usr/bin/env python3
"""MCP Server for Render.com API"""

import os
import json
import asyncio
from aiohttp import web

RENDER_API_KEY = os.environ.get('RENDER_API_KEY')
OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg'

async def call_render_api(endpoint, method='GET', body=None):
    url = f'https://api.render.com/v1{endpoint}'
    headers = {
        'Authorization': f'Bearer {RENDER_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.request(method, url, json=body, headers=headers) as response:
            return await response.json()

TOOLS = [
    {
        'name': 'list_services',
        'description': 'List all Render services',
        'inputSchema': {'type': 'object', 'properties': {}}
    },
    {
        'name': 'get_service',
        'description': 'Get details of a specific service',
        'inputSchema': {
            'type': 'object',
            'properties': {'serviceId': {'type': 'string'}},
            'required': ['serviceId']
        }
    },
    {
        'name': 'deploy_service',
        'description': 'Trigger a new deploy for a service',
        'inputSchema': {
            'type': 'object',
            'properties': {'serviceId': {'type': 'string'}},
            'required': ['serviceId']
        }
    },
    {
        'name': 'list_env_vars',
        'description': 'List environment variables for a service',
        'inputSchema': {
            'type': 'object',
            'properties': {'serviceId': {'type': 'string'}},
            'required': ['serviceId']
        }
    },
    {
        'name': 'set_env_var',
        'description': 'Set an environment variable for a service',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'serviceId': {'type': 'string'},
                'key': {'type': 'string'},
                'value': {'type': 'string'}
            },
            'required': ['serviceId', 'key', 'value']
        }
    },
    {
        'name': 'get_service_logs',
        'description': 'Get logs for a service',
        'inputSchema': {
            'type': 'object',
            'properties': {'serviceId': {'type': 'string'}},
            'required': ['serviceId']
        }
    },
    {
        'name': 'restart_service',
        'description': 'Restart a service',
        'inputSchema': {
            'type': 'object',
            'properties': {'serviceId': {'type': 'string'}},
            'required': ['serviceId']
        }
    }
]

async def handle_json_rpc(request):
    data = await request.json()
    
    if data.get('method') == 'tools/list':
        return web.json_response({
            'jsonrpc': '2.0',
            'id': data.get('id'),
            'result': {'tools': TOOLS}
        })
    
    if data.get('method') == 'tools/call':
        tool_name = data['params']['name']
        args = data['params'].get('arguments', {})
        
        try:
            if tool_name == 'list_services':
                result = await call_render_api('/services')
            elif tool_name == 'get_service':
                result = await call_render_api(f"/services/{args['serviceId']}")
            elif tool_name == 'deploy_service':
                result = await call_render_api(f"/services/{args['serviceId']}/deploys", 'POST')
            elif tool_name == 'list_env_vars':
                result = await call_render_api(f"/services/{args['serviceId']}/env-vars")
            elif tool_name == 'set_env_var':
                result = await call_render_api(
                    f"/services/{args['serviceId']}/env-vars/{args['key']}",
                    'PUT',
                    {'key': args['key'], 'value': args['value']}
                )
            elif tool_name == 'get_service_logs':
                result = await call_render_api(f"/services/{args['serviceId']}/logs")
            elif tool_name == 'restart_service':
                result = await call_render_api(f"/services/{args['serviceId']}/restart", 'POST')
            else:
                result = {'error': f'Unknown tool: {tool_name}'}
            
            return web.json_response({
                'jsonrpc': '2.0',
                'id': data.get('id'),
                'result': {'content': [{'type': 'text', 'text': json.dumps(result)}]}
            })
        except Exception as e:
            return web.json_response({
                'jsonrpc': '2.0',
                'id': data.get('id'),
                'error': {'message': str(e)}
            })
    
    return web.json_response({'jsonrpc': '2.0', 'id': data.get('id'), 'result': {}})

async def index(request):
    return web.Response(text='Render MCP Server Running')

app = web.Application()
app.router.add_get('/', index)
app.router.add_post('/mcp', handle_json_rpc)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    web.run_app(app, port=port)
