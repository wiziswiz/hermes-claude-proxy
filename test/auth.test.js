const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildAnthropicHeaders,
  detectTokenType,
  resolveAuthHeaderFormat,
} = require('../src/auth');

test('detectTokenType classifies common Anthropic token shapes', () => {
  assert.equal(detectTokenType('sk-ant-api03-abc'), 'api-key');
  assert.equal(detectTokenType('sk-ant-oat01-abc'), 'oauth');
  assert.equal(detectTokenType('cc-abc'), 'claude-code-oauth');
  assert.equal(detectTokenType('eyJabc'), 'jwt-oauth');
  assert.equal(detectTokenType('other'), 'unknown');
});

test('resolveAuthHeaderFormat auto selects x-api-key only for API keys', () => {
  assert.equal(resolveAuthHeaderFormat('auto', 'sk-ant-api03-abc'), 'x-api-key');
  assert.equal(resolveAuthHeaderFormat('auto', 'sk-ant-oat01-abc'), 'bearer');
  assert.equal(resolveAuthHeaderFormat('auto', 'cc-abc'), 'bearer');
  assert.equal(resolveAuthHeaderFormat('bearer', 'sk-ant-api03-abc'), 'bearer');
  assert.equal(resolveAuthHeaderFormat('x-api-key', 'sk-ant-oat01-abc'), 'x-api-key');
});

test('buildAnthropicHeaders emits Claude Code compatible headers', () => {
  const { headers, resolvedAuthFormat } = buildAnthropicHeaders({
    accessToken: 'sk-ant-oat01-test',
    authHeaderFormat: 'auto',
    payload: JSON.stringify({ ok: true }),
    reqHeaders: { 'anthropic-beta': 'custom-beta' },
    sessionId: 'session-123',
  });

  assert.equal(resolvedAuthFormat, 'bearer');
  assert.equal(headers.authorization, 'Bearer sk-ant-oat01-test');
  assert.equal(headers['anthropic-client-platform'], 'cli');
  assert.equal(headers['x-app'], undefined);
  assert.equal(headers['x-claude-code-session-id'], 'session-123');
  assert.equal(headers['anthropic-beta'].split(',')[0], 'claude-code-20250219');
  assert.match(headers['anthropic-beta'], /claude-code-20250219/);
  assert.match(headers['anthropic-beta'], /custom-beta/);
  assert.equal(headers['content-length'], Buffer.byteLength(JSON.stringify({ ok: true })));
});
