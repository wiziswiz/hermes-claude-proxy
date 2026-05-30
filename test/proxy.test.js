const assert = require('node:assert/strict');
const test = require('node:test');
const { shouldRewriteBody, summarizeSystem } = require('../src/proxy');

function req(method, path, body = {}) {
  return { method, path, body };
}

test('shouldRewriteBody covers messages and count_tokens', () => {
  assert.equal(shouldRewriteBody(req('POST', '/v1/messages')), true);
  assert.equal(shouldRewriteBody(req('POST', '/v1/messages/count_tokens')), true);
  assert.equal(shouldRewriteBody(req('GET', '/v1/messages')), false);
  assert.equal(shouldRewriteBody(req('POST', '/v1/models')), false);
});

test('summarizeSystem reports billing header location', () => {
  const summary = summarizeSystem([
    { type: 'text', text: 'x-anthropic-billing-header: test' },
    { type: 'text', text: 'You are Claude Code, test' },
  ]);

  assert.match(summary, /blocks\[2\]/);
  assert.match(summary, /billing@0/);
});
