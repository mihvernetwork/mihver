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

Task: PROJECT-CONTINUITY-V1A-PR34-FINAL-HARDENING
Branch: `chore/project-continuity-v1a-context-pack`
Target: main
Publication:
- Local Publication Builder authorized: no
- remote publication: human manual fallback only (unchanged by this task)
- one local commit only, per this task's own explicit instruction — no push/PR/merge

Remediated the eight material findings from the independent final-tree review of draft PR #34,
hardening `ProjectContextPack` v1's failure paths (degraded pack, `.project/STOP` fail-closed
detection, injected Git-observation-failure handling, a start/end consistency fence, path-safe
source reads, schema cross-field coherence, canonical JSON Unicode handling, and a narrow
`.project/DECISIONS_LOG.md` wording fix). See `.project/CURRENT_TASK.md` for the full list of
fixes.

**Two fresh, independent, read-only Codex Reviewers** (`mcp__codex__codex`), run after
implementation and local validation, per this task's own explicit instruction:

**Reviewer A — Failure-Path / Determinism** (threadId `01a048b3-95a0-7a60-8489-3e4ba87d5417`).
Overall verdict as reported: not PASS. Noted its own sandbox could not run
`tests/dev/project-context-pack.test.mjs` (`mkdtempSync` → `EPERM`), the same reviewer-sandbox
limitation already documented repeatedly in this repository's history; ran real-repository
read-only CLI checks instead and independently confirmed the degraded-pack fix, every injected
Git-failure fail-closed path, the clean-source/HEAD-blob binding, and compact/pretty/hash
determinism directly. Findings:
- **MEDIUM (ACCEPTED)** — the snapshot consistency fence's equality check
  (`gitStateEqual`, `scripts/dev/project-context-pack.mjs`) treated two observations as "equal" (no
  `REPOSITORY_CHANGED_DURING_COMPILATION`) whenever a query failed identically at both the start
  and end observation — a repeated failure was silently read as "confirmed unchanged" rather than
  "unresolved," contradicting this same file's own header comment ("any discrepancy — including one
  side's query failing while the other succeeds — is treated as changed"). Reproduced directly by
  the reviewer (forced every global `status --porcelain` call to fail; the fence stayed silent,
  though `WORKING_TREE_STATUS_UNAVAILABLE` alone still correctly kept `valid`/`executionEligible`
  false, so this was a documentation/determinism-contract defect, not by itself a fail-open path).
  Fixed: `gitStateEqual` now requires **both** observations' underlying queries to have succeeded
  before comparing values at all — any failure on either side, including an identical failure on
  both, is unconditionally "changed." Three new regression tests added
  (`tests/dev/project-context-pack.test.mjs`): start-observation-only failure, end-observation-only
  failure, and — the exact case the reviewer found — both observations failing identically.
  `docs/development/PROJECT_CONTINUITY.md`'s "Snapshot consistency fence" section corrected to
  state the actual rule precisely.
- **LOW (ACCEPTED)** — the F4 test set previously injected only differing *successful* values
  (HEAD real→fake, status clean→dirty), never an observation *failure*, so it could not have caught
  the MEDIUM finding above on its own. Addressed by the same three new tests.
- Explicit confirmations (1, 2, 4, 5, 6): the degraded-pack path is non-recursive, deterministic,
  and leak-free (reproduced directly: `--repo /tmp/mihver-context-pack-does-not-exist` → clean JSON,
  exit 2, no path/exception text); every injected Git failure (branch/merge-base/rev-list/diff/
  global-status/per-source-ls-files/per-source-status/clean-source-HEAD-blob) produces its own
  stable error code and blocks `executionEligible`; compact/pretty/hash determinism confirmed by
  direct comparison, including for the degraded path; the F1/F3/F5 regression tests genuinely inject
  failures/adversarial state rather than asserting already-known-correct happy-path output.

