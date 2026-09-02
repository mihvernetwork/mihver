// Pure Stop gate. Security boundary: receipts are prompt/session bound and roles never substitute.
export function decideStop({ baselineFingerprint, currentFingerprint, records, sessionId, promptId, stopHookActive = false }) {
  if (baselineFingerprint === currentFingerprint) return { decision: 'allow' };
  const bound = records.filter((r) => r.sessionId === sessionId && r.promptId === promptId && r.status === 'COMPLETED');
  const implementers = bound.filter((r) => r.role === 'IMPLEMENTER').sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
  const latest = implementers.at(-1);
  if (!latest) return { decision: 'block', reason: 'IMPLEMENTER_REQUIRED' };
  const verifiers = bound.filter((r) => r.role === 'VERIFIER' && String(r.completedAt) > String(latest.completedAt))
    .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
  const verifier = verifiers.at(-1);
  if (!verifier) return { decision: 'block', reason: 'VERIFIER_REQUIRED' };
  if (verifier.workspaceFingerprint !== currentFingerprint) return { decision: 'block', reason: 'VERIFIER_STALE' };
  // Host loop safety is external. Recursion state never releases an unmet gate.
  void stopHookActive;
  return { decision: 'allow' };
}
