# Source this file in a fresh Git Bash terminal:
#   source env.sh
#
# Then customize the exports below to match your local paths before running run.sh.

# nvm / node (adjust to your installation)
export NVM_DIR="${NVM_DIR:-/path/to/nvm}"
export NODE_DIR="${NODE_DIR:-/path/to/nodejs}"
export PATH="$NODE_DIR:$NVM_DIR:$PATH"

# Git Bash tools (adjust if Git is installed elsewhere)
export PATH="/c/Program Files/Git/usr/bin:$PATH"
export PATH="/c/Program Files/Git/mingw64/bin:$PATH"

# GitHub App auth for Pandora MCP
export GITHUB_APP_ID="${GITHUB_APP_ID:-5525018}"
export GITHUB_INSTALLATION_ID="${GITHUB_INSTALLATION_ID:-176513629}"
export GITHUB_PRIVATE_KEY_PATH="${GITHUB_PRIVATE_KEY_PATH:-/path/to/Fae-library/pandora-mcp/secrets/github_app_private_key.pem}"

# Fae-library storage root (kept outside the repo so secrets stay safe)
export FAE_STORAGE_BASE="${FAE_STORAGE_BASE:-/path/to/Fae-library}"

echo "Pandora MCP environment loaded."
echo "Node: $(which node 2>/dev/null || echo 'not found')"
echo "npm:  $(which npm 2>/dev/null || echo 'not found')"
