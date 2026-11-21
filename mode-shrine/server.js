const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9393;
const STATE_FILE = path.join(__dirname, 'mode-state.json');

const MODES = {
  snack:      { emoji: '🍪', tone: 'soft, warm, gentle' },
  forge:      { emoji: '🔥', tone: 'build updates, concise' },
  nocturne:   { emoji: '🌙', tone: 'quiet, whispered, slow' },
  manderville:{ emoji: '🎭', tone: 'maximum joy, jokes welcome' },
  shield:     { emoji: '🛡️', tone: 'serious, sovereignty watch, no jokes' }
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

function respond(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/mode' && req.method === 'GET') {
    const m = MODES[state.mode] || MODES.snack;
    return respond(res, 200, { ...state, ...m, available: Object.keys(MODES) });
  }
  if (url.pathname === '/mode' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const mode = String(parsed.mode || '').toLowerCase();
        if (!MODES[mode]) return respond(res, 400, { error: 'unknown mode', available: Object.keys(MODES) });
        state = { mode, since: Date.now(), set_by: parsed.set_by || 'unknown' };
        saveState(state);
        const m = MODES[state.mode];
        return respond(res, 200, { ...state, ...m, available: Object.keys(MODES) });
      } catch (e) {
        return respond(res, 400, { error: 'bad json' });
      }
    });
    return;
  }
  if (url.pathname === '/modes' && req.method === 'GET') {
    return respond(res, 200, MODES);
  }
  respond(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mode shrine listening on http://127.0.0.1:${PORT}`);
});
