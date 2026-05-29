# hermes-claude-proxy

A local proxy that lets **Hermes** use your Claude Max subscription by routing Anthropic Messages API requests through Claude Code OAuth credentials.

## Why This Exists

The original `claude-max-proxy` was built around OpenClaw. Hermes sends requests with a different structure (multiple system blocks, thinking mode, richer tool schemas), which causes Anthropic’s billing classifier to reject them as third-party requests — even when the billing header is present.

This project is a **Hermes-first** rewrite designed to reliably pass the first-party Claude Code check.

## Goals

- Make Hermes requests consistently classified as first-party Claude Code sessions
- Handle Hermes’ system prompt structure and thinking mode properly
- Provide clear debugging when classification fails
- Keep the implementation focused and defensive

## Quick Start

```bash
git clone https://github.com/wiziswiz/hermes-claude-proxy.git
cd hermes-claude-proxy
npm install
node index.js
```

Point Hermes at the proxy:

```yaml
model:
  provider: anthropic
  base_url: http://127.0.0.1:4523
  api_key: dummy
  default: claude-opus-4-8
```

## Status

Early development. Not production-ready.

## License

MIT
