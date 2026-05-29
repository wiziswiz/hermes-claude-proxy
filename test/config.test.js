const assert = require('node:assert/strict');
const test = require('node:test');
const { DEFAULT_TOOL_GROUPS, parseArgs, readConfig } = require('../src/config');

test('parseArgs handles flags and inline values', () => {
  const args = parseArgs([
    '--port=9999',
    '--debug',
    '--json-logs=false',
    '--dump-requests',
    '--strict-leak-check',
    '--tool-mode',
    'core',
    '--tool-schema-mode',
    'compact',
    '--tool-name-mode',
    'neutral',
    '--tool-groups=core,browser',
    '--tool-allowlist=mcp_terminal,mcp_read_file',
    '--no-sanitize-hermes',
    '--auth-header-format',
    'auto',
    '--credentials-path',
    '/tmp/creds.json',
  ]);

  assert.equal(args.port, '9999');
  assert.equal(args.debug, true);
  assert.equal(args.jsonLogs, false);
  assert.equal(args.dumpRequests, true);
  assert.equal(args.strictLeakCheck, true);
  assert.equal(args.toolMode, 'core');
  assert.equal(args.toolSchemaMode, 'compact');
  assert.equal(args.toolNameMode, 'neutral');
  assert.equal(args.toolGroups, 'core,browser');
  assert.equal(args.toolAllowlist, 'mcp_terminal,mcp_read_file');
  assert.equal(args.sanitizeHermes, false);
  assert.equal(args.authHeaderFormat, 'auto');
  assert.equal(args.credentialsPath, '/tmp/creds.json');
});

test('readConfig prefers CLI values over env values', () => {
  const config = readConfig(['--port', '7777', '--no-debug'], {
    PORT: '8888',
    DEBUG: '1',
    AUTH_HEADER_FORMAT: 'bearer',
  });

  assert.equal(config.port, 7777);
  assert.equal(config.debug, false);
  assert.equal(config.authHeaderFormat, 'bearer');
});

test('readConfig defaults auth header format to auto', () => {
  const config = readConfig([], {});
  assert.equal(config.authHeaderFormat, 'auto');
  assert.equal(config.port, 4524);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.sanitizeHermes, true);
  assert.equal(config.strictLeakCheck, false);
  assert.equal(config.stripThinking, true);
  assert.equal(config.normalizeShape, true);
  assert.equal(config.dropTools, false);
  assert.equal(config.toolMode, 'all');
  assert.equal(config.toolSchemaMode, 'compact');
  assert.equal(config.toolNameMode, 'neutral');
  assert.deepEqual(config.toolGroups, DEFAULT_TOOL_GROUPS);
  assert.deepEqual(config.toolAllowlist, []);
  assert.equal(config.dropSystemContext, false);
});

test('readConfig supports tool compatibility modes', () => {
  const config = readConfig(['--tool-mode', 'core'], {
    TOOL_SCHEMA_MODE: 'compact',
    TOOL_NAME_MODE: 'neutral',
    TOOL_GROUPS: 'core, browser',
    TOOL_ALLOWLIST: 'mcp_terminal, mcp_session_search',
  });

  assert.equal(config.toolMode, 'core');
  assert.equal(config.toolSchemaMode, 'compact');
  assert.equal(config.toolNameMode, 'neutral');
  assert.deepEqual(config.toolGroups, ['core', 'browser']);
  assert.deepEqual(config.toolAllowlist, ['mcp_terminal', 'mcp_session_search']);
});

test('DROP_TOOLS forces tool mode none', () => {
  const config = readConfig([], {
    DROP_TOOLS: '1',
    TOOL_MODE: 'core',
  });

  assert.equal(config.dropTools, true);
  assert.equal(config.toolMode, 'none');
});
