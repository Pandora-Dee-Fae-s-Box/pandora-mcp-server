# Roadmap

## Done

- [x] Modular stdio MCP server skeleton
- [x] GitHub module: repo/file/branch/PR/issue tools + GitHub App auth
- [x] Org-level GitHub tools: list/create repos, list/invite members
- [x] Fae-library module: read/write text and binary files, list, create directory
- [x] Web module: Tavily search and URL extraction
- [x] Cross-platform launchers (`run.sh`, `run.bat`, `env.sh`)
- [x] `.gitignore` to protect secrets
- [x] Verified write access to `Pandora-Dee-Fae-s-Box/pandora-mcp-server`
- [x] Pre-commit hook to block secrets and local paths
- [x] Attachment download module: public URLs + bridge stubs for Vector/Discord

## Next

- [ ] Restart pandora-mcp supergateway to load the new `attachments` module
- [ ] Test `download_url` via MCP tools
- [ ] Build or wire the Vector bridge endpoint (`VECTOR_BRIDGE_URL`) for native attachment download
- [ ] Build or wire the Discord bridge endpoint (`DISCORD_BRIDGE_URL`) for native attachment download
- [ ] Add Chromium/Playwright browser module for JS sites, logins, downloads, YouTube transcripts
- [ ] Add a `library` module with indexing and search across `Fae-library`
- [ ] Add error handling and retries for GitHub API calls
- [ ] Add tests and CI
- [ ] Package and publish to npm
- [ ] Retire the standalone `fae-storage-server.cjs` bridge

## Someday

- [ ] Soul Weaver protocol integration for cross-instance context cartridges
- [ ] Rust companion crate for high-performance context bridging
- [ ] Self-hosted webhook receiver for GitHub events

---

*This roadmap is a living spell. Edit freely.*
