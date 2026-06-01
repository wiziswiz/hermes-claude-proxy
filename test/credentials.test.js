const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeCredentials, normalizeExpiresAt, tokenPreview } = require('../src/credentials');

test('normalizeExpiresAt accepts seconds and milliseconds', () => {
  assert.equal(normalizeExpiresAt(1_800_000_000), 1_800_000_000_000);
  assert.equal(normalizeExpiresAt(1_800_000_000_000), 1_800_000_000_000);
  assert.equal(normalizeExpiresAt(''), null);
});

test('normalizeCredentials accepts camelCase and snake_case token fields', () => {
  const creds = normalizeCredentials({
    access_token: 'sk-ant-oat01-test',
    refresh_token: 'refresh',
    expires_at: 1_800_000_000,
  }, 'file');

  assert.equal(creds.accessToken, 'sk-ant-oat01-test');
  assert.equal(creds.refreshToken, 'refresh');
  assert.equal(creds.expiresAt, 1_800_000_000_000);
  assert.equal(creds.source, 'file');
  assert.equal(creds.tokenType, 'oauth');
});

test('normalizeCredentials treats env setup tokens without expiry as non-expiring', () => {
  const creds = normalizeCredentials({
    accessToken: 'sk-ant-oat01-setup-token',
  }, 'env');

  assert.equal(creds.expiresAt, null);
  assert.equal(creds.refreshToken, null);
  assert.equal(creds.nonExpiring, true);
  assert.equal(creds.tokenType, 'oauth');
});

test('tokenPreview keeps only prefix and suffix', () => {
  assert.equal(tokenPreview('sk-ant-oat01-abcdef'), 'sk-ant-o...cdef');
  assert.equal(tokenPreview(null), null);
});
