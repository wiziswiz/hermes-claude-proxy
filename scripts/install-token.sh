#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -t 0 ]]; then
  read -r -s -p "Paste Claude setup-token: " TOKEN
  echo
else
  IFS= read -r TOKEN
fi

TOKEN="${TOKEN//$'\r'/}"
TOKEN="${TOKEN//$'\n'/}"

if [[ -z "$TOKEN" ]]; then
  echo "No token provided" >&2
  exit 1
fi

if [[ "$TOKEN" != sk-ant-oat* && "$TOKEN" != sk-ant-* && "$TOKEN" != cc-* && "$TOKEN" != eyJ* ]]; then
  echo "Token does not look like a Claude/Anthropic token" >&2
  exit 1
fi

ANTHROPIC_TOKEN="$TOKEN" "$ROOT_DIR/scripts/install-launchd.sh"

unset TOKEN
echo "Token installed into the local launchd service environment."
