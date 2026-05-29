const fs = require('fs');
const { join } = require('path');

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function createRequestDumper(config, logger) {
  return {
    dump(requestId, data) {
      if (!config.dumpRequests) return null;

      fs.mkdirSync(config.dumpDir, { recursive: true });
      const prefix = join(config.dumpDir, `request-${requestId}`);
      const paths = {
        meta: `${prefix}-meta.json`,
        original: `${prefix}-original.json`,
      };
      if (Object.prototype.hasOwnProperty.call(data, 'sanitized')) {
        paths.sanitized = `${prefix}-sanitized.json`;
      }
      paths.rewritten = `${prefix}-rewritten.json`;

      writeJson(paths.meta, data.meta || {});
      writeJson(paths.original, data.original || null);
      if (paths.sanitized) writeJson(paths.sanitized, data.sanitized || null);
      writeJson(paths.rewritten, data.rewritten || null);

      logger.debug('debug.dump', 'Request dump written', { request_id: requestId, paths });
      return paths;
    },
  };
}

module.exports = { createRequestDumper };
