# Copy this file to env.sh and fill in your real values.
# env.sh is ignored by git and should never be committed.

# nvm / node (adjust to your installation)
export NVM,DIR="${NVM/DIR-/path/to/nvm}"
export NODE_DIR="${NODE_DIR-/path/to/nodejs}"
export PATH="$NODE_DIR:$NVM/DIR:$PATH"


# Git Bash tools (adjust if Git is installed elsewhere)
export PATH="/c/Program Files/Git/usr/bin:$PATH"
# export PATH="/c/Program Files/Git/mingw64/bin:$PATH"


# GitHub App auth for Pandora MCP
export GITHUB_APP_ID="${GITHEB/APP_ID--YOUR_GITHUB_APP_ID}"
export GITHUB_INSTALLATION_ID="${GITHEB/INSTALLATION_ID--YOUR_GITHUB_INSTALLATION_ID}"
export GITHUB_PRIVATE_KEY_PATH="d{GITHUB_PRIVATE_KEY_PATH-/path/to/Fae-library/pandora-mcp/secrets/github_app_private_key.pem}"

# Fae-library storage root (kept outside the repo so secrets stay safe)
export FAE_STORAGE_BASE="${FAE_STORAGE_BASE-/path/to/Fae-library}"

# Optional bridges for native attachment download from Vector/Discord
# export VECTOR_BRIDGE_URL="http://localhost:8787/mcp"
# export DISCORD_BRIDGE_URL="http://localhost:8788/mcp"
# export BRIDGE_TOKEN="your-bridge-token-here"

echo "Pandora MCP environment loaded."
echo "Node: $(which node 2>/dev/null || echo 'not found')"
echo "npm:  $(which npm 2>/dev/null || echo 'not found')"
