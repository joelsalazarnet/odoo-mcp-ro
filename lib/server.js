/**
 * MCP server for Odoo integration
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { OdooClient, OdooConfig } = require('./odoo-client.js');
require('dotenv').config();

class OdooMcpServer {
  constructor() {
    this.server = new Server({ name: 'odoo-mcp-ro', version: '0.1.0' }, { capabilities: { tools: {} } });
    this.odooClient = null;
    this.setupToolHandlers();
  }

  getOdooClient() {
    if (!this.odooClient) {
      const config = new OdooConfig({
        url: process.env.ODOO_URL,
        database: process.env.ODOO_DB,
        username: process.env.ODOO_USERNAME,
        password: process.env.ODOO_PASSWORD,
        apiKey: process.env.ODOO_API_KEY,
        timeout: parseInt(process.env.ODOO_TIMEOUT || '120'),
      });
      this.odooClient = new OdooClient(config);
    }
    return this.odooClient;
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_records',
            description: 'Search for Odoo records',
            inputSchema: {
              type: 'object',
              properties: {
                model: {
                  type: 'string',
                  description: "Odoo model name (e.g., 'res.partner', 'sale.order')",
                },
                domain: {
                  type: 'array',
                  description: "Search domain in Odoo format (e.g., [['name', 'ilike', 'john']])",
                  items: { type: 'array' },
                  default: [],
                },
                fields: {
                  type: 'array',
                  description: 'List of fields to return',
                  items: { type: 'string' },
                  default: null,
                },
                limit: {
                  type: 'integer',
                  description: 'Maximum number of records to return',
                  default: null,
                },
                offset: {
                  type: 'integer',
                  description: 'Number of records to skip',
                  default: 0,
                },
                order: {
                  type: 'string',
                  description: "Sort order (e.g., 'name asc, id desc')",
                  default: null,
                },
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
                model: {
                  type: 'string',
                  description: 'Odoo model name',
                },
                ids: {
                  type: 'array',
                  description: 'List of record IDs to retrieve',
                  items: { type: 'integer' },
                },
                fields: {
                  type: 'array',
                  description: 'List of fields to return',
                  items: { type: 'string' },
                  default: null,
                },
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
                transient: {
                  type: 'boolean',
                  description: 'Include transient (wizard) models',
                  default: false,
                },
              },
            },
          },
          {
            name: 'get_model_fields',
            description: 'Get field definitions for an Odoo model',
            inputSchema: {
              type: 'object',
              properties: {
                model: {
                  type: 'string',
                  description: 'Odoo model name',
                },
                fields: {
                  type: 'array',
                  description: 'Specific fields to get info for (optional)',
                  items: { type: 'string' },
                  default: null,
                },
              },
              required: ['model'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const client = this.getOdooClient();

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
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Odoo MCP server running on stdio');
  }
}

async function main() {
  const server = new OdooMcpServer();
  await server.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { OdooMcpServer };
