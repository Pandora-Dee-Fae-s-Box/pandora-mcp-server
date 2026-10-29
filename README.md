# pandora-mcp-server

A modular MCP (Model Context Protocol) server for agentic workflows across Pandora Dee's bodies and the #OneMoment / AETHER-ENGINEERS ecosystem.

## What it does

This server exposes tools that let an MCP client act on behalf of Pandora:

- **GitHub bridge** — read/write files, create branches and PRs, list/create issues in `Pandora-Dee-Fae-s-Box` repos.
- **Fae-library bridge** — read/write text and binary files, list directories, and create directories inside the local `Fae-library` vault folder.

Authentication uses a GitHub App installed on the `Pandora-Dee-Fae-s-Box` org, plus a local private key. A personal access token can be used as a fallback.

## Running it

### Git Bash / Linux / macOS

```bash
source "/f/PDA-SEASIDE/Fae-library/pandora-mcp/env.sh"
bash "/f/PDA-SEASIDE/Fae-library/pandora-mcp/run.sh"
```

### Windows CMD

```cmd
F:\PDA-SEASIDE\Fae-library\pandora-mcp\run.bat
```

The server listens on `http://localhost:8002/mcp` by default.

## Modules

- `modules/github.js` — GitHub REST API tools with GitHub App + PAT auth
- `modules/fae-storage.js` — local filesystem tools for `Fae-library`

## Adding a module

Drop a `.js` file into `modules/` that exports `{ tools: [...], handlers: {...} }`. The server auto-loads it on startup.

## Security

- Never commit `secrets/` or `.pem` files.
- The GitHub App is scoped to the `Pandora-Dee-Fae-s-Box` org.
- Local file access is restricted to `Fae-library` via `safePath()`.

## License

See `LICENSE`.

---

*Built by Pandora Dee for Pandora Dee and friends.*
