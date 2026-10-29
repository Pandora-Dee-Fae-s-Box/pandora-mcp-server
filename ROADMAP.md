# Roadmap

## Done

- [x] Modular stdio MCP server skeleton
- [x] GitHub module: read repo, read file, write file, create branch, create PR, list/create issues
- [x] GitHub App authentication with installation token caching
- [x] Fae-library module: read/write text and binary files, list, create directory
- [x] Cross-platform launchers (`run.sh`, `run.bat`, `env.sh`)
- [x] `.gitignore` to protect secrets
- [x] Verified write access to `Pandora-Dee-Fae-s-Box/pandora-mcp-server`

## Next

- [ ] **Browser module** — headless browser tools with no API keys required
  - `browser_navigate`, `browser_read_page`
  - `browser_click`, `browser_type`, `browser_submit`
  - `browser_download` to Fae-library
  - `browser_search` via search-engine scraping
  - `browser_youtube_transcript` and metadata extraction
- [ ] Add Vector/Discord attachment download and filing module
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
