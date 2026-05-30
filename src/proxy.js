const express = require('express');
const http = require('http');
const https = require('https');
const { randomUUID } = require('crypto');
const { buildAnthropicHeaders, resolveAuthHeaderFormat } = require('./auth');
const { createRequestDumper } = require('./debug-dump');
const { rewriteSystemForBillingClassifier } = require('./rewrite');
const {
  auditHermesLeaks,
  desanitizeResponseJson,
  desanitizeSseLine,
  sanitizeRequest,
  summarizeFindings,
} = require('./sanitizer');

function makeRequest(targetUrl, method, headers, payload) {
  return new Promise((resolve, reject) => {
    const transport = targetUrl.protocol === 'https:' ? https : http;
    const proxyReq = transport.request(targetUrl, { method, headers }, (proxyRes) => {
      if (proxyRes.statusCode >= 400) {
        const chunks = [];
        proxyRes.on('data', chunk => chunks.push(chunk));
        proxyRes.on('end', () => {
          resolve({ proxyRes, body: Buffer.concat(chunks).toString('utf8') });
        });
        return;
      }

      resolve({ proxyRes, body: null });
    });

    proxyReq.on('error', reject);
    if (payload) proxyReq.write(payload);
    proxyReq.end();
  });
}

function copyResponseHeaders(proxyRes, res, body) {
  const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-length']);
  for (const [key, value] of Object.entries(proxyRes.headers)) {
    if (!skipHeaders.has(key.toLowerCase())) res.setHeader(key, value);
  }
  if (body !== null && body !== undefined) res.setHeader('content-length', Buffer.byteLength(body));
}

function summarizeSystem(system) {
  if (!system) return 'no-system';
  if (typeof system === 'string') return `string:${system.slice(0, 32)}`;
  if (!Array.isArray(system)) return typeof system;

  const billingPos = system.findIndex(b => b.type === 'text' && b.text?.startsWith('x-anthropic-billing-header:'));
  const preview = system
    .map((b, i) => `[${i}]${(b.text || b.type || '?').slice(0, 24).replace(/\n/g, ' ')}`)
    .join(' ');
  return `blocks[${system.length}] billing@${billingPos}: ${preview}`;
}

function shouldRewriteBody(req) {
  return req.method === 'POST'
    && (req.path === '/v1/messages' || req.path === '/v1/messages/count_tokens')
    && req.body
    && typeof req.body === 'object';
}

function buildTargetUrl(config, req) {
  const base = new URL(config.anthropicBaseUrl);
  const target = new URL(req.originalUrl, base.origin);
  if (req.path === '/v1/messages' || req.path === '/v1/messages/count_tokens') {
    target.searchParams.set('beta', 'true');
  }
  return target;
}

function formatLeakFindingsForLog(findings, includeSamples = false) {
  return findings.map(finding => {
    if (includeSamples) return finding;
    const { sample, ...withoutSample } = finding;
    return withoutSample;
  });
}

function sendSuccessfulResponse(proxyRes, req, res, shouldDesanitize) {
  copyResponseHeaders(proxyRes, res);
  res.status(proxyRes.statusCode);

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  if (!shouldDesanitize) {
    proxyRes.pipe(res);
    return;
  }

  const contentType = proxyRes.headers['content-type'] || '';
  const isSse = contentType.includes('text/event-stream');

  if (isSse) {
    let buffer = '';
    proxyRes.setEncoding('utf8');
    proxyRes.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        res.write(`${desanitizeSseLine(line)}\n`);
      }
    });
    proxyRes.on('end', () => {
      if (buffer) res.write(`${desanitizeSseLine(buffer)}\n`);
      res.end();
    });
    proxyRes.on('error', () => res.end());
    return;
  }

  const chunks = [];
  proxyRes.on('data', chunk => chunks.push(chunk));
  proxyRes.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    try {
      const out = JSON.stringify(desanitizeResponseJson(JSON.parse(raw)));
      res.setHeader('content-length', Buffer.byteLength(out));
      res.end(out);
    } catch {
      res.end(raw);
    }
  });
  proxyRes.on('error', () => res.end());
}

