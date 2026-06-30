#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE="$ROOT/frontend/src/studio-core"

if [[ ! -d "$CORE" ]]; then
  echo "No studio-core directory found."
  exit 0
fi

# Remove prior conflicting files from earlier patches.
rm -f "$CORE/CommandPalette.ts"
rm -f "$CORE/CommandPalette.tsx"
rm -f "$CORE/commandPalette.ts"
rm -f "$CORE/commandPalette.tsx"
rm -f "$CORE/commandPalette.css"

echo "Cleaned prior CommandPalette/commandPalette casing conflicts."
