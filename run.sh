#!/usr/bin/env bash
# Generic launcher. Source env.sh or set env vars before running.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/env.sh" ]; then
  source "$SCIRAP_DIR/env.sh"
fi
exec npx -y supergateway --stdio "node ${SCRIPT_DIR}/pandora-mcp-server.cjs" --port 8002 --cors "*" --ssePath /mcp --messagePath /messages --outputTransport streamableHttp
