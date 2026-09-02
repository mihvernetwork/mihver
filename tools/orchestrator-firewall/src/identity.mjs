// Hook identity classifier. Security boundary: only presence of a non-empty agent_id distinguishes subagents.
export function classify(input) {
  return Object.prototype.hasOwnProperty.call(input ?? {}, 'agent_id') &&
    typeof input.agent_id === 'string' && input.agent_id.trim().length > 0
    ? 'SUBAGENT' : 'MAIN_ORCHESTRATOR';
}
