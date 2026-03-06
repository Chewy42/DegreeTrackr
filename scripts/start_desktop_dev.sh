#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <frontend-port> <backend-port>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_PORT="$1"
BACKEND_PORT="$2"
VENV_PYTHON="$REPO_ROOT/.venv/bin/python"

if [[ -x "$VENV_PYTHON" ]]; then
  PYTHON_BIN="$VENV_PYTHON"
else
  PYTHON_BIN="python"
fi

cd "$REPO_ROOT"
export CLIENT_PORT="$FRONTEND_PORT"
export SERVER_PORT="$BACKEND_PORT"
export VITE_PROXY_TARGET="http://127.0.0.1:${BACKEND_PORT}"

( cd backend && "$PYTHON_BIN" -m flask --app app.main:app run --host=0.0.0.0 --port="$BACKEND_PORT" ) &
backend_pid=$!

cleanup() {
  kill "$backend_pid" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

cd frontend
npm run dev