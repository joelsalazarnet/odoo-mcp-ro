# MCP Server for Odoo

A minimal read-only Model Context Protocol (MCP) server for Odoo ERP integration written in TypeScript. Enables AI assistants to safely query and explore Odoo data.

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
- **Node.js**: Version 20.0.0 or higher
- **npm**: For package management

### Development

```bash
# Clone the repository
git clone <repository-url>
cd odoo-mcp-ro

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode (with TypeScript)
npm run dev

# Run the built version
npm start
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

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0).

You are free to:

- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

Under the following terms:

- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made
- **NonCommercial** — You may not use the material for commercial purposes
- **ShareAlike** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license
- **No additional restrictions** — You may not apply legal terms or technological measures that legally restrict others from doing anything the license permits.

For the full license text, visit: https://creativecommons.org/licenses/by-nc-sa/4.0/

### Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License

Copyright (c) 2025 QR Tools

This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 
International License. To view a copy of this license, visit 
http://creativecommons.org/licenses/by-nc-sa/4.0/ or send a letter to 
Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
```