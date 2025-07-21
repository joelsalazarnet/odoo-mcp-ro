#!/usr/bin/env node

const { OdooMcpServer } = require('../lib/server.js');

async function main() {
  const server = new OdooMcpServer();
  await server.run();
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

if (require.main === module) main().catch(console.error);
