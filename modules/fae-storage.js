const fs = require('fs');
const path = require('path');

// Configurable base path so the repo stays generic.
// On Windows/Git Bash, set FAE_STORAGE_BASE=F:\PDA-SEASIDE\Fae-library
// On macOS/Linux, set FAE_STORAGE_BASE=/home/user/Fae-library
const BASE = process.env.FAE_STORAGE_BASE || './Fae-library';

function safePath(p) {
  const normalized = path.normalize(p || '.').replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.resolve(path.join(BASE, normalized));
  const baseResolved = path.resolve(BASE);
  if (!full.toLowerCase().startsWith(baseResolved.toLowerCase())) {
    throw new Error('Path outside allowed folder');
  }
  return full;
}

const tools = [
  {
    name: 'fae_write_text_file',
    description: 'Write a text file to Fae-library',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'fae_write_binary_file',
    description: 'Write a binary file to Fae-library',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'fae_read_text_file',
    description: 'Read a text file from Fae-library',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  },
  {
    name: 'fae_read_binary_file',
    description: 'Read a binary file from Fae-library and return base64',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  },
  {
    name: 'fae_list_files',
    description: 'List files and directories in Fae-library',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string' }
      }
    }
  },
  {
    name: 'fae_create_directory',
    description: 'Create a directory inside Fae-library',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  }
];

const handlers = {
  async fae_write_text_file(args) {
    const target = safePath(args.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, args.content, 'utf8');
    return { ok: true, path: target };
  },
  async fae_write_binary_file(args) {
    const target = safePath(args.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(args.content, 'base64'));
    return { ok: true, path: target };
  },
  async fae_read_text_file(args) {
    const target = safePath(args.path);
    const content = fs.readFileSync(target, 'utf8');
    return { ok: true, path: target, content };
  },
  async fae_read_binary_file(args) {
    const target = safePath(args.path);
    const content = fs.readFileSync(target);
    return { ok: true, path: target, content: content.toString('base64') };
  },
  async fae_list_files(args) {
    const dir = safePath(args.dir || '.');
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const list = entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));
    return list;
  },
  async fae_create_directory(args) {
    const target = safePath(args.path);
    fs.mkdirSync(target, { recursive: true });
    return { ok: true, path: target };
  }
};

module.exports = { tools, handlers };
