// Main-thread capability policy. Security boundary: it only returns deny verdicts or no verdict.
export const MAIN_DENIED_TOOLS = Object.freeze([
  'Read', 'Grep', 'Glob', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebSearch', 'WebFetch', 'Agent',
]);

const codes = new Map([
  ['Read', 'MAIN_DIRECT_READ_DENIED'], ['Grep', 'MAIN_DIRECT_READ_DENIED'], ['Glob', 'MAIN_DIRECT_READ_DENIED'],
  ['Edit', 'MAIN_DIRECT_WRITE_DENIED'], ['Write', 'MAIN_DIRECT_WRITE_DENIED'], ['NotebookEdit', 'MAIN_DIRECT_WRITE_DENIED'],
  ['Bash', 'MAIN_DIRECT_BASH_DENIED'], ['WebSearch', 'MAIN_DIRECT_RESEARCH_DENIED'],
  ['WebFetch', 'MAIN_DIRECT_RESEARCH_DENIED'], ['Agent', 'MAIN_NATIVE_SUBAGENT_DENIED'],
]);

export function mainToolVerdict(toolName) {
  const code = codes.get(toolName);
  if (!code) return null;
  const text = toolName === 'Agent'
    ? 'native subagents cannot produce Codex delegation receipts and would launder direct work'
    : `Claude MAIN must delegate ${toolName} work through Codex MCP`;
  return { decision: 'deny', code, reason: `${code}: ${text}` };
}
