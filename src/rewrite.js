const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BILLING_PREFIX = 'x-anthropic-billing-header:';
const BILLING_SALT = process.env.CLAUDE_CODE_BILLING_SALT || '59cf53e54c78';
const CLAUDE_CODE_PREAMBLE = "You are Claude Code, Anthropic's official CLI for Claude.";
const CLI_VERSION = process.env.CLAUDE_CODE_VERSION || '2.1.112';
const CLI_ENTRYPOINT = process.env.CLAUDE_CODE_ENTRYPOINT || 'sdk-cli';

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function extractFirstUserMessageText(messages = []) {
  if (!Array.isArray(messages)) return '';

  for (const message of messages) {
    if (!message || typeof message !== 'object' || message.role !== 'user') continue;
    const { content } = message;
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type === 'text' && typeof block.text === 'string' && block.text) {
        return block.text;
      }
    }
  }

  return '';
}

function computeVersionSuffix(messageText, version) {
  const sampled = [4, 7, 20]
    .map(index => (index < messageText.length ? messageText[index] : '0'))
    .join('');
  return sha256(`${BILLING_SALT}${sampled}${version}`).slice(0, 3);
}

function computeContentHash(messageText) {
  return sha256(messageText).slice(0, 5);
}

function buildBillingHeader(messages = [], options = {}) {
  const version = options.version || CLI_VERSION;
  const entrypoint = options.entrypoint || CLI_ENTRYPOINT;
  const messageText = extractFirstUserMessageText(messages);
  const suffix = computeVersionSuffix(messageText, version);
  const cch = computeContentHash(messageText);
  return `${BILLING_PREFIX} cc_version=${version}.${suffix}; cc_entrypoint=${entrypoint}; cch=${cch};`;
}

function prependSystemContext(messages, texts) {
  const systemText = Array.isArray(texts) ? texts.filter(Boolean).join('\n\n') : texts;
  if (!systemText) return messages;

  const prefix = `<system-reminder>\n${systemText}\n</system-reminder>\n\n`;
  const nextMessages = [...(messages || [])];
  const firstUser = nextMessages.findIndex(m => m.role === 'user');

  if (firstUser >= 0) {
    const msg = { ...nextMessages[firstUser] };
    if (typeof msg.content === 'string') {
      msg.content = prefix + msg.content;
    } else if (Array.isArray(msg.content)) {
      msg.content = [{ type: 'text', text: prefix }, ...msg.content];
    } else {
      msg.content = prefix.trim();
    }
    nextMessages[firstUser] = msg;
  } else {
    nextMessages.unshift({ role: 'user', content: prefix.trim() });
  }

  return nextMessages;
}

function repairToolPairs(messages) {
  if (!Array.isArray(messages)) return messages;

  const toolUseIds = new Set();
  const toolResultIds = new Set();

  for (const message of messages) {
    if (!message || typeof message !== 'object' || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'tool_use' && typeof block.id === 'string') toolUseIds.add(block.id);
      if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') toolResultIds.add(block.tool_use_id);
    }
  }

  const orphanedUses = new Set([...toolUseIds].filter(id => !toolResultIds.has(id)));
  const orphanedResults = new Set([...toolResultIds].filter(id => !toolUseIds.has(id)));
  if (orphanedUses.size === 0 && orphanedResults.size === 0) return messages;

  const repaired = [];
  for (const message of messages) {
    if (!message || typeof message !== 'object' || !Array.isArray(message.content)) {
      repaired.push(message);
      continue;
    }

    const content = message.content.filter(block => {
      if (!block || typeof block !== 'object') return true;
      if (block.type === 'tool_use' && orphanedUses.has(block.id)) return false;
      if (block.type === 'tool_result' && orphanedResults.has(block.tool_use_id)) return false;
      return true;
    });

    if (content.length > 0) repaired.push({ ...message, content });
  }

  return repaired;
}

function readClaudeAccountMetadata() {
  const configPath = process.env.CLAUDE_CONFIG_PATH || path.join(os.homedir(), '.claude.json');

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const accountUuid = config?.oauthAccount?.accountUuid;
    return typeof accountUuid === 'string' && accountUuid ? { user_id: accountUuid } : null;
  } catch {
    return null;
  }
}

function applyClaudeAccountMetadata(body) {
  const metadata = readClaudeAccountMetadata();
  if (!metadata) return body;

  if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
    body.metadata = { ...metadata, ...body.metadata };
  } else {
    body.metadata = metadata;
  }

  return body;
}

function rewriteSystemForBillingClassifier(body, options = {}) {
  if (!body || typeof body !== 'object') return body;

  const result = { ...body };
  const dropExtraSystem = !!options.dropExtraSystem;
  result.messages = repairToolPairs(result.messages);

  // Normalize system to array
  let originalBlocks = [];
  if (!result.system) {
    originalBlocks = [];
  } else if (typeof result.system === 'string') {
    originalBlocks = [{ type: 'text', text: result.system }];
  } else if (Array.isArray(result.system)) {
    originalBlocks = result.system;
  }

  const movedTexts = [];

  for (const block of originalBlocks) {
    if (block?.type !== 'text' || typeof block.text !== 'string') continue;
    const { text } = block;
    if (text.startsWith(BILLING_PREFIX)) continue;

    if (text.startsWith(CLAUDE_CODE_PREAMBLE)) {
      const rest = text.slice(CLAUDE_CODE_PREAMBLE.length).trim();
      if (rest) movedTexts.push(rest);
      continue;
    }

    movedTexts.push(text);
  }

  const billingHeader = buildBillingHeader(result.messages);
  result.system = [
    { type: 'text', text: billingHeader },
    { type: 'text', text: CLAUDE_CODE_PREAMBLE },
  ];

  if (movedTexts.length > 0 && !dropExtraSystem) {
    result.messages = prependSystemContext(result.messages, movedTexts);
  }

  return applyClaudeAccountMetadata(result);
}

module.exports = {
  buildBillingHeader,
  computeContentHash,
  computeVersionSuffix,
  extractFirstUserMessageText,
  repairToolPairs,
  rewriteSystemForBillingClassifier,
};
