#!/usr/bin/env node

/**
 * Minimal MCP server for Odoo integration using JSON-RPC
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

class OdooClient {
  constructor({ url, database, username, password, apiKey, timeout = 120 }) {
    if (!password && !apiKey) {
      throw new Error('Either password or apiKey must be provided');
    }

    this.url = url.replace(/\/$/, '');
    this.database = database;
    this.username = username;
    this.password = apiKey || password;
    this.timeout = timeout * 1000; // Convert to milliseconds
    this.uid = null;
  }

  async jsonRpcCall(service, method, params) {
    const url = `${this.url}/jsonrpc`;
    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service,
        method,
        args: params
      },
      id: Math.floor(Math.random() * 1000000)
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Odoo Error: ${result.error.message || result.error.data?.message || 'Unknown error'}`);
      }

      return result.result;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async authenticate() {
    if (this.uid) return this.uid;
    
    const result = await this.jsonRpcCall('common', 'authenticate', [
      this.database, 
      this.username, 
      this.password, 
      {}
    ]);
    
    if (!result) {
      throw new Error('Authentication failed: Invalid credentials');
    }
    
    this.uid = result;
    return result;
  }

  async execute(model, method, args = [], kwargs = {}) {
    const uid = await this.authenticate();
    
    return this.jsonRpcCall('object', 'execute_kw', [
      this.database, 
      uid, 
      this.password, 
      model, 
      method, 
      args, 
      kwargs
    ]);
  }

  async searchRead(model, domain = [], { fields = null, offset = 0, limit = null, order = null } = {}) {
    const kwargs = { offset };
    if (fields) kwargs.fields = fields;
    if (limit) kwargs.limit = limit;
    if (order) kwargs.order = order;
    return this.execute(model, 'search_read', [domain], kwargs);
  }

  async read(model, ids, { fields = null } = {}) {
    ids = Array.isArray(ids) ? ids : [ids];
    const kwargs = fields ? { fields } : {};
    const result = await this.execute(model, 'read', [ids], kwargs);
    return ids.length === 1 ? result[0] : result;
  }

  async fieldsGet(model, { fields = null } = {}) {
    const kwargs = fields ? { allfields: fields } : {};
    return this.execute(model, 'fields_get', [], kwargs);
  }

  async getModelList() {
    return this.searchRead('ir.model', [], { fields: ['model', 'name', 'transient'] });
  }
}

async function createMcpServer() {
  const server = new Server({ name: 'odoo-mcp-ro', version: '0.1.0' }, { capabilities: { tools: {} } });
  let odooClient = null;

  const getOdooClient = () => {
    if (!odooClient) {
      odooClient = new OdooClient({
        url: process.env.ODOO_URL,
        database: process.env.ODOO_DB,
        username: process.env.ODOO_USERNAME,
        password: process.env.ODOO_PASSWORD,
        apiKey: process.env.ODOO_API_KEY,
        timeout: parseInt(process.env.ODOO_TIMEOUT || '120'),
      });
    }
    return odooClient;
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search_records',
        description: 'Search for Odoo records',
        inputSchema: {
          type: 'object',
          properties: {
            model: { type: 'string', description: "Odoo model name (e.g., 'res.partner', 'sale.order')" },
            domain: { type: 'array', description: "Search domain in Odoo format", items: { type: 'array' }, default: [] },
            fields: { type: 'array', description: 'List of fields to return', items: { type: 'string' }, default: null },
            limit: { type: 'integer', description: 'Maximum number of records to return', default: null },
            offset: { type: 'integer', description: 'Number of records to skip', default: 0 },
            order: { type: 'string', description: "Sort order (e.g., 'name asc, id desc')", default: null },
          },
          required: ['model'],
        },
      },
      {
        name: 'get_record',
        description: 'Get specific Odoo records by ID',
        inputSchema: {
          type: 'object',
          properties: {
            model: { type: 'string', description: 'Odoo model name' },
            ids: { type: 'array', description: 'List of record IDs to retrieve', items: { type: 'integer' } },
            fields: { type: 'array', description: 'List of fields to return', items: { type: 'string' }, default: null },
          },
          required: ['model', 'ids'],
        },
      },
      {
        name: 'list_models',
        description: 'List all available Odoo models',
        inputSchema: {
          type: 'object',
          properties: {
            transient: { type: 'boolean', description: 'Include transient (wizard) models', default: false },
          },
        },
      },
      {
        name: 'get_model_fields',
        description: 'Get field definitions for an Odoo model',
        inputSchema: {
          type: 'object',
          properties: {
            model: { type: 'string', description: 'Odoo model name' },
            fields: { type: 'array', description: 'Specific fields to get info for (optional)', items: { type: 'string' }, default: null },
          },
          required: ['model'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const client = getOdooClient();

      switch (name) {
        case 'search_records': {
          const result = await client.searchRead(args.model, args.domain || [], {
            fields: args.fields,
            offset: args.offset || 0,
            limit: args.limit,
            order: args.order,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'get_record': {
          const result = await client.read(args.model, args.ids, { fields: args.fields });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'list_models': {
          const models = await client.getModelList();
          const filteredModels = args.transient ? models : models.filter(m => !m.transient);
          
          const output = 'Available Odoo models:\n' + 
            filteredModels.sort((a, b) => a.model.localeCompare(b.model))
              .map(model => `- ${model.model}: ${model.name}`)
              .join('\n');

          return { content: [{ type: 'text', text: output }] };
        }

        case 'get_model_fields': {
          const fields = await client.fieldsGet(args.model, { fields: args.fields });
          return { content: [{ type: 'text', text: JSON.stringify(fields, null, 2) }] };
        }

        default:
          return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
      }
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.constructor.name}: ${error.message}` }] };
    }
  });

  return server;
}

async function main() {
  const server = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Odoo MCP server running on stdio');
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

if (require.main === module) main().catch(console.error);
