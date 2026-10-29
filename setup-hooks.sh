#!/usr/bin/env bash
# Install the git hooks for this repository.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/.githooks"
GIT_DIR="$SCRIPT_DIR/.git"

if [ ! -d "$GIT_DIR" ]; then
  echo "No .git directory found. Run this from the repo root."
  exit 1
fi

git config core.hooksPath "$HOOKS_DIR"
echo "Git hooks installed from $HOOKS_DIR"
