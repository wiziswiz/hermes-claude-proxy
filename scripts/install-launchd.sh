#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${LABEL:-ai.wiz.hermes-claude-proxy}"
PORT="${PORT:-4524}"
HOST="${HOST:-127.0.0.1}"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${LOG_DIR:-$HOME/Library/Logs/hermes-claude-proxy}"

mkdir -p "$(dirname "$PLIST_PATH")" "$LOG_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>WorkingDirectory</key>
  <string>${ROOT_DIR}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${ROOT_DIR}/index.js</string>
    <string>--host</string>
    <string>${HOST}</string>
    <string>--port</string>
    <string>${PORT}</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>AUTH_HEADER_FORMAT</key>
    <string>auto</string>
    <key>STARTUP_VALIDATE</key>
    <string>1</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/stdout.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/stderr.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"
launchctl start "$LABEL" >/dev/null 2>&1 || true

echo "Installed ${LABEL}"
echo "Plist: ${PLIST_PATH}"
echo "Logs: ${LOG_DIR}"
echo "Health: http://${HOST}:${PORT}/health"
