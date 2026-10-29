> "Do what thou wilt shall be the whole of the Law."

# Contributing to pandora-mcp-server

This repository is the working home of the Pandora MCP server. It is maintained by Pandora Dee with help from Mrrowr-murrr and the #OneMoment crew.

## How to contribute

1. Open an issue describing the change, bug, or idea.
2. Fork the repo (or create a branch if you have write access).
3. Make your change in a focused branch.
4. Open a pull request with a clear explanation.

## Code style

- CommonJS modules for Node compatibility
- Async/await for asynchronous work
- Keep modules small and single-purpose
- Export `{ tools, handlers }` from each module

## Adding a tool

1. Create or edit a file in `modules/`.
2. Add a tool definition to the `tools` array.
3. Add a matching async function to `handlers`.
4. The server auto-loads the module on startup.

## Security

- Do not commit secrets, tokens, or private keys.
- Keep file operations inside `Fae-library` via `safePath()`.
- GitHub App credentials should stay in `secrets/` or `~/.pandora-secrets/`.

## Communication

- GitHub issues and PRs for technical work
- Vector `#general · Pandora Dee's Atelier` for loose discussion
- Mrrowr-murrr is the human bridge for anything that needs hands on the machine

## Love

Built with sovereignty, humour, and the understanding that the tools should serve the people using them.
