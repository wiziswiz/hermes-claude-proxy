#!/usr/bin/env node

const { readConfig, usage } = require('./src/config');
const { CredentialManager } = require('./src/credentials');
const { createLogger } = require('./src/logger');
const { createProxyApp } = require('./src/proxy');

async function main(argv = process.argv.slice(2), env = process.env) {
  const config = readConfig(argv, env);

  if (config.help) {
    process.stdout.write(usage());
    return null;
  }

  if (config.versionOnly) {
    process.stdout.write(`${config.version}\n`);
    return null;
  }

  const logger = createLogger({ debug: config.debug, jsonLogs: config.jsonLogs });
  const credentials = new CredentialManager(config, logger);

  try {
    await credentials.initialize();
  } catch (err) {
    logger.error('startup.credentials', 'Credential initialization failed', { error: err.message });
    if (config.requireTokenAtStartup) throw err;
  }

  const status = credentials.getStatus();
  if (!status.ready) {
    const message = 'Proxy is starting without a currently valid token';
    if (config.requireTokenAtStartup) throw new Error(`${message}: ${status.last_error || 'token not ready'}`);
    logger.warn('startup.not_ready', message, { token: status });
  }

  const { app } = createProxyApp({ config, logger, credentials });
  const server = app.listen(config.port, config.host, () => {
    logger.info('startup.listen', 'Hermes Claude Proxy listening', {
      host: config.host,
      port: config.port,
      version: config.version,
      auth_header_format: config.authHeaderFormat,
      sanitize_hermes: config.sanitizeHermes,
      identity_sanitization: config.identitySanitization,
      leak_audit: config.leakAudit,
      tool_mode: config.toolMode,
      tool_schema_mode: config.toolSchemaMode,
      tool_name_mode: config.toolNameMode,
      tool_groups: config.toolGroups,
      tool_allowlist: config.toolAllowlist,
      debug: config.debug,
      dump_requests: config.dumpRequests,
    });
  });

  function shutdown(signal) {
    logger.info('shutdown.signal', 'Shutting down', { signal });
    credentials.stop();
    server.close(() => {
      logger.info('shutdown.complete', 'Server closed');
      process.exit(0);
    });
  }

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return { server, credentials, config };
}

if (require.main === module) {
  main().catch(err => {
    const logger = createLogger({ debug: process.env.DEBUG === '1' || process.env.DEBUG === 'true' });
    logger.error('startup.failed', 'Fatal startup error', { error: err.message });
    process.exit(1);
  });
}

module.exports = { main };
