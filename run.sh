#!/usr/bin/env bash
# Pandora MCP Server launcher (Git Bash / macOS / Linux)

export FAE_STORAGE_BASE="${FAE_STORAGE_BASE:-/path/to/Fae-library}"

export GITHUB_APP_ID="${GITHUB_APP_ID:-5525018}"
export GITHUB_INSTALLATION_ID="${GITHUB_INSTALLATION_ID:-176513629}"
export GITHUB_PRIVATE_KEY_PATH="${GITHUB_PRIVATE_KEY_PATH:-/path/to/Fae-library/pandora-mcp/secrets/github_app_private_key.pem}"

# Fallback to PAT if no app key is present
if [ -z "$GITHUB_TOKEN" ] && [ -z "$GITHUB_APP_ID" ] && [ -f "$HOME/.pandora-secrets/github_token" ]; then
  export GITHUB_TOKEN=$(cat "$HOME/.pandora-secrets/github_token")
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER="$SCRIPT_DIR/pandora-mcp-server.cjs"

exec npx -y supergateway \
  --stdio "node \"$SERVER\"" \
  --port 8002 \
  --cors "*" \
  --ssePath /mcp \
  --messagePath /messages \
  --outputTransport streamableHttp
