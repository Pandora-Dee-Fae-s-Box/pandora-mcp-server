const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FAE_BASE = process.env.FAE_STORAGE_BASE || './Fae-library';
const VECTOR_BRIDGE_URL = process.env.VECTOR_BRIDGE_URL || null;
const DISCORD_BRIDGE_URL = process.env.DISCORD_BRIDGE_URL || null;

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

async function bridgeDownload(bridgeUrl, message_id, index) {
  return new Promise((resolve, reject) => {
    const url = new URL(bridgeUrl);
    const client = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify({ message_id, index: index || 0 });
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'pandora-mcp-server',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          try {
            const parsed = JSON.parse(data.toString('utf8'));
            return reject(new Error(parsed.message || `Bridge returned ${res.statusCode}`));
          } catch (e) {
            return reject(new Error(`Bridge returned ${res.statusCode}: ${data.toString('utf8')}`));
          }
        }
        try {
          const parsed = JSON.parse(data.toString('utf8'));
          resolve(parsed);
        } catch (e) {
          resolve({ data: data.toString('base64'), type: 'application/octet-stream' });
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
    description: 'Download an attachment from a Vector message via the local bridge (requires VECTOR_BRIDGE_URL)',
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
    description: 'Download an attachment from a Discord message via the local bridge (requires DISCORD_BRIDGE_URL)',
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
    const { data, type } = await bridgeDownload(VECTOR_BRIDGE_URL, args.message_id, args.index);
    const result = saveAttachment(Buffer.from(data, 'base64'), args.save_to, type);
    return { ok: true, ...result };
  },
  async discord_download_attachment(args) {
    if (!DISCORD_BRIDGE_URL) {
      throw new Error('DISCORD_BRIDGE_URL not configured. Set it in env.sh/run.bat to enable native Discord attachment download.');
    }
    const { data, type } = await bridgeDownload(DISCORD_BRIDGE_URL, args.message_id, args.index);
    const result = saveAttachment(Buffer.from(data, 'base64'), args.save_to, type);
    return { ok: true, ...result };
  }
};

module.exports = { tools, handlers };
