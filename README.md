# hermes-claude-proxy

Local Anthropic Messages API proxy tuned for Hermes.

It reads Claude Code credentials, rewrites Hermes system prompts into the Claude Code billing shape, and forwards Anthropic requests with Claude Code-compatible headers.

## What It Does

- Listens on `127.0.0.1:4524` by default.
- Reads credentials from `~/.claude/.credentials.json`, macOS Keychain, or `ANTHROPIC_TOKEN`.
- Uses `AUTH_HEADER_FORMAT=auto` by default:
  - `sk-ant-api*` -> `x-api-key`
  - `sk-ant-*`, `cc-*`, `eyJ*` -> `Authorization: Bearer`
- Rewrites `/v1/messages` and `/v1/messages/count_tokens` to exactly two system blocks: Claude Code preamble plus billing header.
- Sanitizes high-confidence Hermes identity strings in system prompts and tool descriptions.
- Audits rewritten requests for remaining Hermes-specific paths, env vars, and tool labels.
- Strips Hermes `thinking` fields by default for classifier compatibility.
- Normalizes Claude Code-like body shape by dropping `temperature`, dropping `tool_choice:auto`, and collapsing text-only content arrays to strings.
- Moves Hermes' original system content into the first user message as `<system>...</system>`.
- Desanitizes successful Anthropic responses before returning them to Hermes.
- Forwards other `/v1/*` endpoints to Anthropic.
- Exposes `/health`, `/ready`, and `/version`.

## Install

```bash
git clone https://github.com/wiziswiz/hermes-claude-proxy.git
cd hermes-claude-proxy
npm install
npm test
```

## Run

```bash
npm start
```

Equivalent:

```bash
node index.js --host 127.0.0.1 --port 4524
```

The default run mode is the validated Hermes-compatible production shape: all current Hermes tool groups, compact tool schemas, neutral upstream tool names, and request dumps disabled unless debug is enabled.

Useful flags:

```bash
node index.js --debug
node index.js --dump-requests
node index.js --port 4525
node index.js --credentials-path ~/.claude/.credentials.json
node index.js --auth-header-format auto
node index.js --no-sanitize-hermes
node index.js --no-strip-thinking
node index.js --no-normalize-shape
node index.js --drop-tools
node index.js --tool-mode core
node index.js --tool-schema-mode compact
node index.js --tool-name-mode neutral
node index.js --tool-groups core,browser
node index.js --tool-allowlist mcp_terminal,mcp_read_file,mcp_search_files
node index.js --drop-system-context
node index.js --strict-leak-check
node index.js --help
```

## Hermes Config

Point Hermes at the proxy:

```yaml
model:
  provider: anthropic
  base_url: http://127.0.0.1:4524
  default: claude-opus-4-8
```

Do not set `api_key: dummy`. Let Hermes resolve your real Claude Code OAuth credential, or configure the real token through Hermes' normal Anthropic setup. Hermes uses the token shape to enable its own OAuth-specific Claude Code transforms before the request reaches this proxy.

## Health Checks

```bash
curl -s http://127.0.0.1:4524/health | jq
curl -s http://127.0.0.1:4524/ready | jq
```

`/health` reports token source, token type, expiry, refreshability, selected auth format, and session id. `/ready` returns HTTP 200 only when a non-expired token is loaded.

## Debug Dumps

Run:

```bash
DEBUG=1 node index.js
```

Request dumps go to `/tmp/hermes-claude-proxy` by default:

```text
request-<id>-meta.json
request-<id>-original.json
request-<id>-sanitized.json
request-<id>-rewritten.json
```

The rewritten file should show `system` as exactly two blocks with the billing header at index `1`.

The sanitizer intentionally has two tiers:

- It rewrites high-confidence identity strings such as `Hermes Agent`, `hermes-agent`, `Nous Research`, and Hermes docs URLs.
- It rewrites Hermes runtime labels such as `~/.hermes`, `HERMES_HOME`, `session_search`, `skill_manage`, `delegate_task`, and `heartbeat` in the upstream request.
- It also rewrites imported OpenClaw labels and renames sensitive Hermes tool names such as `mcp_session_search`, `mcp_skill_manage`, and `mcp_delegate_task`.
- It desanitizes successful responses so Hermes receives its original runtime labels again.
- It audits remaining Hermes/OpenClaw labels before forwarding.

If you want the proxy to reject requests that still contain non-info leak findings before contacting Anthropic, run with:

```bash
STRICT_LEAK_CHECK=1 node index.js
```

Tool compatibility modes:

