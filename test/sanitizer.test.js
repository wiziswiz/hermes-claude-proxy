const assert = require('node:assert/strict');
const test = require('node:test');
const {
  applyReplacements,
  auditHermesLeaks,
  desanitizeResponseJson,
  desanitizeSseLine,
  sanitizeRequest,
  summarizeFindings,
} = require('../src/sanitizer');

test('applyReplacements normalizes high-confidence Hermes identity strings', () => {
  const result = applyReplacements(
    'Hermes Agent by Nous Research. Docs: https://hermes-agent.nousresearch.com/docs/'
  );

  assert.equal(
    result.text,
    'Claude Code by Anthropic. Docs: https://docs.anthropic.com/en/docs/claude-code'
  );
  assert.equal(result.changes.length, 3);
});

test('sanitizeRequest rewrites system and tool descriptions without mutating original', () => {
  const original = {
    system: [
      {
        type: 'text',
        text: 'Active Hermes profile: test. Hermes Agent was built by Nous Research.',
      },
    ],
    messages: [
      { role: 'user', content: 'Please fix Hermes docs.' },
    ],
    tools: [
      {
        name: 'mcp_skill_manage',
        description: 'Manage Hermes Agent skills.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'A Hermes profile skill path.',
            },
          },
        },
      },
    ],
  };

  const { body, report } = sanitizeRequest(original);

  assert.equal(original.system[0].text.includes('Hermes Agent'), true);
  assert.match(body.system[0].text, /Active Claude Code profile/);
  assert.match(body.system[0].text, /Claude Code was built by Anthropic/);
  assert.equal(body.messages[0].content, 'Please fix Claude Code docs.');
  assert.equal(body.tools[0].name, 'mcp_skill_edit');
  assert.equal(body.tools[0].description, 'Manage Claude Code skills.');
  assert.equal(body.tools[0].input_schema.properties.path.description, 'A Claude Code profile skill path.');
  assert.equal(report.changed, true);
  assert.ok(report.replacements.length >= 3);
  assert.ok(report.normalizations.some(item => item.detail === 'tools[0].name:mcp_skill_manage->mcp_skill_edit'));
});

test('auditHermesLeaks detects non-sanitized identity and operational labels', () => {
  const findings = auditHermesLeaks({
    system: [{ type: 'text', text: 'Active Hermes profile writes ~/.hermes and uses HERMES_HOME.' }],
    tools: [
      {
        name: 'mcp_kanban_heartbeat',
        description: 'Call session_search or skill_manage.',
      },
    ],
  });
  const summary = summarizeFindings(findings);

  assert.equal(summary['identity.hermes-profile'], 1);
  assert.equal(summary['path.hermes-home'], 1);
  assert.equal(summary['path.hermes-env'], 1);
  assert.equal(summary['tooling.kanban'], 1);
  assert.equal(summary['tooling.hermes-memory'], 1);
});

test('auditHermesLeaks skips tool_result content', () => {
  const findings = auditHermesLeaks({
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            content: 'Raw command output from ~/.hermes should not count.',
          },
        ],
      },
    ],
  });

  assert.equal(findings.length, 0);
});

