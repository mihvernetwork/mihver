# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

MIHVER-ORCHESTRATOR-DELEGATION-FIREWALL-V1

## Objective

Add a restriction-only Claude Code hook-based orchestrator delegation firewall for this repository.
The firewall mechanically denies direct repository tools to the Claude MAIN thread, binds Codex MCP
delegation to a `MIHVER_DELEGATION_V1` role contract, records hook-authored hash-chained receipts,
and permits session Stop only after a `COMPLETED` IMPLEMENTER receipt and a fresh,
fingerprint-matching `COMPLETED` VERIFIER receipt. This is developer control-plane hardening only:
it expands no authority and gives no agent any new capability.

## Branch / Base

Branch: `fix/orchestrator-delegation-firewall-v1`
Base / HEAD: `f67dd99e79307761dcd29c8b58f0f43c59bf7577` (unchanged; no commit created)

## Scope / non-goals

Risk class **R2**. Implementation comprises 14 new files under
`tools/orchestrator-firewall/{bin,src,install,test}` and
`docs/development/ORCHESTRATOR_FIREWALL.md`, plus two-line `package.json` test-script wiring
(approximately 2,045 lines). It does not install the firewall on the host, grant execution,
publication, merge, or authorization authority, authorize V9, or introduce any V1C content.

## Result

`IMPLEMENTATION_COMPLETE_IN_WORKING_TREE_PENDING_HUMAN_PUBLICATION`.

The source, installer, deterministic tests, and policy documentation are complete in the working
tree. No commit, push, PR creation, merge, or host installation was performed during implementation.
PR expected: yes. Target: `main`. Live PR identity/state: verify from GitHub.

**Validation:** 40 deterministic firewall tests and 170 contract fixtures pass. The firewall suite
was independently executed twice in a separate session with identical results. `git diff --check`
is clean.

**Review:** six fresh adversarial Codex rounds completed. Rounds 1–3 found real blocking bypasses:
metadata fail-open; Codex `config` sandbox escalation; codex-reply role relabeling; Stop
self-release; ambiguous `threadId` binding; manifest-existence demotion re-enabling environment
overrides; and entry-only hashing with static import before validation. All were remediated. Rounds
4–5 found operator-misleading diagnostic defects: false-positive `INSTALLED` status, status crash on
a malformed manifest, cross-release validator drift, and incomplete content addressing. All were
remediated. Round 6 returned **`READY_FOR_FINAL_VERIFICATION`** with no blocking or major findings.

**Accepted limitations:** receipts and the thread-authority store are tamper-**evident**, not
tamper-proof; a same-user process can rewrite the unkeyed hash chain, and closing this requires
OS-level privilege separation of the kind already designed for the Publication Broker. Host hooks
fail open if the engine is missing, crashes, or exits non-zero. Bash protection is heuristic, not an
OS sandbox. A hash-to-import TOCTOU remains. `.gitignore`d files are excluded from workspace
fingerprints. `ConfigChange` protects only the running session. Break-glass is human-only by
convention, not mechanically enforced.

**Accepted non-blocking test-completeness follow-ups:** `permission_mode` invariance is asserted only
for main-thread Read, not delegated calls; delegated-effort tests do not compare resulting `STARTED`
receipts. Neither field is consulted by any authorization path.

## Required Context

- `.project/REVIEW_STATE.md`
- `.project/DECISIONS_LOG.md`
- `.project/PROJECT_STATE.md`
- `tools/orchestrator-firewall/`
- `docs/development/ORCHESTRATOR_FIREWALL.md`
- `docs/development/AGENT_POLICY.md`
- `docs/development/REVIEW_PROTOCOL.md`

## Status

**Implementation and adversarial review are COMPLETE in the working tree. Human publication is
PENDING.** The next authorized action is human review of the working tree, followed by a
human-performed commit, push, and PR. Remote publication automation remains unavailable.

**V9 REMAINS BLOCKED and is not authorized by this task.** It may be reconsidered only after this
exact sequence completes: (1) the firewall feature is merged; (2) post-merge CI succeeds; (3) a
human installs the firewall on the host; (4) a real enforcement smoke test succeeds. V1C remains
unauthorized.
