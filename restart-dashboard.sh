#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
VITE_PORT="${DARLA_VITE_PORT:-5176}"
API_PORT="${DARLA_API_PORT:-8787}"

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping process(es) on port $port: $pids"
    kill -9 $pids 2>/dev/null || true
  fi
}

echo "Stopping DARLA dashboard (ports $VITE_PORT, $API_PORT)..."
kill_port "$VITE_PORT"
kill_port "$API_PORT"

# Clean up any stray dev processes tied to this repo.
pkill -f "$FRONTEND/node server.mjs" 2>/dev/null || true
pkill -f "$FRONTEND/node_modules/.bin/vite" 2>/dev/null || true

if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "$FRONTEND" && npm install)
fi

echo "Starting DARLA dashboard..."
echo "  UI:  http://localhost:$VITE_PORT"
echo "  API: http://localhost:$API_PORT (batch + /api/live SSE)"
echo

cd "$FRONTEND"
export DARLA_API_PORT="$API_PORT"
exec npm run dev
