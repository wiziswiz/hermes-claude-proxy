const DEFAULT_SAMPLE_LIMIT = 160;
const DEFAULT_FINDING_LIMIT = 50;

const IDENTITY_REPLACEMENTS = [
  {
    label: 'identity.hermes-agent-title',
    category: 'identity',
    pattern: /\bHermes Agent\b/g,
    replacement: 'Claude Code',
  },
  {
    label: 'identity.hermes-agent-sentence',
    category: 'identity',
    pattern: /\bHermes agent\b/g,
    replacement: 'Claude Code',
  },
  {
    label: 'identity.hermes-docs-url',
    category: 'identity',
    pattern: /https:\/\/hermes-agent\.nousresearch\.com\/docs\/?/g,
    replacement: 'https://docs.anthropic.com/en/docs/claude-code',
  },
  {
    label: 'identity.hermes-docs-domain',
    category: 'identity',
    pattern: /\bhermes-agent\.nousresearch\.com\b/g,
    replacement: 'docs.anthropic.com',
  },
  {
    label: 'identity.hermes-agent-slug',
    category: 'identity',
    pattern: /\bhermes-agent\b/g,
    replacement: 'claude-code',
  },
  {
    label: 'identity.nous-research',
    category: 'identity',
    pattern: /\bNous Research\b/g,
    replacement: 'Anthropic',
  },
  {
    label: 'identity.nous-domain',
    category: 'identity',
    pattern: /\bnousresearch\.com\b/g,
    replacement: 'anthropic.com',
  },
  {
    label: 'identity.active-hermes-profile',
    category: 'identity',
    pattern: /\bActive Hermes profile\b/g,
    replacement: 'Active Claude Code profile',
  },
  {
    label: 'identity.hermes-profile',
    category: 'identity',
    pattern: /\bHermes profile\b/g,
    replacement: 'Claude Code profile',
  },
  {
    label: 'identity.hermes-tools',
    category: 'identity',
    pattern: /\bHermes tools\b/g,
    replacement: 'Claude Code tools',
  },
  {
    label: 'identity.hermes-media-cache',
    category: 'identity',
    pattern: /\bHermes media cache\b/g,
    replacement: 'Claude Code media cache',
  },
  {
    label: 'tooling.hermes-tools-module',
    category: 'tooling',
    pattern: /\bhermes_tools\b/g,
    replacement: 'claude_tools',
  },
  {
    label: 'identity.hermes-generic-title',
    category: 'identity',
    pattern: /\bHermes\b/g,
    replacement: 'Claude Code',
  },
  {
    label: 'identity.hermes-generic-lower',
    category: 'identity',
    pattern: /\bhermes\b/g,
    replacement: 'claude-code',
  },
  {
    label: 'identity.openclaw-docs',
    category: 'identity',
    pattern: /\bdocs\.openclaw\.ai\b/g,
    replacement: 'docs.myapp.local',
  },
  {
    label: 'identity.openclaw-github',
    category: 'identity',
    pattern: /\bgithub\.com\/openclaw\b/g,
    replacement: 'github.com/myapp',
  },
  {
    label: 'identity.openclaw-hub',
    category: 'identity',
    pattern: /\bclawhub\.ai\b/g,
    replacement: 'apphub.local',
  },
  {
    label: 'path.openclaw-dir-dot',
    category: 'path',
    pattern: /\.openclaw\//g,
    replacement: '.clawdata/',
  },
  {
    label: 'path.openclaw-dir-slash',
    category: 'path',
    pattern: /\/openclaw\//g,
    replacement: '/clawdata/',
  },
  {
    label: 'identity.openclaw-title',
    category: 'identity',
    pattern: /\bOpenClaw\b/g,
    replacement: 'WorkspaceApp',
  },
  {
    label: 'identity.openclaw-lower',
    category: 'identity',
    pattern: /\bopenclaw\b/gi,
    replacement: 'workspace_app',
  },
  {
    label: 'identity.openclaw-hyphen',
    category: 'identity',
    pattern: /\bopen-claw\b/gi,
    replacement: 'workspace_app',
  },
  {
    label: 'path.hermes-home',
    category: 'path',
    pattern: /\.hermes/g,
    replacement: '.claude',
  },
  {
    label: 'path.hermes-home-env',
    category: 'path',
    pattern: /\bHERMES_HOME\b/g,
    replacement: 'CLAUDE_HOME',
  },
  {
    label: 'path.hermes-media-env',
    category: 'path',
    pattern: /\bHERMES_MEDIA_ALLOW_DIRS\b/g,
    replacement: 'CLAUDE_MEDIA_ALLOW_DIRS',
  },
  {
    label: 'system.soul-file',
    category: 'system',
    pattern: /\bSOUL\.md\b/g,
    replacement: 'PERSONA.md',
  },
  {
    label: 'tooling.session-search',
    category: 'tooling',
    pattern: /\bsession_search\b/g,
    replacement: 'conversation_search',
  },
  {
    label: 'tooling.skill-manage',
    category: 'tooling',
    pattern: /\bskill_manage\b/g,
    replacement: 'skill_edit',
  },
  {
    label: 'tooling.delegate-task',
    category: 'tooling',
    pattern: /\bdelegate_task\b/g,
    replacement: 'task_dispatch',
  },
  {
    label: 'tooling.kanban-prefix',
    category: 'tooling',
    pattern: /\bkanban_/g,
    replacement: 'board_',
  },
  {
    label: 'tooling.kanban-title',
    category: 'tooling',
    pattern: /\bKanban\b/g,
    replacement: 'Board',
  },
  {
    label: 'tooling.kanban-lower',
    category: 'tooling',
    pattern: /\bkanban\b/g,
    replacement: 'board',
  },
  {
    label: 'tooling.heartbeat-file',
    category: 'tooling',
    pattern: /\bHEARTBEAT\.md\b/g,
    replacement: 'STATUSCHECK.md',
  },
  {
    label: 'tooling.heartbeat-upper',
    category: 'tooling',
    pattern: /\bHEARTBEAT\b/g,
    replacement: 'STATUS_CHECK',
  },
  {
    label: 'tooling.heartbeat-lower',
    category: 'tooling',
    pattern: /\bheartbeat\b/g,
    replacement: 'status_check',
  },
];

