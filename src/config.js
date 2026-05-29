const { homedir } = require('os');
const { join } = require('path');
const pkg = require('../package.json');

const DEFAULT_CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json');
const DEFAULT_DUMP_DIR = join('/tmp', 'hermes-claude-proxy');
const DEFAULT_TOOL_GROUPS = [
  'core',
  'browser',
  'media',
  'comms',
  'search',
  'memory',
  'skills',
  'desktop',
  'automation',
];

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || String(value).trim() === '') {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

function normalizeAuthHeaderFormat(value) {
  const normalized = String(value || 'auto').trim().toLowerCase();
  if (!['auto', 'bearer', 'x-api-key'].includes(normalized)) {
    throw new Error('AUTH_HEADER_FORMAT must be auto, bearer, or x-api-key');
  }
  return normalized;
}

function normalizeToolMode(value) {
  const normalized = String(value || 'all').trim().toLowerCase();
  if (!['all', 'core', 'none'].includes(normalized)) {
    throw new Error('TOOL_MODE must be all, core, or none');
  }
  return normalized;
}

function normalizeToolSchemaMode(value) {
  const normalized = String(value || 'full').trim().toLowerCase();
  if (!['full', 'compact'].includes(normalized)) {
    throw new Error('TOOL_SCHEMA_MODE must be full or compact');
  }
  return normalized;
}

function normalizeToolNameMode(value) {
  const normalized = String(value || 'preserve').trim().toLowerCase();
  if (!['preserve', 'neutral'].includes(normalized)) {
    throw new Error('TOOL_NAME_MODE must be preserve or neutral');
  }
  return normalized;
}

function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseArgs(argv = []) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    const eq = raw.indexOf('=');
    const name = eq >= 0 ? raw.slice(0, eq) : raw;
    const inlineValue = eq >= 0 ? raw.slice(eq + 1) : undefined;
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      i += 1;
      if (i >= argv.length) throw new Error(`${name} requires a value`);
      return argv[i];
    };

    switch (name) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      case '-p':
      case '--port':
        args.port = takeValue();
        break;
      case '--host':
        args.host = takeValue();
        break;
      case '--debug':
        args.debug = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      case '--no-debug':
        args.debug = false;
        break;
      case '--json-logs':
        args.jsonLogs = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      case '--dump-requests':
        args.dumpRequests = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      case '--no-dump-requests':
        args.dumpRequests = false;
        break;
      case '--credentials-path':
        args.credentialsPath = takeValue();
        break;
      case '--auth-header-format':
        args.authHeaderFormat = takeValue();
        break;
      case '--anthropic-base-url':
        args.anthropicBaseUrl = takeValue();
        break;
      case '--dump-dir':
        args.dumpDir = takeValue();
        break;
      case '--sanitize-hermes':
        args.sanitizeHermes = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      case '--no-sanitize-hermes':
        args.sanitizeHermes = false;
        break;
      case '--strict-leak-check':
        args.strictLeakCheck = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      case '--no-strict-leak-check':
        args.strictLeakCheck = false;
        break;
      case '--strip-thinking':
        args.stripThinking = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      case '--no-strip-thinking':
        args.stripThinking = false;
        break;
      case '--normalize-shape':
        args.normalizeShape = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      case '--no-normalize-shape':
        args.normalizeShape = false;
        break;
      case '--drop-tools':
        args.dropTools = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      case '--no-drop-tools':
        args.dropTools = false;
        break;
      case '--tool-mode':
        args.toolMode = takeValue();
        break;
      case '--tool-schema-mode':
        args.toolSchemaMode = takeValue();
        break;
      case '--tool-name-mode':
        args.toolNameMode = takeValue();
        break;
      case '--tool-groups':
        args.toolGroups = takeValue();
        break;
      case '--tool-allowlist':
        args.toolAllowlist = takeValue();
        break;
      case '--drop-system-context':
        args.dropSystemContext = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      case '--no-drop-system-context':
        args.dropSystemContext = false;
        break;
      case '--max-retries':
        args.maxRetries = takeValue();
        break;
      case '--retry-base-ms':
        args.retryBaseMs = takeValue();
        break;
      case '--startup-validate':
        args.startupValidate = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      case '--no-startup-validate':
        args.startupValidate = false;
        break;
      case '--require-token-at-startup':
        args.requireTokenAtStartup = inlineValue === undefined ? true : parseBool(inlineValue, true);
        break;
      default:
        throw new Error(`Unknown option: ${name}`);
    }
  }

  return args;
}

