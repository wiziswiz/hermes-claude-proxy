const assert = require('node:assert/strict');
const test = require('node:test');
const { buildBillingHeader, rewriteSystemForBillingClassifier } = require('../src/rewrite');

test('rewriteSystemForBillingClassifier forces two clean system blocks', () => {
  const rewritten = rewriteSystemForBillingClassifier({
    system: [
      { type: 'text', text: 'Hermes custom system block' },
      { type: 'text', text: 'Second system block' },
      { type: 'text', text: 'x-anthropic-billing-header: stale' },
    ],
    messages: [{ role: 'user', content: 'hello' }],
  }, { sessionId: 'abcdef12-0000-0000-0000-000000000000' });

  assert.equal(rewritten.system.length, 2);
  assert.match(rewritten.system[0].text, /^You are Claude Code,/);
  assert.equal(rewritten.system[1].text, buildBillingHeader('abcdef12-0000-0000-0000-000000000000'));
  assert.match(rewritten.system[1].text, /cc_entrypoint=cli/);
  assert.match(rewritten.messages[0].content, /Hermes custom system block/);
  assert.match(rewritten.messages[0].content, /Second system block/);
  assert.doesNotMatch(rewritten.messages[0].content, /x-anthropic-billing-header: stale/);
});

test('rewriteSystemForBillingClassifier creates a user message when none exists', () => {
  const rewritten = rewriteSystemForBillingClassifier({
    system: 'single system',
    messages: [],
  }, { sessionId: '12345678' });

  assert.equal(rewritten.messages[0].role, 'user');
  assert.match(rewritten.messages[0].content, /single system/);
});

test('rewriteSystemForBillingClassifier preserves existing Claude Code preamble', () => {
  const rewritten = rewriteSystemForBillingClassifier({
    system: [
      { type: 'text', text: 'You are Claude Code, Anthropic custom.' },
      { type: 'text', text: 'extra app context' },
    ],
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
  }, { sessionId: '12345678' });

  assert.equal(rewritten.system[0].text, 'You are Claude Code, Anthropic custom.');
  assert.match(rewritten.messages[0].content[0].text, /extra app context/);
});

test('rewriteSystemForBillingClassifier can drop extra system context', () => {
  const rewritten = rewriteSystemForBillingClassifier({
    system: [
      { type: 'text', text: 'You are Claude Code, Anthropic custom.' },
      { type: 'text', text: 'extra app context' },
    ],
    messages: [{ role: 'user', content: 'hello' }],
  }, { sessionId: '12345678', dropExtraSystem: true });

  assert.equal(rewritten.system.length, 2);
  assert.equal(rewritten.messages[0].content, 'hello');
  assert.equal(JSON.stringify(rewritten.messages).includes('extra app context'), false);
});