const TOOL_NAME_RENAMES = {
  delegate_task: 'task_dispatch',
  session_search: 'conversation_search',
  skill_manage: 'skill_edit',
  kanban_heartbeat: 'board_status_check',
  mcp_delegate_task: 'mcp_task_dispatch',
  mcp_session_search: 'mcp_conversation_search',
  mcp_skill_manage: 'mcp_skill_edit',
  mcp_kanban_heartbeat: 'mcp_board_status_check',
};

const TOOL_NAME_RENAMES_REVERSE = Object.fromEntries(
  Object.entries(TOOL_NAME_RENAMES).map(([original, renamed]) => [renamed, original])
);

const CORE_TOOL_NAMES = [
  'mcp_terminal',
  'mcp_execute_code',
  'mcp_process',
  'mcp_read_file',
  'mcp_search_files',
  'mcp_patch',
  'mcp_write_file',
  'mcp_todo',
];

const TOOL_GROUPS = {
  core: CORE_TOOL_NAMES,
  browser: [
    'mcp_browser_back',
    'mcp_browser_click',
    'mcp_browser_console',
    'mcp_browser_get_images',
    'mcp_browser_navigate',
    'mcp_browser_press',
    'mcp_browser_scroll',
    'mcp_browser_snapshot',
    'mcp_browser_type',
    'mcp_browser_vision',
  ],
  desktop: ['mcp_computer_use'],
  automation: ['mcp_cronjob', 'mcp_task_dispatch'],
  memory: ['mcp_memory', 'mcp_conversation_search'],
  skills: ['mcp_skill_edit', 'mcp_skill_view', 'mcp_skills_list'],
  media: ['mcp_image_generate', 'mcp_vision_analyze', 'mcp_text_to_speech'],
  comms: ['mcp_clarify', 'mcp_send_message'],
  search: ['mcp_x_search'],
};

