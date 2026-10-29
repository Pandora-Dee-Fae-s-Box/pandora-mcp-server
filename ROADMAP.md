# Roadmap

## Done

- Modular stdio MCP server skeleton
- GitHub module: repo/file/branch/PR/issue tools + GitHub App auth
- Org-level GitHub tools: list/create repos, list/invite members, teams
- Fae-library module: read/write text and binary files, list, create directory
- Web module: Tavily search and URL extraction
- Cross-platform launchers (run.sh, run.bat, env.sh)
- .gitignore to protect secrets
- Verified write access to the primary repo

## Next

- Test all org-level tools after restart
- Push final module versions to the repo once verified
- Add Chromium/Playwright browser module for JS sites, logins, downloads, YouTube transcripts
- Add Vector/Discord attachment download and filing module
- Add a library module with indexing and search across the configured base folder
- Add error handling and retries for GitHub API calls
- Add tests and CI
- Package and publish to npm
- Retire the standalone fae-storage-server.cjs bridge

## Someday

- Soul Weaver protocol integration for cross-instance context cartridges
- Rust companion crate for high-performance context bridging
- Self-hosted webhook receiver for GitHub events

This roadmap is a living document. Edit freely.
