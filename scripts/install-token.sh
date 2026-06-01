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

install_hermes_env_file() {
  local file="$1"
  local dir
  local tmp
  dir="$(dirname "$file")"
  mkdir -p "$dir"
  chmod 700 "$dir" 2>/dev/null || true
  tmp="$(mktemp "${file}.tmp.XXXXXX")"
  if [[ -f "$file" ]]; then
    awk '!/^[[:space:]]*(ANTHROPIC_TOKEN|CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)[[:space:]]*=/' "$file" > "$tmp"
  fi
  {
    printf 'ANTHROPIC_TOKEN=%s\n' "$TOKEN"
    printf 'CLAUDE_CODE_OAUTH_TOKEN=%s\n' "$TOKEN"
  } >> "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$file"
}

if [[ "${INSTALL_HERMES_ENV:-1}" != "0" ]]; then
  install_hermes_env_file "$HOME/.hermes/.env"
  if [[ -d "$HOME/.hermes/profiles" ]]; then
    for profile_dir in "$HOME"/.hermes/profiles/*; do
      [[ -d "$profile_dir" ]] || continue
      install_hermes_env_file "$profile_dir/.env"
    done
  fi
fi

ANTHROPIC_TOKEN="$TOKEN" "$ROOT_DIR/scripts/install-launchd.sh"

unset TOKEN
echo "Token installed into the local launchd service environment."
if [[ "${INSTALL_HERMES_ENV:-1}" != "0" ]]; then
  echo "Token installed into local Hermes .env files."
fi
