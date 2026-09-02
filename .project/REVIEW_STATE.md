# Review State

Durable review/approval state, updated at the end of each task per `REVIEW_PROTOCOL.md`'s
completion checklist. Never invent or assume approval: if a human has not explicitly stated it,
record the gate as pending, not granted. A Codex or Claude `APPROVED` verdict is a technical
assessment, not human sign-off — see `AGENT_POLICY.md`'s Authority Hierarchy.

**Branch/task-scoped, like [CURRENT_TASK.md](./CURRENT_TASK.md).** The "Latest Review" section
below describes the current gate only when *both* hold: `CURRENT_TASK.md` is active for the
checked-out branch, and this file's own declared Branch/Task (below) matches that same
branch/task. `npm run context` checks this automatically. When either condition fails — no active
task, or this file's Branch/Task doesn't match the active one — the "Latest Review" content is
historical/stale task metadata only, not the current gate; `PROJECT_STATE.md`'s "Next Authorized
Action" is authoritative for what's next, not anything below.

## Latest Review

Task: MIHVER-ORCHESTRATOR-DELEGATION-FIREWALL-V1-CI-SCOPE-REMEDIATION
Branch: `fix/orchestrator-delegation-firewall-v1`
Target: `main`; base / HEAD `3bf4f73ab43cbe0e8117142e23b78b785a9a5bd4` (unchanged; no commit)

**Implementation** (R2, restriction-only developer control-plane hardening): a Claude Code
hook-based firewall mechanically denies direct repository tools to the Claude MAIN thread, binds
Codex MCP delegation to a `MIHVER_DELEGATION_V1` role contract, writes hook-authored hash-chained
receipts, and gates session Stop on a `COMPLETED` IMPLEMENTER receipt plus a fresh,
fingerprint-matching `COMPLETED` VERIFIER receipt. The working-tree change is 14 new source,
installer, test, and policy-documentation files plus two-line `package.json` test-script wiring
(approximately 2,045 lines). No authority expands and no agent gains a capability.

**Fresh adversarial Codex review, rounds 1–3:** found real blocking bypasses in metadata fail-open,
Codex `config` sandbox escalation, codex-reply role relabeling, Stop self-release, ambiguous
`threadId` binding, manifest-existence demotion re-enabling environment overrides, and entry-only
hashing with static import before validation. Every finding was remediated.

**Fresh adversarial Codex review, rounds 4–5:** found operator-misleading diagnostic defects: status
could falsely report `INSTALLED`, status could crash on a malformed manifest, release validation
could drift between copies, and content addressing was incomplete. Every finding was remediated.

**Fresh adversarial Codex review, round 6:** **`READY_FOR_FINAL_VERIFICATION`**, with no blocking or
major findings.

**PR #59 initial Project validation:** **FAILED**. Cause:
`SCOPE_SYMLINK_BOUNDARY_CROSS_PLATFORM_DEFECT`. Remediation: **COMPLETED**. Fresh local
verification: **PASS** — 40/40 firewall tests, 170/170 contract fixtures, and 7/7
project-consistency checks pass; `git diff --check` is clean. This is not a claim that PR #59 CI is
green. A new commit must be pushed and GitHub CI must actually succeed before any green claim.

**Fresh scope-remediation review:** a fresh adversarial Reviewer returned
`SCOPE_REMEDIATION_BLOCKER` on a malformed-absolute-cwd fail-open in the failed-realpath fallback.
The restriction-only correction is **COMPLETED**: `ENOENT`/`ENOTDIR` retain the prior lexical
fallback and every other realpath failure now fails safe in scope. Fresh local verification:
**PASS** — 42/42 firewall tests, 170/170 contract fixtures, 7/7 project-consistency checks, and a
clean `git diff --check`. Publication state remains `PENDING_NEW_PR_CI`; no PR #59 green-CI claim
is made.

**Accepted documented limitations:** receipts and the thread-authority store are tamper-evident,
not tamper-proof; any same-user process can rewrite the unkeyed hash chain, with OS-level privilege
separation required to close that limitation. Host hooks fail open if the engine is missing,
crashes, or returns non-zero. Bash protection is heuristic rather than an OS sandbox. Hash-to-import
TOCTOU remains. `.gitignore`d files are excluded from workspace fingerprints. `ConfigChange`
protects only the running session. Break-glass is human-only by convention, not mechanically
enforced.

**Accepted non-blocking test-completeness follow-ups:** `permission_mode` invariance is tested only
for main-thread Read, not delegated calls, and delegated-effort tests do not compare resulting
`STARTED` receipts. Neither field participates in an authorization path.

**Current gate:** remediation is complete in the working tree; publication state is
`PENDING_NEW_PR_CI`. No commit, push, merge, or host installation was performed during remediation.
The next authorized action is human review and then a human-performed commit/push; GitHub CI must
actually succeed before any green claim. Remote publication automation remains unavailable. Human
approval is PENDING — not requested, not granted.

**V9 gate:** V9 remains **BLOCKED** and is not authorized. Reconsideration requires, in order:
(1) merge this firewall feature; (2) successful post-merge CI; (3) human host installation; (4) a
successful real enforcement smoke test. No V1C content or authority follows from this task.
