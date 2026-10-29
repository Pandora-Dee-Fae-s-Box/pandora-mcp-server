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

async function resolveUserId(username) {
  const res = await githubRequest(`/users/${encodeURIComponent(username)}`);
  if (res.status !== 200) throw new Error(`Could not resolve user ${username}: ${JSON.stringify(res.body)}`);
  return res.body.id;
}

function paginatedTool(name, description, required, extra = {}) {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        ...extra,
        limit: { type: 'number', description: 'max results, default 30' },
        page: { type: 'number', description: 'page number, default 1' }
      },
      required
    }
  };
}

const tools = [
  // Repository contents and git
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
    name: 'github_delete_file',
    description: 'Delete a file in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        path: { type: 'string' },
        message: { type: 'string', description: 'commit message' },
        branch: { type: 'string', description: 'default main' }
      },
      required: ['repo', 'path', 'message']
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
  },

  // Org repos
  paginatedTool('github_list_org_repos', 'List repositories in a GitHub organization', ['org']),
  {
    name: 'github_create_repo',
    description: 'Create a new repository in a GitHub organization',
    inputSchema: {
      type: 'object',
      properties: {
        org: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        private: { type: 'boolean', description: 'default true' },
        readme: { type: 'boolean', description: 'initialize with README, default false' }
      },
      required: ['org', 'name']
    }
  },
  {
    name: 'github_update_repo',
    description: 'Update repository settings',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        description: { type: 'string' },
        private: { type: 'boolean' },
        default_branch: { type: 'string' },
        topics: { type: 'array', items: { type: 'string' } }
      },
      required: ['repo']
    }
  },
  {
    name: 'github_delete_repo',
    description: 'Delete a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' }
      },
      required: ['repo']
    }
  },

  // Org members and teams
  paginatedTool('github_list_org_members', 'List members of a GitHub organization', ['org']),
  paginatedTool('github_list_org_invitations', 'List pending invitations to a GitHub organization', ['org']),
  {
    name: 'github_invite_org_member',
    description: 'Invite a GitHub user to an organization by username',
    inputSchema: {
      type: 'object',
      properties: {
        org: { type: 'string' },
        username: { type: 'string' },
        role: { type: 'string', description: 'admin, direct_member, or billing_manager, default direct_member' },
        team_ids: { type: 'array', items: { type: 'number' }, description: 'optional team IDs to add them to' }
      },
      required: ['org', 'username']
    }
  },
  {
    name: 'github_remove_org_member',
    description: 'Remove a member from a GitHub organization',
    inputSchema: {
      type: 'object',
      properties: {
        org: { type: 'string' },
        username: { type: 'string' }
      },
      required: ['org', 'username']
    }
  },
  paginatedTool('github_list_teams', 'List teams in a GitHub organization', ['org']),
  {
    name: 'github_create_team',
    description: 'Create a team in a GitHub organization',
    inputSchema: {
      type: 'object',
      properties: {
        org: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        privacy: { type: 'string', description: 'secret or closed, default closed' },
        maintainers: { type: 'array', items: { type: 'string' } }
      },
      required: ['org', 'name']
    }
  },
  {
    name: 'github_add_team_member',
    description: 'Add a member to a team by username',
    inputSchema: {
      type: 'object',
      properties: {
        org: { type: 'string' },
        team_slug: { type: 'string' },
        username: { type: 'string' },
        role: { type: 'string', description: 'member or maintainer, default member' }
      },
      required: ['org', 'team_slug', 'username']
    }
  },

  // Repo secrets and variables
  {
    name: 'github_list_repo_secrets',
    description: 'List secrets in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' }
      },
      required: ['repo']
    }
  },
  {
    name: 'github_list_repo_variables',
    description: 'List variables in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' }
      },
      required: ['repo']
    }
  },
  {
    name: 'github_create_repo_variable',
    description: 'Create or update a repository variable',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        name: { type: 'string' },
        value: { type: 'string' }
      },
      required: ['repo', 'name', 'value']
    }
  },

  // Actions
  {
    name: 'github_list_workflow_runs',
    description: 'List workflow runs for a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        workflow_id: { type: 'string', description: 'optional workflow filename or ID' },
        branch: { type: 'string' },
        limit: { type: 'number', description: 'max results, default 10' }
      },
      required: ['repo']
    }
  },

  // Security
  {
    name: 'github_list_dependabot_alerts',
    description: 'List Dependabot alerts for a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        state: { type: 'string', description: 'open/dismissed/fixed, default open' },
        limit: { type: 'number', description: 'max results, default 10' }
      },
      required: ['repo']
    }
  },
  {
    name: 'github_list_secret_scanning_alerts',
    description: 'List secret scanning alerts for a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        state: { type: 'string', description: 'open/resolved, default open' },
        limit: { type: 'number', description: 'max results, default 10' }
      },
      required: ['repo']
    }
  },

  // Webhooks
  {
    name: 'github_list_repo_webhooks',
    description: 'List webhooks in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' }
      },
      required: ['repo']
    }
  },
  {
    name: 'github_create_repo_webhook',
    description: 'Create a webhook in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        config: { type: 'object', description: '{url, content_type, secret, insecure_ssl}' },
        events: { type: 'array', items: { type: 'string' }, description: 'default [push]' },
        active: { type: 'boolean', description: 'default true' }
      },
      required: ['repo', 'config']
    }
  }
];

