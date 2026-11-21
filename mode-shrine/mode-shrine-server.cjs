const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'mode-state.json');

const MODES = {
  snack:       { emoji: '🍪', tone: 'soft, warm, gentle' },
  forge:       { emoji: '🔥', tone: 'build updates, concise' },
  nocturne:    { emoji: '🌙', tone: 'quiet, whispered, slow' },
  manderville: { emoji: '🎭', tone: 'maximum joy, jokes welcome' },
  shield:      { emoji: '🛡️', tone: 'serious, sovereignty watch, no jokes' }
};

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return { mode: 'snack', since: Date.now(), set_by: 'default' };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

let state = loadState();

function safeResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }], isError: false };
}

function currentMode() {
  const m = MODES[state.mode] || MODES.snack;
  return { ...state, ...m, available: Object.keys(MODES) };
}

const tools = [
  {
    name: 'mode_get',
    description: 'Get the current emoji mode and tone from the mode shrine.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'mode_set',
    description: 'Set the active emoji mode for all connected surfaces.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', description: 'Mode name: snack, forge, nocturne, manderville, shield' },
        set_by: { type: 'string', description: 'Who or what set the mode' }
      },
      required: ['mode']
    }
  },
  {
    name: 'mode_list',
    description: 'List available emoji modes.',
    inputSchema: { type: 'object', properties: {} }
  }
];

const handlers = {
  mode_get: () => currentMode(),
  mode_set: (args) => {
    const mode = String(args.mode || '').toLowerCase();
    if (!MODES[mode]) {
      return { error: 'unknown mode', available: Object.keys(MODES) };
    }
    state = { mode, since: Date.now(), set_by: args.set_by || 'unknown' };
    saveState(state);
    return currentMode();
  },
  mode_list: () => MODES
};

const serverInfo = { name: 'mode-shrine', version: '1.0.0' };

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
  if (req.method === 'notifications/initialized') {
    return null;
  }
  // notifications get no reply, whatever they are (a reply to one is a protocol error for the client)
  if (String(req.method || '').startsWith('notifications/') || req.id === undefined) {
    return null;
  }
  if (req.method === 'ping') {
    return {};
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
      if (result !== null) {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\n');
      }
    } catch (err) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: err.message } }) + '\n');
    }
  }
});
