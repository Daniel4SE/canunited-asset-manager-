#!/bin/bash
# Manual push script for CANUnited Asset Manager
# Usage: ./scripts/push-to-github.sh [commit message]

set -e

cd "$(dirname "$0")/.."

REMOTE_URL="https://github.com/Daniel4SE/canunited-asset-manager-.git"
BRANCH="main"
COMMIT_MSG="${1:-Auto update: $(date '+%Y-%m-%d %H:%M:%S')}"

echo "📦 CANUnited Asset Manager - GitHub Push"
echo "========================================="

# Check if remote exists
if ! git remote get-url origin &>/dev/null; then
    echo "➕ Adding remote origin..."
    git remote add origin "$REMOTE_URL"
fi

# Check for changes
if [[ -n $(git status --porcelain) ]]; then
    echo "📝 Staging changes..."
    git add -A

    echo "💾 Committing: $COMMIT_MSG"
    git commit -m "$COMMIT_MSG"
fi

# Push
echo "🚀 Pushing to GitHub..."
git push -u origin "$BRANCH"

echo ""
echo "✅ Done! View at: https://github.com/Daniel4SE/canunited-asset-manager-"