test('sanitizeRequest can strip thinking and normalize Hermes runtime labels', () => {
  const { body, report } = sanitizeRequest({
    thinking: { type: 'enabled', budget_tokens: 1000 },
    output_config: null,
    temperature: 1,
    tool_choice: { type: 'auto' },
    system: [
      {
        type: 'text',
        text: 'Use ~/.hermes, HERMES_HOME, HERMES_MEDIA_ALLOW_DIRS, SOUL.md, session_search, skill_manage, delegate_task, and heartbeat.',
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hello', cache_control: { type: 'ephemeral' } },
          { type: 'text', text: 'world' },
        ],
      },
    ],
  }, { stripThinking: true });

  assert.equal(body.thinking, undefined);
  assert.equal(body.output_config, undefined);
  assert.equal(body.temperature, 1);
  assert.deepEqual(body.tool_choice, { type: 'auto' });
  assert.equal(Array.isArray(body.messages[0].content), true);
  assert.match(body.system[0].text, /~\/\.claude/);
  assert.match(body.system[0].text, /CLAUDE_HOME/);
  assert.match(body.system[0].text, /PERSONA\.md/);
  assert.match(body.system[0].text, /conversation_search/);
  assert.match(body.system[0].text, /skill_edit/);
  assert.match(body.system[0].text, /task_dispatch/);
  assert.match(body.system[0].text, /status_check/);
  assert.deepEqual(report.normalizations, [{ label: 'strip-thinking', detail: 'thinking,output_config' }]);
});

test('sanitizeRequest can normalize Claude Code request shape', () => {
  const { body, report } = sanitizeRequest({
    temperature: 0.3,
    tool_choice: { type: 'auto' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hello', cache_control: { type: 'ephemeral' } },
          { type: 'text', text: 'world' },
        ],
      },
    ],
  }, { normalizeShape: true });

  assert.equal(body.temperature, undefined);
  assert.equal(body.tool_choice, undefined);
  assert.equal(body.messages[0].content, 'hello\n\nworld');
  assert.ok(report.normalizations.some(item => item.label === 'drop-temperature' && item.detail === 'temperature=0.3'));
  assert.ok(report.normalizations.some(item => item.label === 'drop-tool-choice'));
  assert.ok(report.normalizations.some(item => item.label === 'text-content'));
});

test('sanitizeRequest can drop tool definitions for diagnostics', () => {
  const { body, report } = sanitizeRequest({
    tools: [
      { name: 'mcp_terminal', input_schema: { type: 'object' } },
      { name: 'mcp_read_file', input_schema: { type: 'object' } },
    ],
  }, { dropTools: true });

  assert.equal(body.tools, undefined);
  assert.ok(report.normalizations.some(item => item.label === 'drop-tools' && item.detail === '2'));
});

test('sanitizeRequest can keep only core tool definitions', () => {
  const { body, report } = sanitizeRequest({
    tools: [
      { name: 'mcp_browser_click', input_schema: { type: 'object' } },
      { name: 'mcp_terminal', input_schema: { type: 'object' } },
      { name: 'mcp_execute_code', input_schema: { type: 'object' } },
      { name: 'mcp_read_file', input_schema: { type: 'object' } },
      { name: 'mcp_memory', input_schema: { type: 'object' } },
    ],
  }, { toolMode: 'core' });

  assert.deepEqual(body.tools.map(tool => tool.name), ['mcp_terminal', 'mcp_execute_code', 'mcp_read_file']);
  assert.ok(report.normalizations.some(item => item.label === 'filter-tools' && item.detail === '5->3:mcp_terminal,mcp_execute_code,mcp_read_file'));
});

test('sanitizeRequest can keep named tool groups', () => {
  const { body, report } = sanitizeRequest({
    tools: [
      { name: 'mcp_browser_click', input_schema: { type: 'object' } },
      { name: 'mcp_terminal', input_schema: { type: 'object' } },
      { name: 'mcp_memory', input_schema: { type: 'object' } },
      { name: 'mcp_image_generate', input_schema: { type: 'object' } },
    ],
  }, { toolGroups: ['core', 'browser'] });

  assert.deepEqual(body.tools.map(tool => tool.name), ['mcp_browser_click', 'mcp_terminal']);
  assert.ok(report.normalizations.some(item => item.label === 'tool-group' && item.detail === 'core:8'));
  assert.ok(report.normalizations.some(item => item.label === 'tool-group' && item.detail === 'browser:10'));
  assert.ok(report.normalizations.some(item => item.label === 'filter-tools' && item.detail === '4->2:mcp_browser_click,mcp_terminal'));
});