function createProxyApp({ config, logger, credentials }) {
  const app = express();
  const dumper = createRequestDumper(config, logger);
  let proxySessionId = randomUUID();

  app.disable('x-powered-by');
  app.use(express.json({ limit: config.bodyLimit }));

  async function forwardAnthropicRequest(req, res) {
    const requestId = randomUUID();
    res.setHeader('x-hermes-proxy-request-id', requestId);

    try {
      let body = ['GET', 'HEAD'].includes(req.method) ? null : req.body;
      let sanitized = body;
      let sanitizerReport = { changed: false, replacements: [] };
      let leakFindings = [];
      let rewritten = body;
      if (shouldRewriteBody(req)) {
        if (config.sanitizeHermes) {
          const sanitizedResult = sanitizeRequest(body, {
            identitySanitization: config.identitySanitization,
            stripThinking: config.stripThinking,
            normalizeShape: config.normalizeShape,
            dropTools: config.dropTools,
            toolMode: config.toolMode,
            toolSchemaMode: config.toolSchemaMode,
            toolNameMode: config.toolNameMode,
            toolGroups: config.toolGroups,
            toolAllowlist: config.toolAllowlist,
          });
          sanitized = sanitizedResult.body;
          sanitizerReport = sanitizedResult.report;
        }
        rewritten = rewriteSystemForBillingClassifier(sanitized, {
          sessionId: proxySessionId,
          dropExtraSystem: config.dropSystemContext,
        });
        if (config.leakAudit || config.strictLeakCheck) {
          leakFindings = auditHermesLeaks(rewritten);
        }
      }

      let payload = rewritten ? JSON.stringify(rewritten) : undefined;
      const accessToken = await credentials.getAccessToken();
      const targetUrl = buildTargetUrl(config, req);

      const meta = {
        request_id: requestId,
        ts: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        target: targetUrl.toString(),
        model: rewritten?.model || null,
        stream: !!rewritten?.stream,
        messages: rewritten?.messages?.length || 0,
        tools: rewritten?.tools?.length || 0,
        thinking: !!(rewritten?.thinking?.type || rewritten?.budget_tokens || rewritten?.output_config),
        system: summarizeSystem(rewritten?.system),
        auth_header_format: resolveAuthHeaderFormat(config.authHeaderFormat, accessToken),
        session_id: proxySessionId.slice(0, 8),
        sanitizer: shouldRewriteBody(req) ? {
          enabled: config.sanitizeHermes,
          identity_sanitization: config.identitySanitization,
          leak_audit: config.leakAudit,
          strict: config.strictLeakCheck,
          strip_thinking: config.stripThinking,
          normalize_shape: config.normalizeShape,
          drop_tools: config.dropTools,
          tool_mode: config.toolMode,
          tool_schema_mode: config.toolSchemaMode,
          tool_name_mode: config.toolNameMode,
          tool_groups: config.toolGroups,
          tool_allowlist: config.toolAllowlist,
          drop_system_context: config.dropSystemContext,
          changed: sanitizerReport.changed,
          replacements: sanitizerReport.replacements,
          normalizations: sanitizerReport.normalizations,
          leak_count: leakFindings.length,
          leak_summary: summarizeFindings(leakFindings),
        } : null,
      };

      logger.info('request.incoming', `${req.method} ${req.originalUrl}`, meta);
      if (shouldRewriteBody(req)) {
        if (leakFindings.length > 0) {
          logger.warn('sanitizer.leaks', 'Hermes-specific request labels remain after sanitization', {
            request_id: requestId,
            leak_count: leakFindings.length,
            leak_summary: summarizeFindings(leakFindings),
            findings: formatLeakFindingsForLog(leakFindings.slice(0, 10), config.debug),
          });
        }

        dumper.dump(requestId, { meta, original: body, sanitized, rewritten });

        const blockingLeaks = leakFindings.filter(finding => finding.severity !== 'info');
        if (config.strictLeakCheck && blockingLeaks.length > 0) {
          return res.status(400).json({
            type: 'error',
            error: {
              type: 'proxy_leak_check_failed',
              message: 'Strict leak check rejected the request before upstream forwarding',
            },
            request_id: requestId,
            findings: blockingLeaks.slice(0, 20),
          });
        }
      }

      let currentToken = accessToken;
      let headerResult = buildAnthropicHeaders({
        accessToken: currentToken,
        authHeaderFormat: config.authHeaderFormat,
        payload,
        reqHeaders: req.headers,
        sessionId: proxySessionId,
      });

      for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
        const result = await makeRequest(targetUrl, req.method, headerResult.headers, payload);
        const statusCode = result.proxyRes.statusCode;

        if (statusCode === 401 && attempt < config.maxRetries) {
          if (attempt === 0) {
            logger.warn('upstream.401', 'Refreshing token and rotating session after Anthropic 401', {
              request_id: requestId,
            });
            const freshCreds = await credentials.forceRefresh();
            currentToken = freshCreds.accessToken;
            proxySessionId = randomUUID();
            if (shouldRewriteBody(req)) {
              rewritten = rewriteSystemForBillingClassifier(sanitized, {
                sessionId: proxySessionId,
                dropExtraSystem: config.dropSystemContext,
              });
              payload = JSON.stringify(rewritten);
            }
            headerResult = buildAnthropicHeaders({
              accessToken: currentToken,
              authHeaderFormat: config.authHeaderFormat,
              payload,
              reqHeaders: req.headers,
              sessionId: proxySessionId,
            });
          } else {
            const delayMs = config.retryBaseMs * Math.pow(2, attempt - 1);
            logger.warn('upstream.401_retry', 'Retrying after 401 propagation delay', {
              request_id: requestId,
              attempt: attempt + 1,
              delay_ms: delayMs,
            });
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          continue;
        }

        if (statusCode === 429 && result.proxyRes.headers['x-should-retry'] === 'true' && attempt < config.maxRetries) {
          const retryAfter = result.proxyRes.headers['retry-after'];
          const delayMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : config.retryBaseMs * Math.pow(2, attempt);
          logger.warn('upstream.429_retry', 'Retrying retryable Anthropic 429', {
            request_id: requestId,
            attempt: attempt + 1,
            delay_ms: delayMs,
          });
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        if (statusCode >= 400) {
          logger.warn('upstream.error', 'Anthropic returned an error', {
            request_id: requestId,
            status: statusCode,
            overage: result.proxyRes.headers['anthropic-ratelimit-unified-overage-status'] || '',
            overage_reason: result.proxyRes.headers['anthropic-ratelimit-unified-overage-disabled-reason'] || '',
            tier: result.proxyRes.headers['anthropic-ratelimit-unified-tier'] || '',
            body_preview: String(result.body || '').slice(0, 500),
          });
          copyResponseHeaders(result.proxyRes, res, result.body);
          return res.status(statusCode).end(result.body);
        }

        sendSuccessfulResponse(result.proxyRes, req, res, config.sanitizeHermes);
        return undefined;
      }

      return res.status(502).json({
        type: 'error',
        error: { type: 'proxy_retry_exhausted', message: 'Proxy retry loop exhausted' },
        request_id: requestId,
      });
    } catch (err) {
      logger.error('request.failed', 'Proxy request failed', {
        request_id: requestId,
        error: err.message,
      });
      const status = /credential|token|auth/i.test(err.message) ? 401 : 500;
      return res.status(status).json({
        type: 'error',
        error: { type: status === 401 ? 'proxy_auth_error' : 'proxy_error', message: err.message },
        request_id: requestId,
      });
    }
  }

  app.get('/', (req, res) => {
    res.json({
      name: 'hermes-claude-proxy',
      version: config.version,
      health: '/health',
      ready: '/ready',
    });
  });

  app.get('/health', (req, res) => {
    const token = credentials.getStatus();
    res.json({
      status: token.ready ? 'ok' : 'degraded',
      version: config.version,
      host: config.host,
      port: config.port,
      auth_header_format: config.authHeaderFormat,
      sanitize_hermes: config.sanitizeHermes,
      identity_sanitization: config.identitySanitization,
      leak_audit: config.leakAudit,
      strict_leak_check: config.strictLeakCheck,
      strip_thinking: config.stripThinking,
      normalize_shape: config.normalizeShape,
      drop_tools: config.dropTools,
      tool_mode: config.toolMode,
      tool_schema_mode: config.toolSchemaMode,
      tool_name_mode: config.toolNameMode,
      tool_groups: config.toolGroups,
      tool_allowlist: config.toolAllowlist,
      drop_system_context: config.dropSystemContext,
      resolved_auth_header_format: token.token_loaded
        ? resolveAuthHeaderFormat(config.authHeaderFormat, credentials.cachedCredentials?.accessToken)
        : null,
      session_id: proxySessionId.slice(0, 8),
      token,
    });
  });

  app.get('/ready', (req, res) => {
    const token = credentials.getStatus();
    res.status(token.ready ? 200 : 503).json({
      ready: token.ready,
      token,
    });
  });

  app.get('/version', (req, res) => {
    res.json({ version: config.version });
  });

  app.all('/v1/*', forwardAnthropicRequest);

  app.use((err, req, res, next) => {
    if (!err) return next();
    logger.warn('request.invalid_json', 'Invalid request body', { error: err.message });
    return res.status(400).json({
      type: 'error',
      error: { type: 'invalid_request_error', message: err.message },
    });
  });

  return { app, getSessionId: () => proxySessionId };
}

module.exports = {
  createProxyApp,
  makeRequest,
  shouldRewriteBody,
  summarizeSystem,
};