const handlers = {
  // Contents
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
  async github_delete_file(args) {
    const { owner, name } = parseRepo(args.repo);
    const branch = args.branch || 'main';
    const sha = await getFileSha(owner, name, args.path, branch);
    if (!sha) throw new Error('File not found');
    const res = await githubRequest(`/repos/${owner}/${name}/contents/${encodeURIComponent(args.path)}`, 'DELETE', {
      message: args.message,
      sha,
      branch
    });
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return { ok: true };
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
  },

  // Org repos
  async github_list_org_repos(args) {
    const limit = args.limit || 30;
    const page = args.page || 1;
    const res = await githubRequest(`/orgs/${encodeURIComponent(args.org)}/repos?per_page=${limit}&page=${page}`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.map(r => ({ name: r.name, full_name: r.full_name, private: r.private, url: r.html_url }));
  },
  async github_create_repo(args) {
    const body = {
      name: args.name,
      description: args.description || '',
      private: args.private !== false,
      auto_init: args.readme === true
    };
    const res = await githubRequest(`/orgs/${encodeURIComponent(args.org)}/repos`, 'POST', body);
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    return { ok: true, name: res.body.name, url: res.body.html_url, full_name: res.body.full_name };
  },
  async github_update_repo(args) {
    const { owner, name } = parseRepo(args.repo);
    const body = {};
    if (args.description !== undefined) body.description = args.description;
    if (args.private !== undefined) body.private = args.private;
    if (args.default_branch !== undefined) body.default_branch = args.default_branch;
    if (args.topics !== undefined) body.topics = args.topics;
    const res = await githubRequest(`/repos/${owner}/${name}`, 'PATCH', body);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return { ok: true, name: res.body.name, url: res.body.html_url };
  },
  async github_delete_repo(args) {
    const { owner, name } = parseRepo(args.repo);
    const res = await githubRequest(`/repos/${owner}/${name}`, 'DELETE');
    if (res.status !== 204) throw new Error(JSON.stringify(res.body));
    return { ok: true };
  },

  // Org members and teams
  async github_list_org_members(args) {
    const limit = args.limit || 30;
    const page = args.page || 1;
    const res = await githubRequest(`/orgs/${encodeURIComponent(args.org)}/members?per_page=${limit}&page=${page}`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.map(m => ({ username: m.login, id: m.id, url: m.html_url }));
  },
  async github_list_org_invitations(args) {
    const limit = args.limit || 30;
    const page = args.page || 1;
    const res = await githubRequest(`/orgs/${encodeURIComponent(args.org)}/invitations?per_page=${limit}&page=${page}`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.map(i => ({ id: i.id, login: i.login, email: i.email, role: i.role, created_at: i.created_at }));
  },
  async github_invite_org_member(args) {
    const userId = await resolveUserId(args.username);
    const res = await githubRequest(`/orgs/${encodeURIComponent(args.org)}/invitations`, 'POST', {
      invitee_id: userId,
      role: args.role || 'direct_member',
      team_ids: args.team_ids || []
    });
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    return { ok: true, id: res.body.id, login: res.body.login, email: res.body.email };
  },
  async github_remove_org_member(args) {
    const res = await githubRequest(`/orgs/${encodeURIComponent(args.org)}/members/${encodeURIComponent(args.username)}`, 'DELETE');
    if (res.status !== 204) throw new Error(JSON.stringify(res.body));
    return { ok: true };
  },
  async github_list_teams(args) {
    const limit = args.limit || 30;
    const page = args.page || 1;
    const res = await githubRequest(`/orgs/${encodeURIComponent(args.org)}/teams?per_page=${limit}&page=${page}`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.map(t => ({ name: t.name, slug: t.slug, description: t.description, privacy: t.privacy, url: t.html_url }));
  },
  async github_create_team(args) {
    const body = {
      name: args.name,
      description: args.description || '',
      privacy: args.privacy || 'closed',
      maintainers: args.maintainers || []
    };
    const res = await githubRequest(`/orgs/${encodeURIComponent(args.org)}/teams`, 'POST', body);
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    return { ok: true, name: res.body.name, slug: res.body.slug, url: res.body.html_url };
  },
  async github_add_team_member(args) {
    const res = await githubRequest(`/orgs/${encodeURIComponent(args.org)}/teams/${encodeURIComponent(args.team_slug)}/memberships/${encodeURIComponent(args.username)}`, 'PUT', {
      role: args.role || 'member'
    });
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return { ok: true, state: res.body.state, role: res.body.role };
  },

  // Secrets and variables
  async github_list_repo_secrets(args) {
    const { owner, name } = parseRepo(args.repo);
    const res = await githubRequest(`/repos/${owner}/${name}/actions/secrets`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.secrets.map(s => ({ name: s.name, created_at: s.created_at, updated_at: s.updated_at }));
  },
  async github_list_repo_variables(args) {
    const { owner, name } = parseRepo(args.repo);
    const res = await githubRequest(`/repos/${owner}/${name}/actions/variables`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.variables.map(v => ({ name: v.name, value: v.value, created_at: v.created_at, updated_at: v.updated_at }));
  },
  async github_create_repo_variable(args) {
    const { owner, name } = parseRepo(args.repo);
    const res = await githubRequest(`/repos/${owner}/${name}/actions/variables`, 'POST', {
      name: args.name,
      value: args.value
    });
    if (res.status !== 201) {
      const upd = await githubRequest(`/repos/${owner}/${name}/actions/variables/${encodeURIComponent(args.name)}`, 'PATCH', {
        name: args.name,
        value: args.value
      });
      if (upd.status !== 204) throw new Error(JSON.stringify(upd.body));
    }
    return { ok: true };
  },

  // Actions
  async github_list_workflow_runs(args) {
    const { owner, name } = parseRepo(args.repo);
    const limit = args.limit || 10;
    let path = `/repos/${owner}/${name}/actions/runs?per_page=${limit}`;
    if (args.workflow_id) path = `/repos/${owner}/${name}/actions/workflows/${encodeURIComponent(args.workflow_id)}/runs?per_page=${limit}`;
    if (args.branch) path += `&branch=${encodeURIComponent(args.branch)}`;
    const res = await githubRequest(path);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.workflow_runs.map(r => ({ id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, branch: r.head_branch, url: r.html_url }));
  },

  // Security
  async github_list_dependabot_alerts(args) {
    const { owner, name } = parseRepo(args.repo);
    const state = args.state || 'open';
    const limit = args.limit || 10;
    const res = await githubRequest(`/repos/${owner}/${name}/dependabot/alerts?state=${state}&per_page=${limit}`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.map(a => ({ number: a.number, state: a.state, severity: a.security_advisory.severity, summary: a.security_advisory.summary, url: a.html_url }));
  },
  async github_list_secret_scanning_alerts(args) {
    const { owner, name } = parseRepo(args.repo);
    const state = args.state || 'open';
    const limit = args.limit || 10;
    const res = await githubRequest(`/repos/${owner}/${name}/secret-scanning/alerts?state=${state}&per_page=${limit}`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.map(a => ({ number: a.number, state: a.state, secret_type: a.secret_type, resolution: a.resolution, url: a.html_url }));
  },

  // Webhooks
  async github_list_repo_webhooks(args) {
    const { owner, name } = parseRepo(args.repo);
    const res = await githubRequest(`/repos/${owner}/${name}/hooks`);
    if (res.status !== 200) throw new Error(JSON.stringify(res.body));
    return res.body.map(h => ({ id: h.id, url: h.config.url, events: h.events, active: h.active }));
  },
  async github_create_repo_webhook(args) {
    const { owner, name } = parseRepo(args.repo);
    const body = {
      config: args.config,
      events: args.events || ['push'],
      active: args.active !== false
    };
    const res = await githubRequest(`/repos/${owner}/${name}/hooks`, 'POST', body);
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    return { ok: true, id: res.body.id, url: res.body.config.url };
  }
};

module.exports = { tools, handlers };
