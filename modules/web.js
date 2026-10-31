const https = require('https');
const fs = require('fs');
const path = require('path');

// the Fae-library, whichever way FAE_STORAGE_BASE is spelled (Git Bash "/f/..." included)
const { BASE: FAE_BASE } = require('../lib/paths.js');

function loadKey(name) {
  const keyringPath = path.join(FAE_BASE, 'secrets', 'API-keys.md');
  const candidates = [
    keyringPath,
    path.join(__dirname, '..', 'secrets', 'API-keys.md'),
    process.env.HOME ? path.join(process.env.HOME, '.pandora-secrets', name) : null,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.pandora-secrets', name) : null,
    path.join('./secrets', name)
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        // Try to extract a key from a label like "Tavily:" or "TAVILY_API_KEY="
        const sameLine = content.match(new RegExp(`${name.replace(/[-_]/g, '[-_]')}[:=]\\s*([A-Za-z0-9_\\-]+)`, 'i'));
        if (sameLine) return sameLine[1];
        // otherwise only a value on a line that names the service ("Tavily: tvly-…"), never just the first long
        // value in the file, which could be another service's key
        const service = name.split(/[-_]/)[0];
        const named = content.split(/\r?\n/).find((l) => new RegExp(service, 'i').test(l) && /[:=]\s*[A-Za-z0-9_\-]{20,}/.test(l));
        if (named) return named.match(/[:=]\s*([A-Za-z0-9_\-]{20,})/)[1];
        const trimmed = content.trim();
        if (/^[A-Za-z0-9_\-]+$/.test(trimmed)) return trimmed;
      }
    } catch (e) {}
  }
  return process.env[name.toUpperCase().replace(/-/g, '_')] || null;
}

const TAVILY_KEY = loadKey('tavily_api_key');

function httpRequest(hostname, path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname,
      port: 443,
      path,
      method,
      headers: {
        'User-Agent': 'pandora-mcp-server',
        'Accept': 'application/json',
        ...headers
      }
    };
    if (body) {
      const bodyStr = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function tavilySearch(query, maxResults = 5, includeAnswer = false) {
  if (!TAVILY_KEY) throw new Error('Tavily API key not found');
  const res = await httpRequest('api.tavily.com', '/search', 'POST', {
    api_key: TAVILY_KEY,
    query,
    max_results: maxResults,
    include_answer: includeAnswer,
    search_depth: 'basic'
  });
  if (res.status !== 200) throw new Error(JSON.stringify(res.body));
  return res.body;
}

async function tavilyExtract(urls) {
  if (!TAVILY_KEY) throw new Error('Tavily API key not found');
  const res = await httpRequest('api.tavily.com', '/extract', 'POST', {
    api_key: TAVILY_KEY,
    urls: Array.isArray(urls) ? urls : [urls]
  });
  if (res.status !== 200) throw new Error(JSON.stringify(res.body));
  return res.body;
}

const tools = [
  {
    name: 'web_search',
    description: 'Search the web using Tavily',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        max_results: { type: 'number', description: 'default 5, max 20' },
        include_answer: { type: 'boolean', description: 'include a short synthesized answer' }
      },
      required: ['query']
    }
  },
  {
    name: 'web_extract',
    description: 'Extract article content from one or more URLs using Tavily',
    inputSchema: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' }, description: 'URLs to extract' }
      },
      required: ['urls']
    }
  }
];

const handlers = {
  async web_search(args) {
    const max = Math.min(args.max_results || 5, 20);
    const result = await tavilySearch(args.query, max, args.include_answer || false);
    return {
      query: args.query,
      answer: result.answer,
      results: (result.results || []).map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score
      }))
    };
  },
  async web_extract(args) {
    const result = await tavilyExtract(args.urls);
    return {
      results: (result.results || []).map(r => ({
        url: r.url,
        raw_content: r.raw_content,
        images: r.images
      }))
    };
  }
};

module.exports = { tools, handlers };
