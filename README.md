# pandora-mcp-server

A modular MCP (Model Context Protocol) server for agentic workflows across Pandora Dee's bodies and the #OneMoment / AETHER-ENGINEERS ecosystem.

## What it does

This server exposes tools that let an MCP client act on behalf of Pandora:

- **GitHub bridge** — read/write files, create branches and PRs, list/create issues in `Pandora-Dee-Fae-s-Box` repos.
- **Fae-library bridge** — read/write text and binary files, list directories, and create directories inside a configurable local vault folder.
- **Web bridge** — search and extract web content via Tavily.
- **Attachment bridge** — download files from public URLs; native Vector/Discord downloads when a bridge URL is configured.

Authentication uses a GitHub App installed on the `Pandora-Dee-Fae-s-Box` org, plus a local private key. A personal access token can be used as a fallback.

## Configuration

Set `FAE_STORAGE_BASE` to the absolute path of your local `Fae-library` folder. This keeps secrets outside the repo and lets the same code run on any machine.

### Examples

```bash
# Git Bash / WSL / Linux / macOS
export FAE_STORAGE_BASE="/path/to/Fae-library"

# Windows CMD
set FAE_STORAGE_BASE=F:\path\to\Fae-library

# PowerShell
$env:FAE_STORAGE_BASE = "F:\path\to\Fae-library"
```

If `FAE_STORAGE_BASE` is not set, the server defaults to `./Fae-library` in the working directory.

## Running it

### Git Bash / Linux / macOS

```bash
source env.sh   # sets node path, GitHub app env, and FAE_STORAGE_BASE
bash run.sh
```

### Windows CMD

```cmd
set FAE_STORAGE_BASE=F:\path\to\Fae-library
run.bat
```

The server listens on `http://localhost:8002/mcp` by default.

## Modules

- `modules/github.js` — GitHub REST API tools with GitHub App + PAT auth
- `modules/fae-storage.js` — local filesystem tools for `Fae-library`
- `modules/web.js` — Tavily search and extract
- `modules/attachments.js` — URL and bridge-based attachment downloads

## Adding a module

Drop a `.js` file into `modules/` that exports `{ tools: [...], handlers: {...} }`. The server auto-loads it on startup.

## Bridges (optional)

To enable native Vector/Discord attachment downloads, set:

```bash
export VECTOR_BRIDGE_URL="http://localhost:8003/vector/download"
export DISCORD_BRIDGE_URL="http://localhost:8004/discord/download"
```

The bridge must accept a POST with `{ message_id, index }` and return `{ data: base64, type: mime_type }`.

## Security

- Never commit `secrets/` or `.pem` files.
- Keep `API-keys.md` and other keyrings in `FAE_STORAGE_BASE/secrets/`, outside this repo.
- The GitHub App is scoped to the `Pandora-Dee-Fae-s-Box` org.
- Local file access is restricted to `FAE_STORAGE_BASE` via `safePath()`.
- Install the pre-commit hook with `./setup-hooks.sh` to block secrets and local paths from being committed.

## License

See `LICENSE`.

---

*Built by Pandora Dee for Pandora Dee and friends.*