**Reviewer B — Authority / Filesystem-Safety** (threadId `01a048b5-22a2-76c0-a0d4-6f31049a59e4`).
Overall verdict as reported: not PASS. Its own sandbox also hit the same documented `mkdtempSync`
`EPERM` limitation for the automated suite; ran direct source/schema/doc inspection and the real
CLI instead. Findings:
- **MEDIUM (REJECTED_WITH_REASON)** — flagged that rewriting `.project/DECISIONS_LOG.md`'s existing
  2026-08-28 `PROJECT-CONTINUITY-V1A-CONTEXT-PACK` entry (rather than appending a new one) violates
  that file's own stated "entries are never edited or removed" policy, and that the replacement
  text still names "PR #34." **Rejected**, on two independent grounds: (1) this exact rewrite —
  including its exact required wording, verbatim, down to "PR #34 is the human-review vehicle;
  merge remains human-only" — was explicitly, unambiguously mandated by this task's own
  human-authored prompt ("Rewrite only the V1A branch-local entry introduced by `e502ea9`. Replace
  it with a concise durable human decision, equivalent to: ..."); per `AGENT_POLICY.md`'s Authority
  Hierarchy, an explicit human instruction is the top authority and can authorize a narrow,
  deliberate exception to a file's own internal policy, particularly for content that has never
  reached `main` — the entry was introduced on this same still-unmerged branch (`e502ea9`), not a
  historical record from a prior frozen checkpoint. (2) This reading is independently confirmed by
  this repository's own mechanical check: `npm run check:project-consistency`'s
  `decisions-log-append-only-vs-base` check — which exists specifically to catch an edit to an
  entry that existed at the `main` baseline — passed cleanly after this rewrite, because the
  rewritten entry never existed at `main`; it was purely branch-local. The "PR #34" phrase is a
  bare, stable PR-number reference (`AGENT_POLICY.md`'s "Once a PR number is known, recording it...
  is fine and useful"), not Codex-reviewer mechanics/verdicts/findings, which the entry correctly
  omits entirely — consistent with "Do not include: reviewer mechanics" read as excluding review
  *process* detail, not a bare PR reference the human's own template itself specified verbatim. No
  change made.
- Explicit confirmations (1–6): `.project/STOP` fail-closed handling never uses `existsSync` and
  correctly distinguishes true-`ENOENT` (`present:false`) from every unsafe non-regular-file case
  (`present:true, sha256:null, STOP_NODE_UNSAFE`); `safeReadSource`'s containment/no-follow/
  single-fd-identity handling is implemented as described, and its documented ancestor-directory-
  swap residual limitation in `PROJECT_CONTINUITY.md` is accurate, not overclaimed as closed; no
  raw exception text, stack trace, or caller-supplied `--repo` path can reach the emitted pack (all
  such diagnostics go to stderr only); no `process.env`/`git remote`/`git config` usage exists
  anywhere; the schema's root-level `if`/`then` constraints genuinely force
  `executionEligible: true` to imply every listed field, and `executionBlocked`'s logical negation
  of `executionEligible` is enforced in both directions; the canonical-JSON Unicode documentation
  accurately describes JCS's no-normalization behavior, and lone-surrogate rejection is confirmed
  applied to both string values and object keys; no code path anywhere consumes `executionEligible`
  (or any other pack field) to authorize an action automatically — it remains purely descriptive.

**Post-fix revalidation (run directly by Claude, after the one accepted MEDIUM finding was
fixed)**: `npm run test:context-pack` — 91/91 (up from 88, three new regression tests for the
consistency-fence fix); `npm test` — 170/170; `npm run test:project-consistency` — 19/19; `npm run
check:project-consistency` — 7/7 (including `decisions-log-append-only-vs-base`, confirming the
`DECISIONS_LOG.md` rewrite is correctly scoped to a branch-local, not-yet-based entry); `npm run
test:publication-remote-name-parity` — 44/44; `npm run test:publication-builder` — 42/42; Go
`tools/publication-broker` suite unaffected and unchanged this task. Real-repository smoke output
re-validated against the schema; the fence fix independently reproduced directly against the real
repository (an injected global-status failure now correctly raises both
`WORKING_TREE_STATUS_UNAVAILABLE` and `REPOSITORY_CHANGED_DURING_COMPILATION`). `git status --short`
before/after every compiler invocation identical (fixture and real repository) — the compiler still
performs no filesystem write. `git diff --name-only` confined to this task's own Allowed Files list.

**Human review of the implementation is the next gate** — this task does not authorize its own
merge, push, or PR mutation. See `.project/PROJECT_STATE.md`'s "Next Authorized Action" once a
human has reviewed this.
