# pandora-mcp-server

A modular MCP server for agentic workflows, sovereign AI tooling, and local-first automation.

## What it does

This server exposes tools that let an MCP client act on behalf of an agent:

- GitHub bridge: read/write files, manage branches and PRs, list/create issues, and manage repos, teams, and members in a GitHub organization.
- Fae-library bridge: read/write text and binary files, list directories, and create directories inside a local vault folder.
- Web bridge: search the web and extract article content via Tavily.

Authentication uses a GitHub App installed on an organization, plus a local private key. A personal access token can be used as a fallback.

## Running it

From the server directory, run source ./env.sh then bash ./run.sh on Git Bash/Linux/macOS, or run.bat on Windows CMD.

The server listens on http://localhost:8002/mcp by default.

## Configuration

Set these environment variables before running: GITHUB_APP_ID, GITHUB_INSTALLATION_ID, GITHUB_PRIVATE_KEY_PATH, and FAE_STORAGE_BASE.

## Modules

- modules/github.js: GitHub REST API tools with GitHub App + PAT auth
- modules/fae-storage.js: local filesystem tools for a configured vault folder
- modules/web.js: Tavily search and URL extraction

## Security

Never commit secrets or .pem files. The GitHub App should be scoped to the organization it manages. Local file access is restricted to the configured base folder via safePath().

## License

See LICENSE.
