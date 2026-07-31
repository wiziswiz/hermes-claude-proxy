const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const {
  buildTargetUrl,
  createProxyApp,
  isUpstreamTimeoutError,
  makeRequest,
  shouldRewriteBody,
  stripAnthropicPrefix,
  summarizeSystem,
} = require('../src/proxy');

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

test('isUpstreamTimeoutError classifies tagged and message-based timeouts', () => {
  assert.equal(isUpstreamTimeoutError(Object.assign(new Error('x'), { code: 'ETIMEDOUT' })), true);
  assert.equal(isUpstreamTimeoutError(Object.assign(new Error('x'), { code: 'ESOCKETTIMEDOUT' })), true);
  assert.equal(isUpstreamTimeoutError(new Error('upstream timeout after 50ms')), true);
  assert.equal(isUpstreamTimeoutError(new Error('socket hang up')), false);
  assert.equal(isUpstreamTimeoutError(null), false);
});

test('makeRequest rejects with upstream timeout error', async (t) => {
  const server = http.createServer(() => {});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const { port } = server.address();
  const url = new URL(`http://127.0.0.1:${port}/v1/messages`);
  await assert.rejects(
    () => makeRequest(
      url,
      'POST',
      { 'content-type': 'application/json' },
      JSON.stringify({ test: 1 }),
      50
    ),
    /timeout|socket hang up/i
  );
});

// --- upstream response lifecycle (timeout / truncation) integration tests ---

function createLoggerStub() {
  const entries = [];
  const push = level => (event, message, details) => entries.push({ level, event, message, details });
  return {
    entries,
    debug: push('debug'),
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
  };
}

function createCredentialsStub() {
  return {
    getAccessToken: async () => 'test-access-token',
    forceRefresh: async () => ({ accessToken: 'test-access-token' }),
    getStatus: () => ({ ready: true, token_loaded: true }),
    cachedCredentials: { accessToken: 'test-access-token' },
  };
}

function lifecycleConfig(upstreamPort, overrides = {}) {
  return {
    version: 'test',
    bodyLimit: '1mb',
    debug: false,
    dumpRequests: false,
    sanitizeHermes: true,
    identitySanitization: true,
    leakAudit: false,
    strictLeakCheck: false,
    stripThinking: true,
    normalizeShape: true,
    dropTools: false,
    toolMode: 'all',
    toolSchemaMode: 'compact',
    toolNameMode: 'preserve',
    toolGroups: [],
    toolAllowlist: [],
    dropSystemContext: false,
    anthropicBaseUrl: `http://127.0.0.1:${upstreamPort}`,
    authHeaderFormat: 'bearer',
    maxRetries: 0,
    retryBaseMs: 1,
    requestTimeoutMs: 200,
    ...overrides,
  };
}

async function listenEphemeral(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (server.closeAllConnections) server.closeAllConnections();
    server.close(() => resolve());
  });
}

async function startProxyPair(t, upstreamHandler, configOverrides = {}) {
  const upstream = http.createServer(upstreamHandler);
  const upstreamPort = await listenEphemeral(upstream);
  const logger = createLoggerStub();
  const { app } = createProxyApp({
    config: lifecycleConfig(upstreamPort, configOverrides),
    logger,
    credentials: createCredentialsStub(),
  });
  const proxyServer = http.createServer(app);
  const proxyPort = await listenEphemeral(proxyServer);
  t.after(() => closeServer(proxyServer));
  t.after(() => closeServer(upstream));
  return { proxyPort, logger };
}

function postMessages(port) {
  const payload = JSON.stringify({
    model: 'claude-3-5-haiku-20241022',
    stream: true,
    messages: [{ role: 'user', content: 'hi' }],
  });
  return new Promise((resolve, reject) => {
    let sawResponse = false;
    const clientReq = http.request({
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: '/v1/messages',
      agent: false,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    }, (clientRes) => {
      sawResponse = true;
      const chunks = [];
      let streamError = null;
      clientRes.on('data', chunk => chunks.push(chunk));
      clientRes.on('error', (err) => { streamError = streamError || err; });
      clientRes.on('close', () => resolve({
        statusCode: clientRes.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
        complete: clientRes.complete,
        streamError,
      }));
    });
    // After headers arrive, socket failures surface on the response ('close'
    // with complete=false); only pre-response failures should reject.
    clientReq.on('error', (err) => { if (!sawResponse) reject(err); });
    clientReq.end(payload);
  });
}

test('upstream timeout before headers returns 504 gateway_timeout', async (t) => {
  const { proxyPort, logger } = await startProxyPair(t, () => {
    // Never respond: inactivity timeout fires before headers.
  }, { requestTimeoutMs: 100 });

  const result = await postMessages(proxyPort);
  assert.equal(result.statusCode, 504);
  assert.equal(result.complete, true);
  const parsed = JSON.parse(result.body);
  assert.equal(parsed.error.type, 'gateway_timeout');
  assert.match(parsed.error.message, /timeout/i);

  const failed = logger.entries.find(entry => entry.event === 'request.failed');
  assert.ok(failed, 'expected request.failed log entry');
  assert.equal(failed.details.timeout, true);
});

test('mid-stream SSE timeout destroys downstream connection (sanitize ON)', async (t) => {
  const { proxyPort, logger } = await startProxyPair(t, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('event: message_start\ndata: {"type":"message_start"}\n\n');
    // Go idle: inactivity timeout must fire mid-stream.
  }, { requestTimeoutMs: 150, sanitizeHermes: true });

  const result = await postMessages(proxyPort);
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /message_start/);
  assert.equal(result.complete, false, 'truncated stream must not end as a clean EOF');

  const failed = logger.entries.find(entry => entry.event === 'upstream.stream_failed');
  assert.ok(failed, 'expected upstream.stream_failed log entry');
  assert.equal(failed.details.timeout, true);
  assert.ok(failed.details.request_id);
});

test('mid-stream SSE timeout destroys downstream connection (sanitize OFF, raw pipe)', async (t) => {
  const { proxyPort, logger } = await startProxyPair(t, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('event: message_start\ndata: {"type":"message_start"}\n\n');
    // Go idle: pipe() does not forward source errors; the proxy must.
  }, { requestTimeoutMs: 150, sanitizeHermes: false });

  const result = await postMessages(proxyPort);
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /message_start/);
  assert.equal(result.complete, false, 'truncated pipe must not end as a clean EOF or hang');

  const failed = logger.entries.find(entry => entry.event === 'upstream.stream_failed');
  assert.ok(failed, 'expected upstream.stream_failed log entry');
  assert.equal(failed.details.timeout, true);
});

test('actively streaming SSE longer than the timeout keeps flowing', async (t) => {
  const totalChunks = 6;
  const { proxyPort, logger } = await startProxyPair(t, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    let sent = 0;
    const interval = setInterval(() => {
      sent += 1;
      res.write(`event: content_block_delta\ndata: {"seq":${sent}}\n\n`);
      if (sent >= totalChunks) {
        clearInterval(interval);
        res.end();
      }
    }, 50);
    res.on('close', () => clearInterval(interval));
  }, { requestTimeoutMs: 150 });

  // 6 chunks x 50ms = 300ms total > 150ms timeout: inactivity semantics only.
  const result = await postMessages(proxyPort);
  assert.equal(result.statusCode, 200);
  assert.equal(result.complete, true);
  for (let seq = 1; seq <= totalChunks; seq += 1) {
    assert.match(result.body, new RegExp(`"seq":${seq}`));
  }
  assert.equal(
    logger.entries.find(entry => entry.event === 'upstream.stream_failed'),
    undefined
  );
});
