#!/usr/bin/env bash
# Mode Shrine MCP Server launcher (Git Bash / macOS / Linux)
# Browser-safe: stdio server exposed over streamable HTTP via supergateway, with CORS on.
# Serves http://localhost:8000/mcp. Only this machine can reach it, unless a key file exists at
# ../secrets/mode-shrine.key (one key per line; secrets/ is git-ignored): then other devices can
# reach it too, and every request must carry one of those keys as a bearer token.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
KEYFILE="$SCRIPT_DIR/../secrets/mode-shrine.key"

if [ -f "$KEYFILE" ]; then
  exec npx -y supergateway --stdio "node ./mode-shrine-server.cjs" --port 8000 --outputTransport streamableHttp --cors "*" --apiKeyFile "$KEYFILE"
else
  exec npx -y supergateway --stdio "node ./mode-shrine-server.cjs" --port 8000 --outputTransport streamableHttp --cors "*" --host 127.0.0.1
fi