function readConfig(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const debug = args.debug !== undefined ? args.debug : parseBool(env.DEBUG, false);
  const dropTools = args.dropTools !== undefined
    ? args.dropTools
    : parseBool(env.DROP_TOOLS, false);

  return {
    help: !!args.help,
    versionOnly: !!args.version,
    version: pkg.version,
    port: parseInteger(args.port || env.PORT || '4524', 'PORT'),
    host: args.host || env.HOST || '127.0.0.1',
    debug,
    jsonLogs: args.jsonLogs !== undefined ? args.jsonLogs : parseBool(env.JSON_LOGS, false),
    dumpRequests: args.dumpRequests !== undefined ? args.dumpRequests : parseBool(env.DUMP_REQUESTS, debug),
    dumpDir: args.dumpDir || env.DUMP_DIR || DEFAULT_DUMP_DIR,
    bodyLimit: env.BODY_LIMIT || '50mb',
    sanitizeHermes: args.sanitizeHermes !== undefined
      ? args.sanitizeHermes
      : parseBool(env.SANITIZE_HERMES, true),
    strictLeakCheck: args.strictLeakCheck !== undefined
      ? args.strictLeakCheck
      : parseBool(env.STRICT_LEAK_CHECK, false),
    stripThinking: args.stripThinking !== undefined
      ? args.stripThinking
      : parseBool(env.STRIP_THINKING, true),
    normalizeShape: args.normalizeShape !== undefined
      ? args.normalizeShape
      : parseBool(env.NORMALIZE_SHAPE, true),
    dropTools,
    toolMode: dropTools ? 'none' : normalizeToolMode(args.toolMode || env.TOOL_MODE || 'all'),
    toolSchemaMode: normalizeToolSchemaMode(args.toolSchemaMode || env.TOOL_SCHEMA_MODE || 'compact'),
    toolNameMode: normalizeToolNameMode(args.toolNameMode || env.TOOL_NAME_MODE || 'neutral'),
    toolGroups: args.toolGroups !== undefined || env.TOOL_GROUPS !== undefined
      ? parseCsv(args.toolGroups || env.TOOL_GROUPS || '')
      : DEFAULT_TOOL_GROUPS,
    toolAllowlist: parseCsv(args.toolAllowlist || env.TOOL_ALLOWLIST || ''),
    dropSystemContext: args.dropSystemContext !== undefined
      ? args.dropSystemContext
      : parseBool(env.DROP_SYSTEM_CONTEXT, false),
    anthropicBaseUrl: args.anthropicBaseUrl || env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    credentialsPath: args.credentialsPath || env.CREDENTIALS_PATH || DEFAULT_CREDENTIALS_PATH,
    tokenOverride: env.ANTHROPIC_TOKEN || null,
    authHeaderFormat: normalizeAuthHeaderFormat(args.authHeaderFormat || env.AUTH_HEADER_FORMAT || 'auto'),
    maxRetries: parseInteger(args.maxRetries || env.MAX_RETRIES || '3', 'MAX_RETRIES'),
    retryBaseMs: parseInteger(args.retryBaseMs || env.RETRY_BASE_MS || '2000', 'RETRY_BASE_MS'),
    startupValidate: args.startupValidate !== undefined
      ? args.startupValidate
      : parseBool(env.STARTUP_VALIDATE, true),
    requireTokenAtStartup: args.requireTokenAtStartup !== undefined
      ? args.requireTokenAtStartup
      : parseBool(env.REQUIRE_TOKEN_AT_STARTUP, false),
    oauthClientId: env.OAUTH_CLIENT_ID || '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
    oauthTokenUrl: env.OAUTH_TOKEN_URL || 'https://platform.claude.com/v1/oauth/token',
    oauthScopes: env.OAUTH_SCOPES || 'user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload',
  };
}

function usage() {
  return `hermes-claude-proxy ${pkg.version}

Usage:
  node index.js [options]

Options:
  -p, --port <port>                 Listener port (default: 4524)
      --host <host>                 Listener host (default: 127.0.0.1)
      --debug                       Enable debug logging and request dumps
      --json-logs                   Emit JSON logs
      --dump-requests               Write per-request debug dumps
      --credentials-path <path>     Claude credentials file
      --auth-header-format <mode>   auto, bearer, or x-api-key (default: auto)
      --no-sanitize-hermes          Disable Hermes identity sanitization
      --strict-leak-check           Reject requests with non-info Hermes leak findings
      --no-strip-thinking           Preserve Hermes thinking fields
      --no-normalize-shape          Preserve default temperature, auto tool_choice, and text arrays
      --drop-tools                  Diagnostic: remove tools before forwarding
      --tool-mode <mode>            all, core, or none (default: all)
      --tool-schema-mode <mode>     full or compact (default: compact)
      --tool-name-mode <mode>       preserve or neutral (default: neutral)
      --tool-groups <groups>        Comma-separated tool groups to keep
      --tool-allowlist <names>      Comma-separated sanitized tool names to keep
      --drop-system-context         Diagnostic: do not move original system context into user message
      --anthropic-base-url <url>    Upstream Anthropic base URL
      --dump-dir <path>             Debug dump directory
      --no-startup-validate         Skip startup credential validation
      --require-token-at-startup    Exit if no usable token is available
  -v, --version                     Print version
  -h, --help                        Show this help
`;
}

module.exports = {
  DEFAULT_CREDENTIALS_PATH,
  DEFAULT_DUMP_DIR,
  DEFAULT_TOOL_GROUPS,
  normalizeAuthHeaderFormat,
  parseArgs,
  parseBool,
  readConfig,
  usage,
};