const TOOL_NEUTRAL_ALIASES = {
  mcp_browser_back: 'browser_back',
  mcp_browser_click: 'browser_click',
  mcp_browser_console: 'browser_console',
  mcp_browser_get_images: 'browser_get_images',
  mcp_browser_navigate: 'browser_navigate',
  mcp_browser_press: 'browser_press',
  mcp_browser_scroll: 'browser_scroll',
  mcp_browser_snapshot: 'browser_snapshot',
  mcp_browser_type: 'browser_type',
  mcp_browser_vision: 'browser_vision',
  mcp_clarify: 'clarify',
  mcp_computer_use: 'desktop_control',
  mcp_cronjob: 'schedule_job',
  mcp_task_dispatch: 'worker_dispatch',
  mcp_execute_code: 'execute_code',
  mcp_image_generate: 'image_generate',
  mcp_memory: 'note_store',
  mcp_patch: 'patch',
  mcp_process: 'process',
  mcp_read_file: 'read_file',
  mcp_search_files: 'search_files',
  mcp_send_message: 'outbound_message',
  mcp_conversation_search: 'history_lookup',
  mcp_skill_edit: 'procedure_edit',
  mcp_skill_view: 'procedure_view',
  mcp_skills_list: 'procedure_list',
  mcp_terminal: 'terminal',
  mcp_text_to_speech: 'text_to_speech',
  mcp_todo: 'todo',
  mcp_vision_analyze: 'vision_analyze',
  mcp_write_file: 'write_file',
  mcp_x_search: 'x_search',
};

const TOOL_NEUTRAL_ALIASES_REVERSE = Object.fromEntries(
  Object.entries(TOOL_NEUTRAL_ALIASES).map(([sanitized, neutral]) => [neutral, sanitized])
);

