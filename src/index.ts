#!/usr/bin/env node

/**
 * Minimal MCP server for Odoo integration using JSON-RPC
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  CallToolRequest,
  CallToolResult
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Input validation schemas
const SearchRecordsSchema = z.object({
  model: z.string().min(1, "Model name cannot be empty"),
  domain: z.array(z.array(z.any())).default([]),
  fields: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().min(0).default(0),
  order: z.string().optional()
});

const GetRecordSchema = z.object({
  model: z.string().min(1, "Model name cannot be empty"),
  ids: z.array(z.number().int().positive()),
  fields: z.array(z.string()).optional()
});

const ListModelsSchema = z.object({
  transient: z.boolean().default(false)
});

const GetModelFieldsSchema = z.object({
  model: z.string().min(1, "Model name cannot be empty"),
  fields: z.array(z.string()).optional()
});

class OdooClient {
  private url: string;
  private database: string;
  private username: string;
  private password: string;
  private uid: number | null = null;
  private sessionId = 0; // Reuse session IDs for better performance

  constructor(url: string, database: string, username: string, password: string) {
    this.url = url.replace(/\/$/, '');
    this.database = database;
    this.username = username;
    this.password = password;
  }

  private async rpc(service: string, method: string, params: any[]): Promise<any> {
    const response = await fetch(`${this.url}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { service, method, args: params },
        id: ++this.sessionId // Increment instead of Date.now()
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error.message || 'Odoo error');
    return result.result;
  }

  private async auth(): Promise<number> {
    if (this.uid) return this.uid;
    this.uid = await this.rpc('common', 'authenticate', [this.database, this.username, this.password, {}]);
    if (!this.uid) throw new Error('Auth failed');
    return this.uid;
  }

  async call(model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<any> {
    const uid = await this.auth();
    return this.rpc('object', 'execute_kw', [this.database, uid, this.password, model, method, args, kwargs]);
  }
}

// Pre-initialize client and validation to avoid repeated instantiation
let odooClient: OdooClient | null = null;
const getOdooClient = (): OdooClient => {
  if (!odooClient) {
    const url = process.env.ODOO_URL;
    const database = process.env.ODOO_DB;
    const username = process.env.ODOO_USERNAME;
    const password = process.env.ODOO_PASSWORD || process.env.ODOO_API_KEY;

    if (!url || !database || !username || !password) {
      throw new Error('Missing required environment variables');
    }

    odooClient = new OdooClient(url, database, username, password);
  }
  return odooClient;
};

// Pre-defined tools schema for faster response
const TOOLS_RESPONSE = {
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
} as const;

async function createMcpServer(): Promise<Server> {
  const server = new Server({ name: 'odoo-mcp-ro', version: '0.1.0' }, { capabilities: { tools: {} } });

  // Return pre-built response for better performance
  server.setRequestHandler(ListToolsRequestSchema, async () => TOOLS_RESPONSE);

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    try {
      const client = getOdooClient();

      switch (name) {
        case 'search_records': {
          const validatedArgs = SearchRecordsSchema.parse(args);
          
          const kwargs: any = { offset: validatedArgs.offset };
          if (validatedArgs.fields) kwargs.fields = validatedArgs.fields;
          if (validatedArgs.limit) kwargs.limit = validatedArgs.limit;
          if (validatedArgs.order) kwargs.order = validatedArgs.order;
          
          const result = await client.call(validatedArgs.model, 'search_read', [validatedArgs.domain], kwargs);
          
          // Optimize string building
          const resultText = result.length > 0 
            ? `Found ${result.length} records in model '${validatedArgs.model}'\n\n${JSON.stringify(result, null, 2)}`
            : `Found 0 records in model '${validatedArgs.model}' (no records match the criteria)`;
            
          return { 
            content: [{ type: 'text', text: resultText }],
            isError: false
          };
        }

        case 'get_record': {
          const validatedArgs = GetRecordSchema.parse(args);
          const kwargs = validatedArgs.fields ? { fields: validatedArgs.fields } : {};
          const result = await client.call(validatedArgs.model, 'read', [validatedArgs.ids], kwargs);
          
          return { 
            content: [{ type: 'text', text: `Retrieved ${result.length} records from model '${validatedArgs.model}'\n\n${JSON.stringify(result, null, 2)}` }],
            isError: false
          };
        }

        case 'list_models': {
          const validatedArgs = ListModelsSchema.parse(args || {});
          const models = await client.call('ir.model', 'search_read', [[]], { 
            fields: ['model', 'name', 'transient'], 
            offset: 0 
          });
          
          // More efficient filtering and sorting
          const filtered = validatedArgs.transient ? models : models.filter((m: any) => !m.transient);
          filtered.sort((a: any, b: any) => a.model.localeCompare(b.model));
          
          const summary = `Found ${filtered.length} available Odoo models${!validatedArgs.transient ? ' (excluding transient models)' : ''}`;
          const modelList = filtered.map((model: any) => `• **${model.model}**: ${model.name}`).join('\n');
          
          return { 
            content: [{ type: 'text', text: `${summary}\n\n${modelList}` }],
            isError: false
          };
        }

        case 'get_model_fields': {
          const validatedArgs = GetModelFieldsSchema.parse(args);
          const kwargs = validatedArgs.fields ? { allfields: validatedArgs.fields } : {};
          const result = await client.call(validatedArgs.model, 'fields_get', [], kwargs);
          
          const fieldCount = Object.keys(result).length;
          
          return { 
            content: [{ type: 'text', text: `Model '${validatedArgs.model}' has ${fieldCount} fields\n\n${JSON.stringify(result, null, 2)}` }],
            isError: false
          };
        }

        default:
          return { 
            content: [{ type: 'text', text: `❌ Unknown tool: ${name}` }],
            isError: true
          };
      }
    } catch (error) {
      const errorMessage = error instanceof z.ZodError 
        ? `❌ Validation Error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        : `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
      return { 
        content: [{ type: 'text', text: errorMessage }],
        isError: true
      };
    }
  });

  return server;
}

async function main(): Promise<void> {
  const server = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Odoo MCP server running on stdio');
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

if (require.main === module) {
  main().catch(console.error);
}
