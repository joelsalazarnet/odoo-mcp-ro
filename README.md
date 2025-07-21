# MCP Server for Odoo

A read-only Model Context Protocol (MCP) server for Odoo ERP integration. Enables AI assistants to safely query and explore Odoo data.

## Available Tools

- **search_records** - Search Odoo records with domain filters
- **get_record** - Get records by ID  
- **list_models** - List available models
- **get_model_fields** - Get model field definitions

## Common Models

- `res.partner` - Customers/contacts
- `sale.order` - Sales orders  
- `product.product` - Products
- `account.move` - Invoices
- `stock.quant` - Inventory

## Installation

### Prerequisites
- **Node.js**: Version 16.0.0 or higher

### Usage

```bash
npx odoo-mcp-ro
```

Or install globally:

```bash
npm install -g odoo-mcp-ro
odoo-mcp-ro
```

## Environment Configuration

Set the following environment variables:

```bash
ODOO_URL=https://your-instance.odoo.com
ODOO_DB=your-database
ODOO_USERNAME=your-email@example.com
ODOO_API_KEY=your-api-key
```

## Claude Desktop Setup

Add to your claude_desktop_config.json file:

```json
{
  "mcpServers": {
    "odoo": {
      "command": "npx",
      "args": ["odoo-mcp-ro"],
      "env": {
        "ODOO_URL": "https://your-instance.odoo.com",
        "ODOO_DB": "your-database",
        "ODOO_USERNAME": "your-email@example.com",
        "ODOO_API_KEY": "your-api-key"
      }
    }
  }
}
```

## License

MIT

Copyright (c) 2025 QR Tools

This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 
International License. To view a copy of this license, visit 
http://creativecommons.org/licenses/by-nc-sa/4.0/ or send a letter to 
Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
```