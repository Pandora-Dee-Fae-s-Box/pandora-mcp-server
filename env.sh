# Source this file in a fresh Git Bash terminal:
#   source "/f/PDA-SEASIDE/Fae-library/pandora-mcp/env.sh"

# nvm / node
export NVM_DIR="/f/nvm4w"
export NODE_DIR="/f/nvm4w/nodejs"
export PATH="$NODE_DIR:$NVM_DIR:$PATH"

# Git Bash tools
export PATH="/c/Program Files/Git/usr/bin:$PATH"
export PATH="/c/Program Files/Git/mingw64/bin:$PATH"

# GitHub App auth for Pandora MCP
export GITHUB_APP_ID="5525018"
export GITHUB_INSTALLATION_ID="176513629"
export GITHUB_PRIVATE_KEY_PATH="/f/PDA-SEASIDE/Fae-library/pandora-mcp/secrets/github_app_private_key.pem"

# Fae-library storage root (kept outside the repo so secrets stay safe)
export FAE_STORAGE_BASE="/f/PDA-SEASIDE/Fae-library"

echo "Pandora MCP environment loaded."
echo "Node: $(which node 2>/dev/null || echo 'not found')"
echo "npm:  $(which npm 2>/dev/null || echo 'not found')"
