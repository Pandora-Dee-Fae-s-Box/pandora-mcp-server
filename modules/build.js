// Build tools: npm in a folder of the Fae-library (her pandora-mcp copy, a project she's building).
//
// npm is run through the same Node that runs this server (npm-cli.js beside it), never looked up on PATH, so a
// broken or missing PATH can't take it away. The folder has to be inside the Fae-library. Publishing, logging in
// and changing npm's own settings aren't offered: those stay with a human.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { safePath, shown } = require('../lib/paths.js');

const ALLOWED = new Set(['install', 'i', 'ci', 'uninstall', 'update', 'run', 'run-script', 'test', 't', 'start', 'ls', 'list', 'outdated', 'audit', 'pack', 'view', 'version', 'init', 'explain', 'prune', 'dedupe', 'rebuild']);
const OUTPUT_MAX = 12000;

/** npm's own script, next to this Node (Windows: <node dir>/node_modules/npm; macOS/Linux: <prefix>/lib/node_modules/npm). */
function npmCli() {
  const dir = path.dirname(process.execPath);
  for (const p of [path.join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), path.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** This environment with Node's own folder first on the PATH (whatever the key is spelled), so scripts that call
 *  node or npx find the same ones. */
function envWithNode() {
  const env = { ...process.env };
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
  env[key] = [path.dirname(process.execPath), env[key] || ''].filter(Boolean).join(path.delimiter);
  return env;
}

function run(args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const cli = npmCli();
    if (!cli) return resolve({ ok: false, error: `npm wasn't found next to Node (${shown(process.execPath)}). Reinstall Node, or switch to a version that has npm (nvm use …).` });
    const started = Date.now();
    let out = '';
    const keep = (d) => {
      out += d.toString();
      if (out.length > OUTPUT_MAX * 4) out = out.slice(-OUTPUT_MAX * 2);
    };
    const child = spawn(process.execPath, [cli, ...args], { cwd, env: envWithNode(), windowsHide: true });
    const timer = setTimeout(() => {
      out += `\n[stopped: still running after ${Math.round(timeoutMs / 1000)} s]`;
      child.kill();
    }, timeoutMs);
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('error', (e) => keep(`\n[could not start: ${e.message}]`));
    child.on('close', (code) => {
      clearTimeout(timer);
      const trimmed = out.length > OUTPUT_MAX ? '…' + out.slice(-OUTPUT_MAX) : out;
      resolve({ ok: code === 0, exit_code: code, seconds: Math.round((Date.now() - started) / 100) / 10, dir: shown(cwd), command: `npm ${args.join(' ')}`, output: trimmed });
    });
  });
}

const tools = [
  {
    name: 'npm_run',
    description: 'Run npm in a folder inside the Fae-library, e.g. ["install"], ["ci"], ["run", "build"], ["test"], ["ls", "--depth=0"]. Uses the npm that belongs to the Node running this server, so it works even when PATH is broken. publish, login and config changes are not available.',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'folder inside the Fae-library (relative, or a full path this server gave back)' },
        args: { type: 'array', items: { type: 'string' }, description: 'npm arguments, first one the command' },
        timeout_seconds: { type: 'number', description: 'default 600, at most 1800' }
      },
      required: ['dir', 'args']
    }
  },
  {
    name: 'build_tools_status',
    description: 'Which Node and npm this server uses, where they are, and what PATH it sees: for checking build tools are reachable.',
    inputSchema: { type: 'object', properties: {} }
  }
];

const handlers = {
  async npm_run(args) {
    const list = Array.isArray(args.args) ? args.args.map(String) : [];
    if (!list.length) throw new Error('Which npm command? e.g. ["install"] or ["run", "build"].');
    if (!ALLOWED.has(list[0])) throw new Error(`npm ${list[0]} isn't offered here (${[...ALLOWED].join(', ')}).`);
    const dir = safePath(args.dir);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`No such folder: ${shown(dir)}`);
    const seconds = Math.max(10, Math.min(1800, Number(args.timeout_seconds) || 600));
    return run(list, dir, seconds * 1000);
  },
  async build_tools_status() {
    const cli = npmCli();
    const npm = cli ? await run(['--version'], process.cwd(), 30000) : null;
    const key = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH');
    return {
      node: { version: process.version, path: shown(process.execPath) },
      npm: cli ? { version: (npm.output || '').trim(), cli: shown(cli) } : { error: 'not found next to Node' },
      path_entries: (process.env[key] || '').split(path.delimiter).filter(Boolean)
    };
  }
};

module.exports = { tools, handlers };
