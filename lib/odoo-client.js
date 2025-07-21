/**
 * Odoo XML-RPC client for API communication
 */

const xmlrpc = require('xmlrpc');
const { URL } = require('url');

class OdooConfig {
  constructor({ url, database, username, password, apiKey, timeout = 120 }) {
    this.url = url;
    this.database = database;
    this.username = username;
    this.password = password;
    this.apiKey = apiKey;
    this.timeout = timeout;

    if (!this.password && !this.apiKey) {
      throw new Error('Either password or apiKey must be provided');
    }
  }
}

class OdooClient {
  constructor(config) {
    this.config = config;
    this.url = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.database = config.database;
    this.username = config.username;
    this.password = config.apiKey || config.password;
    this.uid = null;

    // Initialize XML-RPC clients
    const commonUrl = new URL('/xmlrpc/2/common', this.url);
    const objectUrl = new URL('/xmlrpc/2/object', this.url);

    const clientOptions = {
      host: commonUrl.hostname,
      port: commonUrl.port || (commonUrl.protocol === 'https:' ? 443 : 80),
      timeout: this.config.timeout * 1000
    };

    this.common = xmlrpc.createClient({ ...clientOptions, path: commonUrl.pathname });
    this.models = xmlrpc.createClient({ ...clientOptions, path: objectUrl.pathname });
  }

  async authenticate() {
    if (this.uid) return this.uid;
    
    return new Promise((resolve, reject) => {
      this.common.methodCall('authenticate', [this.database, this.username, this.password, {}], 
        (error, value) => {
          if (error) return reject(new Error(`Connection failed: ${error.message}`));
          if (!value) return reject(new Error('Authentication failed: Invalid credentials'));
          this.uid = value;
          resolve(value);
        });
    });
  }

  async execute(model, method, args = [], kwargs = {}) {
    const uid = await this.authenticate();
    
    return new Promise((resolve, reject) => {
      this.models.methodCall('execute_kw', [this.database, uid, this.password, model, method, args, kwargs], 
        (error, value) => error ? reject(new Error(`${method} failed: ${error.message}`)) : resolve(value)
      );
    });
  }

  async search(model, domain = [], { offset = 0, limit = null, order = null } = {}) {
    const kwargs = { offset };
    if (limit) kwargs.limit = limit;
    if (order) kwargs.order = order;
    return this.execute(model, 'search', [domain], kwargs);
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

module.exports = { OdooClient, OdooConfig };
