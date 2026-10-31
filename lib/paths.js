// Paths inside the Fae-library, shared by every module that reads or writes there.
//
// Accepts what a caller is likely to hand back: a path relative to the library ("Pandora-Comms/note.md"),
// or a full one this server returned earlier, in any spelling (Windows backslashes, forward slashes, or Git
// Bash's "/f/..." form). A full path used to be glued onto the library a second time, which gave paths with
// the library's own path in them twice.
//
// Paths go back out with forward slashes only, so they survive JSON and tool transports without "\\" piling up.

const path = require('path');

const BASE = path.resolve(gitBashToWindows(process.env.FAE_STORAGE_BASE || './Fae-library'));

/** Git Bash (MSYS) spelling "/d/folder/x" → drive spelling "D" + ":/folder/x" on Windows; anything else unchanged. */
function gitBashToWindows(p) {
  if (process.platform !== 'win32') return p;
  const m = /^\/([a-zA-Z])(\/.*)?$/.exec(p);
  return m ? `${m[1].toUpperCase()}:${m[2] || '/'}` : p;
}

function inside(full, root) {
  const a = full.toLowerCase(), b = root.toLowerCase();
  return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
}

/** A path inside the library, or an error. */
function safePath(p) {
  const given = gitBashToWindows(String(p || '.').trim());
  // a full path already inside the library is used as it is; anything else ("/Pandora-Comms/x.md" too) is
  // relative to the library, as it always was
  const asIs = path.isAbsolute(given) ? path.resolve(given) : null;
  const full = asIs && inside(asIs, BASE) ? asIs : path.resolve(BASE, given.replace(/^[\\/]+/, ''));
  if (!inside(full, BASE)) throw new Error(`Path outside the Fae-library: ${p}`);
  return full;
}

/** How a path goes back to the caller: forward slashes, full. */
const shown = (full) => full.split(path.sep).join('/');

/** The same path relative to the library, forward slashes ("Pandora-Comms/note.md"). */
const relative = (full) => path.relative(BASE, full).split(path.sep).join('/') || '.';

module.exports = { BASE, safePath, shown, relative, gitBashToWindows };
