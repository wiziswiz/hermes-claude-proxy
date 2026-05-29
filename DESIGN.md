# Design

## Problem Statement

Anthropic only routes requests to the Claude Max plan when the request matches a very specific fingerprint:

- System block 0 starts with "You are Claude Code..."
- Exactly two system blocks: [preamble, billing-header]
- No extra system blocks that reveal third-party identity
- Certain tool names, paths, and headers must not leak

Hermes violates several of these assumptions, causing consistent “You’re out of extra usage” errors.

## Key Differences vs OpenClaw

| Aspect              | OpenClaw                     | Hermes                          |
|---------------------|------------------------------|---------------------------------|
| System blocks       | Often starts with preamble   | Multiple custom blocks          |
| Thinking mode       | Rarely used                  | Frequently enabled              |
| Tool volume         | Moderate                     | Can be very high (30–50+)       |
| Request predictability | Higher                    | More variable                   |

## Core Strategy

1. **Aggressive system normalization**  
   Always enforce exactly `[CC-preamble, billing-header]`. Move everything else into the first user message as `<system>` context.

2. **Thinking mode support**  
   Properly handle the `thinking` parameter without breaking classification.

3. **Minimal assumptions**  
   Do not rely on the first system block containing the Claude Code preamble.

4. **Observability**  
   When billing classification fails, log exactly what was sent.

## Non-Goals (v1)

- Supporting arbitrary third-party clients
- Heavy tool name rewriting (optional only)
- OpenClaw-style path aliasing

## Open Questions

- How aggressive should system stripping be?
- Should thinking mode be rewritten or disabled by default?
- Do we need any Hermes-specific tool normalization?