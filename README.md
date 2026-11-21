# pandora-mcp-server

A modular MCP server for agentic workflows, sovereign AI tooling, and local-first automation.

## What it does

This server exposes tools that let an MCP client act on behalf of an agent:

- GitHub bridge: read/write files, manage branches and PRs, list/create issues, and manage repos, teams, and members in a GitHub organization.
- Fae-library bridge: read/write text and binary files, list directories, and create directories inside a local vault folder.
- Web bridge: search the web and extract article content via Tavily.

Authentication uses a GitHub App installed on an organization, plus a local private key. A personal access token can be used as a fallback.

## Running it

First copy env.example.sh to env.sh and fill in your values (env.sh is git-ignored, so your values stay local). Then, from the server directory, run bash ./run.sh on Git Bash/Linux/macOS (it loads env.sh itself), or run.bat on Windows CMD.

The server listens on http://localhost:8002/mcp by default.

## Configuration

Set these environment variables before running: GITHUB_APP_ID, GITHUB_INSTALLATION_ID, GITHUB_PRIVATE_KEY_PATH, and FAE_STORAGE_BASE.

## Modules

- modules/github.js: GitHub REST API tools with GitHub App + PAT auth
- modules/fae-storage.js: local filesystem tools for a configured vault folder
- modules/web.js: Tavily search and URL extraction

## Mode Shrine

A small companion server in mode-shrine/ that holds one shared emoji mode (snack, forge, nocturne, manderville, shield) and its tone, so every connected surface can read and set the same mood. Tools: mode_get, mode_set, mode_list. The current mode is kept in mode-shrine/mode-state.json (git-ignored).

Run mode-shrine/run.bat (Windows CMD) or bash mode-shrine/run.sh. It serves http://localhost:8000/mcp over streamable HTTP with CORS on, so browser pages can call it.

- With no key file it listens on this machine only (127.0.0.1).
- To reach it from other devices, put one or more keys (one per line) in secrets/mode-shrine.key. The launcher then listens on the network and every request must send one of them as a bearer token (Authorization: Bearer <key>). Browser preflight requests still pass, so CORS keeps working.

mode-shrine/mcp.json describes it for clients that launch servers over stdio; its path is relative to this repository's root. mode-shrine/server.js is the older plain-HTTP version (GET/POST /mode, GET /modes on 127.0.0.1:9393), kept for surfaces that use it.

## Security

Never commit secrets or .pem files. The GitHub App should be scoped to the organization it manages. Local file access is restricted to the configured base folder via safePath().

## License

See LICENSE.
