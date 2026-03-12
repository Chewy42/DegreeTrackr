#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
START_SCRIPT="$REPO_ROOT/scripts/start_desktop_dev.sh"
DEFAULT_FRONTEND_PORT=3333
MAX_FRONTEND_PORT=5273
STARTUP_TIMEOUT_SECONDS=120

show_alert() {
  local title="$1"
  local message="$2"
  osascript - "$title" "$message" <<'APPLESCRIPT'
on run argv
  display alert (item 1 of argv) message (item 2 of argv) as critical
end run
APPLESCRIPT
}

port_is_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

read_env_value() {
  local key="$1"

  if [[ ! -f "$ENV_FILE" ]]; then
    return 0
  fi

  python3 - "$ENV_FILE" "$key" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
key = sys.argv[2]

for raw_line in env_path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    current_key, value = line.split("=", 1)
    if current_key.strip() != key:
        continue
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]
    print(value)
    break
PY
}

resolve_frontend_port() {
  local candidate="${CLIENT_PORT:-}"
  local explicit_source=""

  if [[ -n "$candidate" ]]; then
    explicit_source="environment"
  else
    candidate="$(read_env_value CLIENT_PORT || true)"
    if [[ -n "$candidate" ]]; then
      explicit_source=".env"
    fi
  fi

  if [[ -z "$candidate" ]]; then
    candidate="$DEFAULT_FRONTEND_PORT"
  fi

  if [[ ! "$candidate" =~ ^[0-9]+$ ]] || (( candidate < 1 || candidate > 65535 )); then
    show_alert "DegreeTrackr launcher configuration error" "CLIENT_PORT must be a number between 1 and 65535. Falling back ports are not allowed because Vite uses strictPort."
    exit 1
  fi

  if ! port_is_listening "$candidate"; then
    printf '%s\n' "$candidate"
    return 0
  fi

  if [[ -n "$explicit_source" ]]; then
    show_alert "DegreeTrackr launcher blocked" "Frontend port ${candidate} from ${explicit_source} CLIENT_PORT is already in use. Choose a different CLIENT_PORT before relaunching."
    exit 1
  fi

  local fallback
  for (( fallback = candidate + 1; fallback <= MAX_FRONTEND_PORT; fallback += 1 )); do
    if ! port_is_listening "$fallback"; then
      printf '%s\n' "$fallback"
      return 0
    fi
  done

  show_alert "DegreeTrackr launcher blocked" "Could not find a free frontend port between ${DEFAULT_FRONTEND_PORT} and ${MAX_FRONTEND_PORT}."
  exit 1
}

launch_terminal_server() {
  local frontend_port="$1"
  local terminal_command

  if [[ ! -x "$START_SCRIPT" ]]; then
    show_alert "DegreeTrackr launcher configuration error" "Start script is missing or not executable: ${START_SCRIPT}"
    exit 1
  fi

  printf -v terminal_command 'cd %q && %q %q' \
    "$REPO_ROOT" "$START_SCRIPT" "$frontend_port"

  osascript - "$terminal_command" <<'APPLESCRIPT'
on run argv
  tell application "Terminal"
    do script (item 1 of argv)
  end tell
end run
APPLESCRIPT
}

wait_for_frontend() {
  local frontend_url="$1"
  local attempt=0

  while (( attempt < STARTUP_TIMEOUT_SECONDS )); do
    if curl --silent --show-error --fail --max-time 2 "$frontend_url" >/dev/null 2>&1; then
      open "$frontend_url"
      return 0
    fi
    sleep 1
    ((attempt += 1))
  done

  show_alert "DegreeTrackr launcher timeout" "Started Terminal, but ${frontend_url} did not respond within ${STARTUP_TIMEOUT_SECONDS} seconds. Check the new Terminal window for startup errors."
  return 1
}

main() {
  local frontend_port

  frontend_port="$(resolve_frontend_port)"

  launch_terminal_server "$frontend_port"
  wait_for_frontend "http://127.0.0.1:${frontend_port}"
}

main "$@"
