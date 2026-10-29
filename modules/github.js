const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const TOKEN = process.env.GITHUB_TOKEN;
const APP_ID = process.env.GITHUB_APP_ID;
const INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID;
const PRIVATE_KEY_PATH = process.env.GITHUB_PRIVATE_KEY_PATH || './secrets/github_app_private_key.pem';
const PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY;

const API_BASE = 'api.github.com';

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function loadPrivateKey() {
  if (PRIVATE_KEY) return PRIVATE_KEY;
  const candidates = [
    PRIVATE_KEY_PATH,
    process.env.HOME ? `${process.env.HOME}/.pandora-secrets/github_app_private_key.pem` : null,
    process.env.USERPROFILE ? `${process.env.USERPROFILE}/.pandora-secrets/github_app_private_key.pem` : null,
    './secrets/github_app_private_key.pem'
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    } catch (e) {}
  }
  return null;
}

function makeJwt() {
  const key = loadPrivateKey();
  if (!key) throw new Error('GitHub App auth requested but private key not found');
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ iat: now - 60, exp: now + 600, iss: APP_ID }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(key, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${payload}.${signature}`;
}

async function getInstallationToken() {
  if (!INSTALLATION_ID) throw new Error('GITHUB_INSTALLATION_ID not set');
  const jwt = makeJwt();
  const res = await githubRequest(`/app/installations/${INSTALLATION_ID}/access_tokens`, 'POST', null, `Bearer ${jwt}`);
  if (res.status !== 201) throw new Error(`Failed to get installation token: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

let cachedToken = null;
let cachedExpiry = 0;

async function getAuthHeader() {
  if (APP_ID) {
    if (!cachedToken || Date.now() > cachedExpiry - 60000) {
      cachedToken = await getInstallationToken();
      cachedExpiry = Date.now() + (60 * 60 * 1000);
    }
    return `Bearer ${cachedToken}`;
  }
  if (TOKEN) return `Bearer ${TOKEN}`;
  throw new Error('No GitHub auth configured. Set GITHUB_TOKEN or GITHUB_APP_ID + GITHUB_INSTALLATION_ID + private key.');
}

async function githubRequest(path, method = 'GET', body = null, authOverride = null) {
  const auth = authOverride || await getAuthHeader();
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: API_BASE,
      port: 443,
      path,
      method,
      headers: {
        'User-Agent': 'pandora-mcp-server',
        'Authorization': auth,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
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
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
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

function parseRepo(repo) {
  const parts = repo.split('/');
  if (parts.length !== 2) throw new Error('repo must be owner/name');
  return { owner: parts[0], name: parts[1] };
}

async function getFileSha(owner, repo, path, ref = 'main') {
  try {
    const res = await githubRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`);
    return res.status === 200 ? res.body.sha : null;
  } catch (e) {
    return null;
  }
}

const tools = [
  {
    name: 'github_read_repo',
    description: 'List files and directories in a GitHub repository path',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        path: { type: 'string', description: 'path within repo, default root' },
        ref: { type: 'string', description: 'branch/tag, default main' }
      },
      required: ['repo']
    }
  },
  {
    name: 'github_read_file',
    description: 'Read a file from a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        path: { type: 'string' },
        ref: { type: 'string', description: 'branch/tag, default main' }
      },
      required: ['repo', 'path']
    }
  },
  {
    name: 'github_write_file',
    description: 'Create or update a file in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        path: { type: 'string' },
        content: { type: 'string', description: 'file content' },
        message: { type: 'string', description: 'commit message' },
        branch: { type: 'string', description: 'branch to commit to, default main' }
      },
      required: ['repo', 'path', 'content', 'message']
    }
  },
  {
    name: 'github_create_branch',
    description: 'Create a new branch from an existing ref',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        new_branch: { type: 'string' },
        from_branch: { type: 'string', description: 'default main' }
      },
      required: ['repo', 'new_branch']
    }
  },
  {
    name: 'github_create_pr',
    description: 'Create a pull request',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        title: { type: 'string' },
        body: { type: 'string' },
        head: { type: 'string', description: 'branch with changes' },
        base: { type: 'string', description: 'default main' }
      },
      required: ['repo', 'title', 'head']
    }
  },
  {
    name: 'github_list_issues',
    description: 'List issues in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        state: { type: 'string', description: 'open/closed/all, default open' },
        limit: { type: 'number', description: 'max results, default 10' }
      }
    }
  },
  {
    name: 'github_create_issue',
    description: 'Create an issue in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        title: { type: 'string' },
        body: { type: 'string' }
      },
      required: ['repo', 'title']
    }
  }
];

const handlers = {
  async github_read_repo(args) {
    const { owner, name } = parseRepo(args.repo);
    const path = args.path || '';
    const ref = args.ref || 'main';
    const res = await githubRequest(`/repos/${owner}/${name}/contents/${encodeURIComponent(path)}?ref=${ref}`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    const items = Array.isArray(res.body) ? res.body : [res.body];
    return items.map(i => ({ name: i.name, type: i.type, path: i.path, sha: i.sha }));
  },
  async github_read_file(args) {
    const { owner, name } = parseRepo(args.repo);
    const res = await githubRequest(`/repos/${owner}/${name}/contents/${encodeURIComponent(args.path)}?ref=${args.ref || 'main'}`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    const content = Buffer.from(res.body.content, 'base64').toString('utf8');
    return { path: res.body.path, sha: res.body.sha, content };
  },
  async github_write_file(args) {
    const { owner, name } = parseRepo(args.repo);
    const branch = args.branch || 'main';
    const sha = await getFileSha(owner, name, args.path, branch);
    const body = {
      message: args.message,
      content: Buffer.from(args.content, 'utf8').toString('base64'),
      branch
    };
    if (sha) body.sha = sha;
    const res = await githubRequest(`/repos/${owner}/${name}/contents/${encodeURIComponent(args.path)}`, 'PUT', body);
    if (res.status !== 200 && res.status !== 201) throw new Error(JSON.stringify(res.body));
    return { ok: true, commit: res.body.commit?.sha, content: res.body.content?.sha };
  },
  async github_create_branch(args) {
    const { owner, name } = parseRepo(args.repo);
    const from = args.from_branch || 'main';
    const refRes = await githubRequest(`/repos/${owner}/${name}/git/ref/heads/${from}`);
    if (refRes.status !== 200) throw new Error(JSON.stringify(refRes.body));
    const sha = refRes.body.object.sha;
    const res = await githubRequest(`/repos/${owner}/${name}/git/refs`, 'POST', {
      ref: `refs/heads/${args.new_branch}`,
      sha
    });
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    return { ok: true, branch: args.new_branch, sha: res.body.object.sha };
  },
  async github_create_pr(args) {
    const { owner, name } = parseRepo(args.repo);
    const res = await githubRequest(`/repos/${owner}/${name}/pulls`, 'POST', {
      title: args.title,
      body: args.body || '',
      head: args.head,
      base: args.base || 'main'
    });
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    return { ok: true, number: res.body.number, url: res.body.html_url };
  },
  async github_list_issues(args) {
    const { owner, name } = parseRepo(args.repo);
    const state = args.state || 'open';
    const limit = args.limit || 10;
    const res = await githubRequest(`/repos/${owner}/${name}/issues?state=${state}&per_page=${limit}`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.map(i => ({ number: i.number, title: i.title, state: i.state, url: i.html_url }));
  },
  async github_create_issue(args) {
    const { owner, name } = parseRepo(args.repo);
    const res = await githubRequest(`/repos/${owner}/${name}/issues`, 'POST', {
      title: args.title,
      body: args.body || ''
    });
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    return { ok: true, number: res.body.number, url: res.body.html_url };
  }
};

module.exports = { tools, handlers };
