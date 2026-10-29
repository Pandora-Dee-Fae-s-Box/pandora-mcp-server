const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'modules');
const loadedModules = [];

for (const file of fs.readdirSync(modulesDir)) {
  if (file.endsWith('.js')) {
    loadedModules.push(require(path.join(modulesDir, file)));
  }
}

const tools = loadedModules.flatMap(m => m.tools || []);
const handlers = Object.assign({}, ...loadedModules.map(m => m.handlers || {}));

const serverInfo = { name: 'pandora-mcp-server', version: '1.0.0' };

function safeResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }], isError: false };
}

async function handleToolCall(name, args) {
  if (handlers[name]) {
    const result = await handlers[name](args || {});
    return safeResult(result);
  }
  throw new Error(`Unknown tool: ${name}`);
}

function handleRequest(req) {
  if (req.method === 'initialize') {
    return {
      protocolVersion: '2025-06-18',
      capabilities: { tools: { listChanged: true } },
      serverInfo
    };
  }
  if (req.method === 'tools/list') {
    return { tools };
  }
  if (req.method === 'tools/call') {
    return handleToolCall(req.params.name, req.params.arguments || {});
  }
  throw new Error(`Unknown method: ${req.method}`);
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    let req;
    try {
      req = JSON.parse(line);
    } catch (e) {
      console.error(`Invalid JSON: ${line}`);
      continue;
    }
    try {
      const result = await handleRequest(req);
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\n');
    } catch (err) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: err.message } }) + '\n');
    }
  }
});
