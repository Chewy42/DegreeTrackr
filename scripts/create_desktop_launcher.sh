#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNNER_SCRIPT="$REPO_ROOT/scripts/run_desktop_launcher.sh"
APP_NAME="EduTrackr Dev Launcher.app"
APP_PATH="$HOME/Desktop/$APP_NAME"

if [[ ! -f "$RUNNER_SCRIPT" ]]; then
  echo "Runner script not found: $RUNNER_SCRIPT" >&2
  exit 1
fi

TMP_APPLESCRIPT="$(mktemp)"
cleanup() {
  rm -f "$TMP_APPLESCRIPT"
}
trap cleanup EXIT

cat >"$TMP_APPLESCRIPT" <<APPLESCRIPT
on run
  do shell script quoted form of "$RUNNER_SCRIPT"
end run
APPLESCRIPT

rm -rf "$APP_PATH"
osacompile -o "$APP_PATH" "$TMP_APPLESCRIPT"

echo "Created Desktop launcher at: $APP_PATH"