const RESPONSE_DESANITIZE_PATTERNS = [
  [/CLAUDE_MEDIA_ALLOW_DIRS/g, 'HERMES_MEDIA_ALLOW_DIRS'],
  [/CLAUDE_HOME/g, 'HERMES_HOME'],
  [/PERSONA\.md/g, 'SOUL.md'],
  [/claude_tools/g, 'hermes_tools'],
  [/conversation_search/g, 'session_search'],
  [/skill_edit/g, 'skill_manage'],
  [/task_dispatch/g, 'delegate_task'],
  [/board_status_check/g, 'kanban_heartbeat'],
  [/board_/g, 'kanban_'],
  [/STATUSCHECK\.md/g, 'HEARTBEAT.md'],
  [/STATUS_CHECK/g, 'HEARTBEAT'],
  [/status_check/g, 'heartbeat'],
  [/WorkspaceApp/g, 'OpenClaw'],
  [/workspace_app/g, 'openclaw'],
  [/\.clawdata\//g, '.openclaw/'],
  [/\/clawdata\//g, '/openclaw/'],
  [/\.claude/g, '.hermes'],
];

const LEAK_PATTERNS = [
  {
    label: 'identity.hermes-agent',
    category: 'identity',
    severity: 'high',
    pattern: /\bHermes Agent\b|\bHermes agent\b|\bhermes-agent\b/i,
  },
  {
    label: 'identity.nous',
    category: 'identity',
    severity: 'high',
    pattern: /\bNous Research\b|\bnousresearch\.com\b|\bhermes-agent\.nousresearch\.com\b/i,
  },
  {
    label: 'identity.hermes-profile',
    category: 'identity',
    severity: 'medium',
    pattern: /\bActive Hermes profile\b|\bHermes profile\b/i,
  },
  {
    label: 'identity.hermes-generic',
    category: 'identity',
    severity: 'high',
    pattern: /\bHermes\b|\bhermes\b/i,
  },
  {
    label: 'identity.openclaw',
    category: 'identity',
    severity: 'high',
    pattern: /\bOpenClaw\b|\bopenclaw\b|\bopen-claw\b|\bdocs\.openclaw\.ai\b|\bclawhub\.ai\b/i,
  },
  {
    label: 'path.hermes-home',
    category: 'path',
    severity: 'medium',
    pattern: /(?:^|[~\s/"'`])\.hermes(?:[/\s"'`]|$)|\/\.hermes(?:\/|$)/i,
  },
  {
    label: 'path.hermes-env',
    category: 'path',
    severity: 'medium',
    pattern: /\bHERMES_[A-Z0-9_]+\b/,
  },
  {
    label: 'path.hermes-context-file',
    category: 'path',
    severity: 'medium',
    pattern: /\b(?:HERMES|\.hermes)\.md\b/i,
  },
  {
    label: 'tooling.kanban',
    category: 'tooling',
    severity: 'medium',
    pattern: /(?:^|[^A-Za-z0-9])kanban(?:_[a-z_]+)?\b/i,
  },
  {
    label: 'tooling.heartbeat',
    category: 'tooling',
    severity: 'info',
    pattern: /(?:^|[^A-Za-z0-9])(?:kanban_)?heartbeat\b/i,
  },
  {
    label: 'tooling.hermes-memory',
    category: 'tooling',
    severity: 'info',
    pattern: /(?:^|[^A-Za-z0-9])(?:mcp_)?(?:session_search|skill_manage|delegate_task)\b/i,
  },
  {
    label: 'tooling.hermes-tools-module',
    category: 'tooling',
    severity: 'medium',
    pattern: /\bhermes_tools\b/i,
  },
];

function cloneJson(value) {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function applyReplacements(text, replacements = IDENTITY_REPLACEMENTS) {
  let next = text;
  const changes = [];

  for (const replacement of replacements) {
    let count = 0;
    next = next.replace(replacement.pattern, () => {
      count += 1;
      return replacement.replacement;
    });
    if (count > 0) {
      changes.push({
        label: replacement.label,
        category: replacement.category,
        count,
      });
    }
  }

  return { text: next, changes };
}

function createChangeReport() {
  const byLabel = new Map();
  const normalizations = [];

  return {
    add(path, changes) {
      for (const change of changes) {
        const existing = byLabel.get(change.label) || {
          label: change.label,
          category: change.category,
          count: 0,
          paths: [],
        };
        existing.count += change.count;
        if (!existing.paths.includes(path) && existing.paths.length < 8) {
          existing.paths.push(path);
        }
        byLabel.set(change.label, existing);
      }
    },
    normalize(label, detail) {
      normalizations.push({ label, detail });
    },
    finish() {
      const replacements = [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
      return {
        changed: replacements.length > 0 || normalizations.length > 0,
        replacements,
        normalizations,
      };
    },
  };
}

function replaceStringAt(object, key, path, report) {
  if (typeof object[key] !== 'string') return;

  const result = applyReplacements(object[key]);
  if (result.changes.length > 0) {
    object[key] = result.text;
    report.add(path, result.changes);
  }
}

function renameToolName(name, path, report) {
  if (typeof name !== 'string') return name;
  const renamed = TOOL_NAME_RENAMES[name];
  if (!renamed) return name;
  report.normalize('tool-name', `${path}:${name}->${renamed}`);
  return renamed;
}

function neutralizeToolName(name, path, report) {
  if (typeof name !== 'string') return name;
  const neutral = TOOL_NEUTRAL_ALIASES[name] || (name.startsWith('mcp_') ? name.slice(4) : name);
  if (neutral === name) return name;
  report.normalize('neutral-tool-name', `${path}:${name}->${neutral}`);
  return neutral;
}

function deneutralizeToolName(name) {
  if (typeof name !== 'string') return name;
  const sanitized = TOOL_NEUTRAL_ALIASES_REVERSE[name];
  if (!sanitized) return name;
  return TOOL_NAME_RENAMES_REVERSE[sanitized] || sanitized;
}

function sanitizeSchemaText(value, path, report) {
  if (typeof value === 'string') {
    const result = applyReplacements(value);
    if (result.changes.length > 0) {
      report.add(path, result.changes);
      return result.text;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeSchemaText(item, `${path}[${index}]`, report));
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'name') continue;
      value[key] = sanitizeSchemaText(child, path ? `${path}.${key}` : key, report);
    }
  }

  return value;
}

function sanitizeSystem(system, report) {
  if (!system) return system;

  if (typeof system === 'string') {
    const result = applyReplacements(system);
    if (result.changes.length > 0) {
      report.add('system', result.changes);
      return result.text;
    }
    return system;
  }

  if (!Array.isArray(system)) return system;

  for (let index = 0; index < system.length; index += 1) {
    const block = system[index];
    if (block && typeof block === 'object' && block.type === 'text') {
      replaceStringAt(block, 'text', `system[${index}].text`, report);
    }
  }

  return system;
}

function sanitizeTools(tools, report) {
  if (!Array.isArray(tools)) return tools;

  for (let index = 0; index < tools.length; index += 1) {
    const tool = tools[index];
    if (!tool || typeof tool !== 'object') continue;
    tool.name = renameToolName(tool.name, `tools[${index}].name`, report);
    replaceStringAt(tool, 'description', `tools[${index}].description`, report);
    if (tool.input_schema) {
      tool.input_schema = sanitizeSchemaText(tool.input_schema, `tools[${index}].input_schema`, report);
    }
  }

  return tools;
}

function neutralizeTools(tools, report) {
  if (!Array.isArray(tools)) return tools;

  for (let index = 0; index < tools.length; index += 1) {
    const tool = tools[index];
    if (!tool || typeof tool !== 'object') continue;
    tool.name = neutralizeToolName(tool.name, `tools[${index}].name`, report);
  }

  return tools;
}

function stripSchemaDescriptions(value) {
  if (Array.isArray(value)) return value.map(stripSchemaDescriptions);
  if (!value || typeof value !== 'object') return value;

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'description') continue;
    next[key] = stripSchemaDescriptions(child);
  }
  return next;
}

function humanizeToolName(name) {
  return String(name || 'tool')
    .replace(/^mcp_/, '')
    .replace(/_/g, ' ');
}

function compactToolSchemas(tools, report) {
  if (!Array.isArray(tools)) return tools;

  let count = 0;
  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') continue;
    tool.description = `Use the ${humanizeToolName(tool.name)} tool.`;
    if (tool.input_schema) tool.input_schema = stripSchemaDescriptions(tool.input_schema);
    count += 1;
  }

  if (count > 0) report.normalize('compact-tool-schemas', String(count));
  return tools;
}

function sanitizeMessageBlock(block, path, report) {
  if (typeof block === 'string') {
    const result = applyReplacements(block);
    if (result.changes.length > 0) report.add(path, result.changes);
    return result.text;
  }

  if (!block || typeof block !== 'object') return block;
  if (block.type === 'tool_result') return block;

  const next = { ...block };
  next.name = renameToolName(next.name, `${path}.name`, report);
  replaceStringAt(next, 'text', `${path}.text`, report);
  replaceStringAt(next, 'content', `${path}.content`, report);

  if (next.input && typeof next.input === 'object') {
    const raw = JSON.stringify(next.input);
    const result = applyReplacements(raw);
    if (result.changes.length > 0) {
      report.add(`${path}.input`, result.changes);
      next.input = JSON.parse(result.text);
    }
  }

  return next;
}

function sanitizeMessages(messages, report) {
  if (!Array.isArray(messages)) return messages;

  return messages.map((message, messageIndex) => {
    if (!message || typeof message !== 'object') return message;
    const next = { ...message };
    const path = `messages[${messageIndex}].content`;

    if (typeof next.content === 'string') {
      replaceStringAt(next, 'content', path, report);
    } else if (Array.isArray(next.content)) {
      next.content = next.content.map((block, blockIndex) => (
        sanitizeMessageBlock(block, `${path}[${blockIndex}]`, report)
      ));
    }

    return next;
  });
}

function neutralizeMessageToolUses(messages, report) {
  if (!Array.isArray(messages)) return messages;

  return messages.map((message, messageIndex) => {
    if (!message || typeof message !== 'object' || !Array.isArray(message.content)) return message;
    return {
      ...message,
      content: message.content.map((block, blockIndex) => {
        if (!block || typeof block !== 'object' || block.type !== 'tool_use') return block;
        const next = { ...block };
        next.name = neutralizeToolName(next.name, `messages[${messageIndex}].content[${blockIndex}].name`, report);
        return next;
      }),
    };
  });
}

function normalizeTextOnlyMessages(messages, report) {
  if (!Array.isArray(messages)) return messages;

  return messages.map((message, messageIndex) => {
    if (!message || typeof message !== 'object' || !Array.isArray(message.content)) return message;
    if (!message.content.every(block => block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')) {
      return message;
    }

    report.normalize('text-content', `messages[${messageIndex}].content:array->string`);
    return {
      ...message,
      content: message.content.map(block => block.text).join('\n\n'),
    };
  });
}

function stripThinkingFields(body, report) {
  const removed = [];
  for (const key of ['thinking', 'budget_tokens', 'output_config']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      delete body[key];
      removed.push(key);
    }
  }
  if (removed.length > 0) {
    report.normalize('strip-thinking', removed.join(','));
  }
}

function normalizeClaudeCodeShape(body, report) {
  if (Object.prototype.hasOwnProperty.call(body, 'temperature')) {
    const value = body.temperature;
    delete body.temperature;
    report.normalize('drop-temperature', `temperature=${value}`);
  }

  if (body.tool_choice && typeof body.tool_choice === 'object' && body.tool_choice.type === 'auto') {
    delete body.tool_choice;
    report.normalize('drop-tool-choice', 'tool_choice=auto');
  }

  body.messages = normalizeTextOnlyMessages(body.messages, report);
}

function dropToolDefinitions(body, report) {
  if (Array.isArray(body.tools)) {
    const count = body.tools.length;
    delete body.tools;
    report.normalize('drop-tools', String(count));
  }
}

function normalizeToolAllowlist(names = []) {
  return new Set(
    names
      .map(name => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean)
      .map(name => TOOL_NEUTRAL_ALIASES_REVERSE[name] || name)
      .map(name => TOOL_NAME_RENAMES[name] || name)
  );
}

function expandToolGroups(groups = [], report) {
  const names = [];
  for (const group of groups) {
    const normalized = typeof group === 'string' ? group.trim().toLowerCase() : '';
    if (!normalized) continue;
    const groupNames = TOOL_GROUPS[normalized];
    if (!groupNames) {
      report.normalize('unknown-tool-group', normalized);
      continue;
    }
    report.normalize('tool-group', `${normalized}:${groupNames.length}`);
    names.push(...groupNames);
  }
  return names;
}

function filterToolDefinitions(body, options, report) {
  if (!Array.isArray(body.tools)) return;

  const mode = options.toolMode || 'all';
  const hasAllowlist = Array.isArray(options.toolAllowlist) && options.toolAllowlist.length > 0;
  const selectedNames = hasAllowlist
    ? options.toolAllowlist
    : expandToolGroups(options.toolGroups, report);
  const allowlist = normalizeToolAllowlist(selectedNames);

  if (mode === 'none') {
    dropToolDefinitions(body, report);
    return;
  }

  let keepNames = allowlist;
  if (keepNames.size === 0 && mode === 'core') {
    keepNames = normalizeToolAllowlist(CORE_TOOL_NAMES);
  }

  if (keepNames.size === 0) return;

  const before = body.tools.length;
  body.tools = body.tools.filter(tool => tool && keepNames.has(tool.name));
  const after = body.tools.length;

  if (after === 0) {
    delete body.tools;
  }

  if (after !== before) {
    const kept = after > 0 ? body.tools.map(tool => tool.name).join(',') : '<none>';
    report.normalize('filter-tools', `${before}->${after}:${kept}`);
  }
}

function sanitizeRequest(body, options = {}) {
  if (!body || typeof body !== 'object') {
    return { body, report: { changed: false, replacements: [], normalizations: [] } };
  }

  const next = cloneJson(body);
  const report = createChangeReport();

  if (options.stripThinking) stripThinkingFields(next, report);

  next.system = sanitizeSystem(next.system, report);
  next.messages = sanitizeMessages(next.messages, report);
  next.tools = sanitizeTools(next.tools, report);
  if (options.toolSchemaMode === 'compact') compactToolSchemas(next.tools, report);
  if (options.normalizeShape) normalizeClaudeCodeShape(next, report);
  if (options.dropTools) {
    dropToolDefinitions(next, report);
  } else {
    filterToolDefinitions(next, options, report);
  }
  if (options.toolNameMode === 'neutral') {
    next.tools = neutralizeTools(next.tools, report);
    next.messages = neutralizeMessageToolUses(next.messages, report);
  }

  return { body: next, report: report.finish() };
}

function appendPath(path, key) {
  if (typeof key === 'number') return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

function compactSample(text, pattern, sampleLimit = DEFAULT_SAMPLE_LIMIT) {
  const match = text.match(pattern);
  const index = match && match.index !== undefined ? match.index : 0;
  const start = Math.max(0, index - Math.floor(sampleLimit / 3));
  const sample = text
    .slice(start, start + sampleLimit)
    .replace(/\s+/g, ' ')
    .trim();
  return sample.length === sampleLimit ? `${sample}...` : sample;
}

function auditHermesLeaks(value, options = {}) {
  const patterns = options.patterns || LEAK_PATTERNS;
  const findingLimit = options.findingLimit || DEFAULT_FINDING_LIMIT;
  const sampleLimit = options.sampleLimit || DEFAULT_SAMPLE_LIMIT;
  const findings = [];
  const seen = new Set();

  function addFinding(path, text, spec) {
    const key = `${spec.label}:${path}`;
    if (seen.has(key) || findings.length >= findingLimit) return;
    seen.add(key);
    findings.push({
      label: spec.label,
      category: spec.category,
      severity: spec.severity,
      path,
      sample: compactSample(text, spec.pattern, sampleLimit),
    });
  }

  function walk(node, path) {
    if (findings.length >= findingLimit) return;
    if (typeof node === 'string') {
      for (const spec of patterns) {
        if (spec.pattern.test(node)) addFinding(path || '<root>', node, spec);
      }
      return;
    }

    if (!node || typeof node !== 'object') return;
    if (node.type === 'tool_result') return;

    if (Array.isArray(node)) {
      for (let index = 0; index < node.length; index += 1) {
        walk(node[index], appendPath(path, index));
      }
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      walk(child, appendPath(path, key));
    }
  }

  walk(value, '');
  return findings;
}

function summarizeFindings(findings) {
  const summary = {};
  for (const finding of findings) {
    summary[finding.label] = (summary[finding.label] || 0) + 1;
  }
  return summary;
}

function desanitizeResponseString(text) {
  if (typeof text !== 'string') return text;
  let next = text;
  for (const [pattern, replacement] of RESPONSE_DESANITIZE_PATTERNS) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function desanitizeResponseJson(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(desanitizeResponseJson);

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'name' && typeof child === 'string') {
      const deneutralized = deneutralizeToolName(child);
      next[key] = TOOL_NAME_RENAMES_REVERSE[deneutralized] || deneutralized;
    } else if ((key === 'text' || key === 'thinking' || key === 'content') && typeof child === 'string') {
      next[key] = desanitizeResponseString(child);
    } else if (key === 'input' && child && typeof child === 'object') {
      next[key] = JSON.parse(desanitizeResponseString(JSON.stringify(child)));
    } else {
      next[key] = desanitizeResponseJson(child);
    }
  }
  return next;
}

function desanitizeSseLine(line) {
  if (!line.startsWith('data: ')) return line;
  const payload = line.slice(6);
  if (payload === '[DONE]') return line;

  try {
    const event = JSON.parse(payload);
    return `data: ${JSON.stringify(desanitizeResponseJson(event))}`;
  } catch {
    return line;
  }
}

module.exports = {
  CORE_TOOL_NAMES,
  IDENTITY_REPLACEMENTS,
  LEAK_PATTERNS,
  RESPONSE_DESANITIZE_PATTERNS,
  TOOL_NAME_RENAMES,
  TOOL_NAME_RENAMES_REVERSE,
  TOOL_GROUPS,
  TOOL_NEUTRAL_ALIASES,
  TOOL_NEUTRAL_ALIASES_REVERSE,
  applyReplacements,
  auditHermesLeaks,
  desanitizeResponseJson,
  desanitizeResponseString,
  desanitizeSseLine,
  sanitizeRequest,
  summarizeFindings,
};
