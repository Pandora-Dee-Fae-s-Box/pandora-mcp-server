const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FAE_BASE = process.env.FAE_STORAGE_BASE || './Fae-library';
const VECTOR_BRIDGE_URL = process.env.VECTOR_BRIDGE_URL || null;
const DISCORD_BRIDGE_URL = process.env.DISCORD_BRIDGE_URL || null;
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || process.env.JADE_BRIDGE_TOKEN || null;

function safePath(p) {
  const normalized = path.normalize(p || '.').replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.resolve(path.join(FAE_BASE, normalized));
  const baseResolved = path.resolve(FAE_BASE);
  if (!full.toLowerCase().startsWith(baseResolved.toLowerCase())) {
    throw new Error('Path outside allowed folder');
  }
  return full;
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'pandora-mcp-server' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        data: Buffer.concat(chunks),
        type: res.headers['content-type'] || 'application/octet-stream'
      }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => reject(new Error('Request timeout')));
  });
}

function mcpBridgeCall(bridgeUrl, toolName, arguments) {
  return new Promise((resolve, reject) => {
    if (!BRIDGE_TOKEN) {
      return reject(new Error('BRIDGE_TOKEN not configured. Set BRIDGE_TOKEN or JADE_BRIDGE_TOKEN.'));
    }
    const url = new URL(bridgeUrl);
    const client = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'dl1',
      method: 'tools/call',
      params: { name: toolName, arguments: arguments || {} }
    });
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'pandora-mcp-server',
        'Authorization': `Bearer ${BRIDGE_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          return reject(new Error(`Bridge returned ${res.statusCode}: ${data.toString('utf8')}`));
        }
        try {
          const parsed = JSON.parse(data.toString('utf8'));
          const result = parsed.result || parsed;
          if (result.isError) {
            const text = (result.content || []).map(c => c.text).join('\n');
            return reject(new Error(text || 'Bridge tool error'));
          }
          const text = (result.content || []).map(c => c.text).join('\n');
          try {
            const inner = JSON.parse(text);
            resolve(inner);
          } catch (e) {
            resolve({ data: text, type: 'application/octet-stream' });
          }
        } catch (e) {
          reject(new Error(`Could not parse bridge response: ${data.toString('utf8')}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function saveAttachment(data, saveTo, originalType) {
  const target = safePath(saveTo);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  return { path: target, size: data.length, type: originalType };
}

const tools = [
  {
    name: 'download_url',
    description: 'Download a file from a public URL and save it to Fae-library',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'HTTP(S) URL to download' },
        save_to: { type: 'string', description: 'relative path inside Fae-library, e.g. attachments/2026-10-29/chibi.png' }
      },
      required: ['url', 'save_to']
    }
  },
  {
    name: 'vector_download_attachment',
    description: 'Download an attachment from a Vector message via the Jade Vector bridge (requires VECTOR_BRIDGE_URL and BRIDGE_TOKEN)',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string' },
        index: { type: 'number', description: 'attachment index, default 0' },
        save_to: { type: 'string', description: 'relative path inside Fae-library' }
      },
      required: ['message_id', 'save_to']
    }
  },
  {
    name: 'discord_download_attachment',
    description: 'Download an attachment from a Discord message via the Jade Discord bridge (requires DISCORD_BRIDGE_URL and BRIDGE_TOKEN)',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string' },
        index: { type: 'number', description: 'attachment index, default 0' },
        save_to: { type: 'string', description: 'relative path inside Fae-library' }
      },
      required: ['message_id', 'save_to']
    }
  }
];

const handlers = {
  async download_url(args) {
    const { data, type } = await fetchUrl(args.url);
    const result = saveAttachment(data, args.save_to, type);
    return { ok: true, ...result };
  },
  async vector_download_attachment(args) {
    if (!VECTOR_BRIDGE_URL) {
      throw new Error('VECTOR_BRIDGE_URL not configured. Set it in env.sh/run.bat to enable native Vector attachment download.');
    }
    const inner = await mcpBridgeCall(VECTOR_BRIDGE_URL, 'download_attachment', {
      message_id: args.message_id,
      index: args.index || 0
    });
    const data = Buffer.from(inner.base64 || inner.data, 'base64');
    const result = saveAttachment(data, args.save_to, inner.content_type || inner.type || 'application/octet-stream');
    return { ok: true, name: inner.name || inner.filename, ...result };
  },
  async discord_download_attachment(args) {
    if (!DISCORD_BRIDGE_URL) {
      throw new Error('DISCORD_BRIDGE_URL not configured. Set it in env.sh/run.bat to enable native Discord attachment download.');
    }
    const inner = await mcpBridgeCall(DISCORD_BRIDGE_URL, 'download_attachment', {
      message_id: args.message_id,
      index: args.index || 0
    });
    const data = Buffer.from(inner.base64 || inner.data, 'base64');
    const result = saveAttachment(data, args.save_to, inner.content_type || inner.type || 'application/octet-stream');
    return { ok: true, name: inner.name || inner.filename, ...result };
  }
};

module.exports = { tools, handlers };
