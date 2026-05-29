const TOKEN_RE = /(sk-ant-[A-Za-z0-9._-]+|cc-[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]+)/g;

function redactString(value) {
  return value.replace(TOKEN_RE, token => `${token.slice(0, 8)}...redacted`);
}

function redact(value) {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;

  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (/token|authorization|api[-_]?key|refresh/i.test(key)) {
      result[key] = typeof raw === 'string' ? `${raw.slice(0, 8)}...redacted` : '[redacted]';
    } else {
      result[key] = redact(raw);
    }
  }
  return result;
}

function createLogger(options = {}) {
  const debugEnabled = !!options.debug;
  const jsonLogs = !!options.jsonLogs;

  function write(level, event, message, details) {
    if (level === 'debug' && !debugEnabled) return;

    const entry = {
      ts: new Date().toISOString(),
      level,
      event,
      message,
      ...(details ? redact(details) : {}),
    };

    if (jsonLogs) {
      console.log(JSON.stringify(entry));
      return;
    }

    const suffix = details ? ` ${JSON.stringify(redact(details))}` : '';
    console.log(`[${entry.ts}] [${level.toUpperCase()}] ${event}: ${message}${suffix}`);
  }

  return {
    debug: (event, message, details) => write('debug', event, message, details),
    info: (event, message, details) => write('info', event, message, details),
    warn: (event, message, details) => write('warn', event, message, details),
    error: (event, message, details) => write('error', event, message, details),
  };
}

const defaultLogger = createLogger({ debug: process.env.DEBUG === '1' || process.env.DEBUG === 'true' });

module.exports = {
  createLogger,
  redact,
  log: (...args) => defaultLogger.info('legacy', args.join(' ')),
  debug: (...args) => defaultLogger.debug('legacy', args.join(' ')),
};
