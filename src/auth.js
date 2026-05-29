const REQUIRED_BETAS = [
  'claude-code-20250219',
  'oauth-2025-04-20',
  'interleaved-thinking-2025-05-14',
  'context-management-2025-06-27',
  'prompt-caching-scope-2026-01-05',
  'effort-2025-11-24',
];

function detectTokenType(token) {
  if (!token || typeof token !== 'string') return 'none';
  if (token.startsWith('sk-ant-api')) return 'api-key';
  if (token.startsWith('sk-ant-')) return 'oauth';
  if (token.startsWith('cc-')) return 'claude-code-oauth';
  if (token.startsWith('eyJ')) return 'jwt-oauth';
  return 'unknown';
}

function resolveAuthHeaderFormat(configuredFormat, token) {
  const configured = String(configuredFormat || 'auto').toLowerCase();
  if (configured === 'bearer' || configured === 'x-api-key') return configured;
  if (configured !== 'auto') throw new Error(`Unsupported auth header format: ${configuredFormat}`);

  return detectTokenType(token) === 'api-key' ? 'x-api-key' : 'bearer';
}

function buildAnthropicHeaders(options) {
  const {
    accessToken,
    authHeaderFormat,
    payload,
    reqHeaders = {},
    sessionId,
  } = options;

  const resolvedAuthFormat = resolveAuthHeaderFormat(authHeaderFormat, accessToken);
  const authHeader = resolvedAuthFormat === 'bearer'
    ? { authorization: `Bearer ${accessToken}` }
    : { 'x-api-key': accessToken };

  const headers = {
    ...authHeader,
    'content-type': 'application/json',
    'anthropic-version': reqHeaders['anthropic-version'] || '2023-06-01',
    'anthropic-client-platform': 'cli',
    'user-agent': 'Anthropic/JS 0.80.0',
    'x-claude-code-session-id': sessionId,
    'x-stainless-lang': 'js',
    'x-stainless-package-version': '0.80.0',
    'x-stainless-os': process.platform,
    'x-stainless-arch': process.arch,
    'x-stainless-runtime': 'node',
    'x-stainless-runtime-version': process.versions.node,
  };

  const clientBetas = reqHeaders['anthropic-beta']
    ? reqHeaders['anthropic-beta'].split(',').map(b => b.trim()).filter(Boolean)
    : [];
  headers['anthropic-beta'] = [...new Set([...REQUIRED_BETAS, ...clientBetas])].join(',');

  if (payload) headers['content-length'] = Buffer.byteLength(payload);

  return { headers, resolvedAuthFormat };
}

module.exports = {
  REQUIRED_BETAS,
  buildAnthropicHeaders,
  detectTokenType,
  resolveAuthHeaderFormat,
};