- `TOOL_MODE=all`: forward every sanitized Hermes tool definition unless `TOOL_GROUPS` or `TOOL_ALLOWLIST` is set.
- `TOOL_MODE=core`: keep only terminal/code/process/read/search/patch/write/todo tools.
- `TOOL_MODE=none` or `DROP_TOOLS=1`: remove all tools.
- `TOOL_SCHEMA_MODE=compact`: keep all selected tools, but replace long tool descriptions with short neutral descriptions and strip nested schema descriptions. This is the default.
- `TOOL_NAME_MODE=neutral`: rename tool names in transit and restore them before Hermes sees tool calls. This is the default.
- `TOOL_GROUPS=core,browser`: keep named groups. Available groups: `core`, `browser`, `desktop`, `automation`, `memory`, `skills`, `media`, `comms`, `search`.
- `TOOL_ALLOWLIST=mcp_terminal,mcp_read_file`: keep exactly the listed tools. Original names such as `mcp_session_search` are accepted and normalized before matching. When set, it overrides `TOOL_GROUPS`.

To audit a debug dump manually:

```bash
rg -n -i 'Hermes Agent|hermes-agent|Nous Research|nousresearch|\\.hermes|HERMES_|kanban_|session_search|skill_manage|delegate_task|heartbeat|SOUL\\.md' /tmp/hermes-claude-proxy/request-*-rewritten.json
```

## Environment

See `.env.example`.

Common variables:

- `PORT`: listener port, default `4524`
- `HOST`: listener host, default `127.0.0.1`
- `AUTH_HEADER_FORMAT`: `auto`, `bearer`, or `x-api-key`
- `CREDENTIALS_PATH`: Claude credentials file path
- `ANTHROPIC_TOKEN`: direct token override
- `ANTHROPIC_BASE_URL`: upstream Anthropic URL
- `DEBUG`: enables debug logs and request dumps
- `JSON_LOGS`: emits structured JSON logs
- `DUMP_REQUESTS`: writes per-request debug dumps
- `DUMP_DIR`: request dump directory
- `SANITIZE_HERMES`: enables Hermes identity sanitization, default `1`
- `STRICT_LEAK_CHECK`: rejects requests with non-info leak findings, default `0`
- `STRIP_THINKING`: removes Hermes `thinking`, `budget_tokens`, and `output_config` fields, default `1`
- `NORMALIZE_SHAPE`: removes `temperature`, removes `tool_choice:auto`, and collapses text-only content arrays, default `1`
- `DROP_TOOLS`: diagnostic mode that removes all tool definitions, default `0`
- `TOOL_MODE`: tool compatibility mode, `all`, `core`, or `none`, default `all`
- `TOOL_SCHEMA_MODE`: `full` or `compact`; compact keeps tool availability while reducing classifier-visible description text, default `compact`
- `TOOL_NAME_MODE`: `preserve` or `neutral`; neutral maps `mcp_*` tool names to less identifying aliases upstream and restores them in responses, default `neutral`
- `TOOL_GROUPS`: comma-separated group names to keep, default `core,browser,media,comms,search,memory,skills,desktop,automation`
- `TOOL_ALLOWLIST`: comma-separated tool names to keep after sanitization, overrides `all`/`core` filtering when set
- `DROP_SYSTEM_CONTEXT`: diagnostic mode that does not move Hermes' original system context into the user message, default `0`
- `STARTUP_VALIDATE`: refresh expired credentials at startup
- `REQUIRE_TOKEN_AT_STARTUP`: exit if no valid token is available

## Background Service

macOS launchd:

```bash
scripts/install-launchd.sh
launchctl print gui/$(id -u)/ai.wiz.hermes-claude-proxy
```

Logs default to:

```text
~/Library/Logs/hermes-claude-proxy/stdout.log
~/Library/Logs/hermes-claude-proxy/stderr.log
```

Linux systemd example:

```text
contrib/systemd/hermes-claude-proxy.service
```

Adjust `WorkingDirectory`, `ExecStart`, and `CREDENTIALS_PATH` before installing it.

## Troubleshooting

If Hermes still gets "out of extra usage":

- Confirm Hermes is using `base_url: http://127.0.0.1:4524`.
- Remove `api_key: dummy` from Hermes config.
- Check `curl -s http://127.0.0.1:4524/ready`.
- Run with `DEBUG=1` and inspect the rewritten request dump.
- Confirm the rewritten request has exactly two system blocks and `cc_entrypoint=cli`.
- Check `request-<id>-meta.json` for `sanitizer.leak_summary`.
- If dropping tools fixes the request but full tools fail, try `TOOL_MODE=core` first. If that passes, add tools back with `TOOL_ALLOWLIST`.
- If you need Hermes thinking mode for testing, run with `STRIP_THINKING=0`.
- Check proxy logs for `overage_reason`, `tier`, and upstream status.

## Development

```bash
npm run check
npm test
```

The tests cover config parsing, auth header auto-detection, credential normalization, request rewrite behavior, Hermes sanitization, leak auditing, and proxy route classification.
