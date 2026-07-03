const assert = require('node:assert/strict');
const test = require('node:test');
const { buildTargetUrl, shouldRewriteBody, stripAnthropicPrefix, summarizeSystem } = require('../src/proxy');

function req(method, path, body = {}) {
  return { method, path, body };
}

test('shouldRewriteBody covers messages and count_tokens', () => {
  assert.equal(shouldRewriteBody(req('POST', '/v1/messages')), true);
  assert.equal(shouldRewriteBody(req('POST', '/v1/messages/count_tokens')), true);
  assert.equal(shouldRewriteBody(req('GET', '/v1/messages')), false);
  assert.equal(shouldRewriteBody(req('POST', '/v1/models')), false);
});

test('stripAnthropicPrefix strips the /anthropic mount prefix', () => {
  const cases = [
    ['/anthropic/v1/messages', '/v1/messages'],
    ['/anthropic/v1/messages?beta=true', '/v1/messages?beta=true'],
    ['/anthropic', '/'],
    ['/v1/messages', '/v1/messages'],
    ['/anthropic-other/v1/messages', '/anthropic-other/v1/messages'],
  ];
  for (const [input, expected] of cases) {
    const req = { url: input };
    stripAnthropicPrefix(req, {}, () => {});
    assert.equal(req.url, expected, `input: ${input}`);
  }
});

test('buildTargetUrl uses the rewritten url, not originalUrl', () => {
  const config = { anthropicBaseUrl: 'https://api.anthropic.com' };
  const req = {
    url: '/v1/messages',
    originalUrl: '/anthropic/v1/messages',
    path: '/v1/messages',
  };
  const target = buildTargetUrl(config, req);
  assert.equal(target.pathname, '/v1/messages');
  assert.equal(target.searchParams.get('beta'), 'true');
});

test('summarizeSystem reports billing header location', () => {
  const summary = summarizeSystem([
    { type: 'text', text: 'x-anthropic-billing-header: test' },
    { type: 'text', text: 'You are Claude Code, test' },
  ]);

  assert.match(summary, /blocks\[2\]/);
  assert.match(summary, /billing@0/);
});