test('sanitizeRequest tool allowlist accepts original names before rename', () => {
  const { body, report } = sanitizeRequest({
    tools: [
      { name: 'mcp_terminal', input_schema: { type: 'object' } },
      { name: 'mcp_session_search', input_schema: { type: 'object' } },
    ],
  }, { toolGroups: ['core'], toolAllowlist: ['mcp_session_search'] });

  assert.deepEqual(body.tools.map(tool => tool.name), ['mcp_conversation_search']);
  assert.ok(report.normalizations.some(item => item.label === 'tool-name'));
  assert.ok(report.normalizations.some(item => item.label === 'filter-tools' && item.detail === '2->1:mcp_conversation_search'));
  assert.equal(report.normalizations.some(item => item.label === 'tool-group'), false);
});

test('sanitizeRequest can compact all tool schemas without dropping tools', () => {
  const { body, report } = sanitizeRequest({
    tools: [
      {
        name: 'mcp_terminal',
        description: 'Long runtime-specific instructions.',
        input_schema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Long command guidance.',
            },
          },
          required: ['command'],
        },
      },
    ],
  }, { toolSchemaMode: 'compact' });

  assert.equal(body.tools.length, 1);
  assert.equal(body.tools[0].description, 'Use the terminal tool.');
  assert.equal(body.tools[0].input_schema.properties.command.description, undefined);
  assert.deepEqual(body.tools[0].input_schema.required, ['command']);
  assert.ok(report.normalizations.some(item => item.label === 'compact-tool-schemas' && item.detail === '1'));
});

test('sanitizeRequest can neutralize tool names in tools and history', () => {
  const { body, report } = sanitizeRequest({
    tools: [
      { name: 'mcp_terminal', input_schema: { type: 'object' } },
      { name: 'mcp_session_search', input_schema: { type: 'object' } },
    ],
    messages: [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'mcp_session_search',
            input: { query: 'auth' },
          },
        ],
      },
    ],
  }, { toolNameMode: 'neutral' });

  assert.deepEqual(body.tools.map(tool => tool.name), ['terminal', 'history_lookup']);
  assert.equal(body.messages[0].content[0].name, 'history_lookup');
  assert.ok(report.normalizations.some(item => item.label === 'tool-name'));
  assert.ok(report.normalizations.some(item => item.label === 'neutral-tool-name' && item.detail === 'tools[0].name:mcp_terminal->terminal'));
  assert.ok(report.normalizations.some(item => item.label === 'neutral-tool-name' && item.detail === 'tools[1].name:mcp_conversation_search->history_lookup'));
});

test('response desanitization restores Hermes runtime labels', () => {
  const json = desanitizeResponseJson({
    content: [
      {
        type: 'tool_use',
        input: {
          path: '~/.claude/profiles/test',
          env: 'CLAUDE_HOME',
          tool: 'conversation_search',
          toolName: 'mcp_skill_edit',
        },
      },
    ],
  });

  assert.equal(json.content[0].input.path, '~/.hermes/profiles/test');
  assert.equal(json.content[0].input.env, 'HERMES_HOME');
  assert.equal(json.content[0].input.tool, 'session_search');
  assert.equal(json.content[0].input.toolName, 'mcp_skill_manage');

  const line = desanitizeSseLine('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Use ~/.claude"}}');
  assert.equal(line, 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Use ~/.hermes"}}');
});

test('response desanitization restores neutral tool aliases', () => {
  const json = desanitizeResponseJson({
    content: [
      {
        type: 'tool_use',
        id: 'toolu_1',
        name: 'history_lookup',
        input: { query: 'auth' },
      },
      {
        type: 'tool_use',
        id: 'toolu_2',
        name: 'terminal',
        input: { command: 'pwd' },
      },
    ],
  });

  assert.equal(json.content[0].name, 'mcp_session_search');
  assert.equal(json.content[1].name, 'mcp_terminal');
});
