# Current Task

Updated at task start and again at completion. Reflects the task in progress on the branch named
below — not a history of past tasks (see [DECISIONS_LOG.md](./DECISIONS_LOG.md) for that).

## Task ID

MIHVER-ORCHESTRATOR-DELEGATION-FIREWALL-V1-CI-SCOPE-REMEDIATION

## Objective

Add a restriction-only Claude Code hook-based orchestrator delegation firewall for this repository.
The firewall mechanically denies direct repository tools to the Claude MAIN thread, binds Codex MCP
delegation to a `MIHVER_DELEGATION_V1` role contract, records hook-authored hash-chained receipts,
and permits session Stop only after a `COMPLETED` IMPLEMENTER receipt and a fresh,
fingerprint-matching `COMPLETED` VERIFIER receipt. This is developer control-plane hardening only:
it expands no authority and gives no agent any new capability.

Remediate the cross-platform scope-boundary defect exposed by PR #59 Project validation: when an
existing cwd resolves successfully, its resolved filesystem location is authoritative. A fresh
adversarial Reviewer subsequently returned `SCOPE_REMEDIATION_BLOCKER` because malformed absolute
cwd values could fail open in the failed-realpath fallback; that restriction-only defect is also
remediated.

## Branch / Base

Branch: `fix/orchestrator-delegation-firewall-v1`
Base / HEAD: `3bf4f73ab43cbe0e8117142e23b78b785a9a5bd4` (unchanged; no commit created)

## Scope / non-goals

Risk class **R2**. Implementation comprises 14 new files under
`tools/orchestrator-firewall/{bin,src,install,test}` and
`docs/development/ORCHESTRATOR_FIREWALL.md`, plus two-line `package.json` test-script wiring
(approximately 2,045 lines). It does not install the firewall on the host, grant execution,
publication, merge, or authorization authority, authorize V9, or introduce any V1C content.

## Result

`REMEDIATION_COMPLETED`; publication state: `PENDING_NEW_PR_CI`.

The source, installer, deterministic tests, and policy documentation are complete in the working
tree. No commit, push, PR creation, merge, or host installation was performed during implementation.
PR expected: yes. Target: `main`. Live PR identity/state: verify from GitHub.

**PR #59 initial Project validation:** **FAILED**. Cause:
`SCOPE_SYMLINK_BOUNDARY_CROSS_PLATFORM_DEFECT`. Remediation: **COMPLETED**. Fresh local
verification: **PASS** — 40/40 deterministic firewall tests, 170/170 contract fixtures, and 7/7
project-consistency checks pass; `git diff --check` is clean. This is not a claim that PR #59 CI is
green. A new commit must be pushed and GitHub CI must actually succeed before any green claim.

**Fresh scope-remediation review:** a fresh adversarial Reviewer returned
`SCOPE_REMEDIATION_BLOCKER` on a malformed-absolute-cwd fail-open in the failed-realpath fallback.
The restriction-only correction is **COMPLETED**: only genuine `ENOENT`/`ENOTDIR` failures retain
lexical exclusion, while every other realpath failure is treated as ambiguous and in scope. Fresh
local verification: **PASS** — 42/42 deterministic firewall tests, 170/170 contract fixtures, and
7/7 project-consistency checks pass; `git diff --check` is clean. Publication remains
`PENDING_NEW_PR_CI`.

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
- `tools/orchestrator-firewall/bin/mihver-firewall.mjs`
- `tools/orchestrator-firewall/install/mihver-firewall-install.mjs`
- `tools/orchestrator-firewall/src/policy.mjs`
- `tools/orchestrator-firewall/src/scope.mjs`
- `tools/orchestrator-firewall/src/stopgate.mjs`
- `docs/development/ORCHESTRATOR_FIREWALL.md`
- `docs/development/AGENT_POLICY.md`
- `docs/development/REVIEW_PROTOCOL.md`

## Status

**Implementation and CI scope remediation are COMPLETE in the working tree. Publication state is
`PENDING_NEW_PR_CI`.** The next authorized action is human review of the working tree, followed by
a human-performed commit and push; GitHub CI must actually succeed before any green claim. Remote
publication automation remains unavailable.

**V9 REMAINS BLOCKED and is not authorized by this task.** It may be reconsidered only after this
exact sequence completes: (1) the firewall feature is merged; (2) post-merge CI succeeds; (3) a
human installs the firewall on the host; (4) a real enforcement smoke test succeeds. V1C remains
unauthorized.
