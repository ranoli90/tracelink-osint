const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const OWNER_ID = 'tea-d6p1rv6a2pns73f4sucg';

async function callRenderApi(endpoint, method = 'GET', body = null) {
  const response = await fetch(`https://api.render.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
  return response.json();
}

const tools = [
  {
    name: 'list_services',
    description: 'List all Render services',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_service',
    description: 'Get details of a specific service',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Service ID' }
      },
      required: ['serviceId']
    }
  },
  {
    name: 'deploy_service',
    description: 'Trigger a new deploy for a service',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Service ID' }
      },
      required: ['serviceId']
    }
  },
  {
    name: 'list_env_vars',
    description: 'List environment variables for a service',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Service ID' }
      },
      required: ['serviceId']
    }
  },
  {
    name: 'set_env_var',
    description: 'Set an environment variable for a service',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Service ID' },
        key: { type: 'string', description: 'Environment variable key' },
        value: { type: 'string', description: 'Environment variable value' }
      },
      required: ['serviceId', 'key', 'value']
    }
  },
  {
    name: 'get_service_logs',
    description: 'Get logs for a service',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Service ID' }
      },
      required: ['serviceId']
    }
  },
  {
    name: 'restart_service',
    description: 'Restart a service',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Service ID' }
      },
      required: ['serviceId']
    }
  },
  {
    name: 'get_deploy_status',
    description: 'Get deployment status for a service',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Service ID' },
        deployId: { type: 'string', description: 'Deploy ID' }
      },
      required: ['serviceId', 'deployId']
    }
  }
];

const server = new Server(
  {
    name: 'render-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_services': {
        const services = await callRenderApi('/services');
        return {
          content: [{ type: 'text', text: JSON.stringify(services, null, 2) }]
        };
      }

      case 'get_service': {
        const service = await callRenderApi(`/services/${args.serviceId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(service, null, 2) }]
        };
      }

      case 'deploy_service': {
        const result = await callRenderApi(`/services/${args.serviceId}/deploys`, 'POST');
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'list_env_vars': {
        const envVars = await callRenderApi(`/services/${args.serviceId}/env-vars`);
        return {
          content: [{ type: 'text', text: JSON.stringify(envVars, null, 2) }]
        };
      }

      case 'set_env_var': {
        const result = await callRenderApi(
          `/services/${args.serviceId}/env-vars/${args.key}`,
          'PUT',
          { key: args.key, value: args.value }
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'get_service_logs': {
        const logs = await callRenderApi(`/services/${args.serviceId}/logs`);
        return {
          content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }]
        };
      }

      case 'restart_service': {
        const result = await callRenderApi(`/services/${args.serviceId}/restart`, 'POST');
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'get_deploy_status': {
        const result = await callRenderApi(`/services/${args.serviceId}/deploys/${args.deployId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
