const REQUIRED_BETAS = [
  'claude-code-20250219',
  'oauth-2025-04-20',
  'interleaved-thinking-2025-05-14',
  'context-management-2025-06-27',
  'prompt-caching-scope-2026-01-05',
  'advisor-tool-2026-03-01',
  'effort-2025-11-24',
];

const STAINLESS_PACKAGE_VERSION = process.env.CLAUDE_CODE_STAINLESS_PACKAGE_VERSION || '0.81.0';
const STAINLESS_RUNTIME_VERSION = process.env.CLAUDE_CODE_STAINLESS_RUNTIME_VERSION || 'v22.11.0';

function stainlessArch() {
  const machine = (process.arch || '').toLowerCase();
  if (machine === 'x64') return 'x64';
  if (machine === 'arm64') return 'arm64';
  if (machine === 'ia32') return 'ia32';
  return machine || 'unknown';
}

function stainlessOs() {
  if (process.platform === 'darwin') return 'MacOS';
  if (process.platform === 'linux') return 'Linux';
  if (process.platform === 'win32') return 'Windows';
  return process.platform || 'Unknown';
}

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
    'anthropic-dangerous-direct-browser-access': 'true',
    'anthropic-client-platform': 'cli',
    'user-agent': `Anthropic/JS ${STAINLESS_PACKAGE_VERSION}`,
    'x-claude-code-session-id': sessionId,
    'x-stainless-lang': 'js',
    'x-stainless-package-version': STAINLESS_PACKAGE_VERSION,
    'x-stainless-os': stainlessOs(),
    'x-stainless-arch': stainlessArch(),
    'x-stainless-retry-count': '0',
    'x-stainless-runtime': 'node',
    'x-stainless-runtime-version': STAINLESS_RUNTIME_VERSION,
    'x-stainless-timeout': '600',
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
  stainlessArch,
  stainlessOs,
};
