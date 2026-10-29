const fs = require('fs');
const path = require('path');

// Configurable base path so the repo stays generic.
// Set FAE_STORAGE_BASE to the absolute path of your local vault folder.
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

function safePathPair(src, dst) {
  return [safePath(src), safePath(dst)];
}

function directoryTree(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.map(e => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      return { name: e.name, type: 'directory', children: directoryTree(full) };
    }
    return { name: e.name, type: 'file' };
  });
}

function searchFiles(root, pattern) {
  const results = [];
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      if (e.isDirectory()) {
        walk(full);
      } else if (regex.test(rel) || regex.test(e.name)) {
        results.push(rel);
      }
    }
  }
  walk(root);
  return results;
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
    name: 'fae_list_files_with_sizes',
    description: 'List files and directories in Fae-library with sizes',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string' },
        sortBy: { type: 'string' }
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
  },
  {
    name: 'fae_directory_tree',
    description: 'Return a recursive JSON tree of files and directories in Fae-library',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string' }
      }
    }
  },
  {
    name: 'fae_get_file_info',
    description: 'Get metadata about a file or directory in Fae-library',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  },
  {
    name: 'fae_edit_file',
    description: 'Make line-based edits to a text file in Fae-library. Each edit replaces exact oldText with newText.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              oldText: { type: 'string' },
              newText: { type: 'string' }
            },
            required: ['oldText', 'newText']
          }
        }
      },
      required: ['path', 'edits']
    }
  },
  {
    name: 'fae_move_file',
    description: 'Move or rename a file or directory inside Fae-library',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string' },
        destination: { type: 'string' }
      },
      required: ['source', 'destination']
    }
  },
  {
    name: 'fae_search_files',
    description: 'Search for files matching a glob pattern inside Fae-library',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        pattern: { type: 'string' }
      },
      required: ['path', 'pattern']
    }
  },
  {
    name: 'fae_read_multiple_files',
    description: 'Read multiple text files from Fae-library at once',
    inputSchema: {
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string' } }
      },
      required: ['paths']
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
  async fae_list_files_with_sizes(args) {
    const dir = safePath(args.dir || '.');
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const list = entries.map(e => {
      const full = path.join(dir, e.name);
      const stat = fs.statSync(full);
      return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', size: stat.size };
    });
    if (args.sortBy === 'size') {
      list.sort((a, b) => a.size - b.size);
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  },
  async fae_create_directory(args) {
    const target = safePath(args.path);
    fs.mkdirSync(target, { recursive: true });
    return { ok: true, path: target };
  },
  async fae_directory_tree(args) {
    const dir = safePath(args.dir || '.');
    return { path: dir, tree: directoryTree(dir) };
  },
  async fae_get_file_info(args) {
    const target = safePath(args.path);
    const info = fs.statSync(target);
    return {
      path: target,
      size: info.size,
      isDirectory: info.isDirectory(),
      isFile: info.isFile(),
      created: info.birthtime,
      modified: info.mtime,
      permissions: info.mode.toString(8)
    };
  },
  async fae_edit_file(args) {
    const target = safePath(args.path);
    let content = fs.readFileSync(target, 'utf8');
    for (const edit of args.edits || []) {
      if (!content.includes(edit.oldText)) {
        throw new Error(`oldText not found in ${args.path}`);
      }
      content = content.replace(edit.oldText, edit.newText);
    }
    fs.writeFileSync(target, content, 'utf8');
    return { ok: true, path: target };
  },
  async fae_move_file(args) {
    const [src, dst] = safePathPair(args.source, args.destination);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
    return { ok: true, source: src, destination: dst };
  },
  async fae_search_files(args) {
    const dir = safePath(args.path || '.');
    return { path: dir, pattern: args.pattern, matches: searchFiles(dir, args.pattern) };
  },
  async fae_read_multiple_files(args) {
    const results = [];
    for (const p of args.paths || []) {
      const target = safePath(p);
      const content = fs.readFileSync(target, 'utf8');
      results.push({ path: target, content });
    }
    return results;
  }
};

module.exports = { tools, handlers };
