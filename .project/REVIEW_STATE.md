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

Task: AUTHORIZATION-LOOP-FOUNDATION-V1A (resumed)
Branch: `feat/authorization-loop-foundation-v1a`
Target: main
Publication:
- Local Publication Builder authorized: **yes**, per this continuation's own "one local publication
  commit if all gates pass" instruction — one local commit, subject
  `feat: adopt council quorum proof in authorization loop`. No push, no PR, no merge.
- remote publication: human manual fallback only (unchanged)

**Proof-API adoption Scout** (`mcp__codex__codex`, read-only): mapped the real, merged
`verifyCouncilQuorumProof({ proof, decisionRecord, trustedRegistry })` signature onto the existing
Binder/Ledger; found no council-semantics mismatch.

**Boundary-integration remediation** (2 parallel fresh Codex Implementers, workspace-write, disjoint
file sets to avoid conflicts): Binder workstream and Ledger workstream, each reporting no council
escalation required.

**Phase 2 review re-entry** (3 fresh axis Reviewers — Binder/proof eligibility, Ledger independent
re-derivation/replay/fencing, Fake-loop boundedness): 2× `APPROVE_WITH_CHANGES` (test-coverage gaps
only — wrong-record-binding proof case, `RECONSTRUCTED`-provenance case, one R1-R3 loop integration
test), 1× `APPROVED_FOR_INTEGRATION`. One fresh Implementer fix round closed all gaps; re-run
confirmed green (Binder 23, Loop 13).

**Phase 6 four-axis integrated review** (fresh Reviewers, read-only):
- Axis 1 (hash graph/binding): `APPROVED_FOR_INTEGRATION`, no changes.
- Axis 2 (quorum/replay/fencing): `APPROVE_WITH_CHANGES` — Ledger's redundant hand-rolled quorum
  approximation removed; `checkAndConsume`/`issueGrant` check ordering fixed so the new proof gate
  no longer masks older-precedence denials (replay, stopEpoch revocation, grant expiry).
- Axis 3 (effect-isolation/no execution authority): `APPROVE_WITH_CHANGES` — extracted
  `computeTaskRecordHash`/`valueWithoutHash` into a new pure module
  (`scripts/dev/canonical-record-hash.mjs`) so Binder/Ledger no longer transitively import
  `run-bundle.mjs`'s fs/child_process-capable code; extended the authority-distance test to walk the
  transitive import graph; fixed one wording overclaim ("real executor" -> "FakeExecutor
  implementation").
- Axis 4 (confused-deputy resistance): `APPROVED_FOR_INTEGRATION`, no changes — most
  security-critical axis, found no exploitable bypass.

One fresh Implementer remediation round applied all three real Phase 6 findings; a follow-up Run
Bundle resync corrected one stale content hash after the wording fix (output bytes unchanged,
verified byte-identical). No finding at any point in this task required changing actual R1/R2/R3
quorum semantics, council topology, or the authority boundary — `PROTOCOL_SEMANTICS_BLOCKER`/
`COUNCIL_ESCALATION_REQUIRED` was never triggered; the continuation's pre-authorized real Shadow
Council escalation path was not used.

**Phase 7 final Verifier** (fresh, read-only): confirmed frozen ADR-0005 kernel/schema and the
merged `council-quorum-proof.mjs`/schema byte-identical to `main`; ADR-0006 Status still `Proposed`;
no execution/publication/shell/Git/network/provider-CLI capability anywhere in new code; full test
matrix green (independently re-run, not just claimed); the 6-scenario demonstration independently
re-run and confirmed; Run Bundle hashes independently recomputed and matched; `git diff --check`
clean. Two sandbox-only false failures (`npm run test:run-bundle` EPERM under the Verifier's
read-only sandbox) were independently re-run and confirmed green in this session's own shell.
`scripts/dev/run-bundle.mjs`'s diff (a same-behavior pure re-export refactor, confirmed via its own
unaffected 17/17 suite) was the only non-frozen tooling file touched.

---

**Prior, unrelated task — historical, preserved as-is, not rewritten:**

Task: DECISION-AUTHORIZATION-BOUNDARY-V1A-DESIGN
Branch: `docs/decision-authorization-boundary-v1a-design`
Target: main
Publication:
- Local Publication Builder authorized: **yes**, per this task's own explicit "Prepare one local
  commit only if review finds the design coherent" instruction — exactly one local commit, subject
  `docs: define decision authorization boundary`. No push, no PR, no merge (task-forbidden).
- remote publication: human manual fallback only (unchanged by this task)

This is a **design-only** task: no code, script, or schema file was created; `docs/adr/ADR-0005-
DECISION-COUNCIL-PROTOCOL.md`, the Decision Council kernel/simulator/schema/tests, and the Shadow
Council V1A exercise/evidence are all confirmed byte-identical to `main` (Verifier, below).

**Round 1 — four parallel, independent, fresh Codex Reviewers (`mcp__codex__codex`, read-only),
one per required adversarial axis**, against the first complete draft of
`docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md`:

- **Axis A (authority escalation / confused deputy)**, thread `01a0504c-d443-7a60-b1af-f7d5912d0cda`:
  verdict REJECT. 2 BLOCKER + 2 MAJOR. Root finding: `evaluateAuthorization`/`checkAndConsume` as
  drafted trusted a caller-supplied `DecisionRecord`/envelope's own claimed fields (disposition,
  scope, hash) instead of independently verifying them; `TaskRecord` lookup was tautological
  (equality-checked against a caller-supplied `TaskRecord`); the admin/client privilege split was
  asserted, not structurally specified.
- **Axis B (replay / stale context / STOP fencing)**, thread `01a0504e-0d57-71a3-b2d9-ddd350313584`:
  verdict REJECT. 3 BLOCKER + 2 MAJOR. Root finding: caller-chosen/random `authorizationId` let the
  same decision be wrapped in multiple separately-consumable envelopes; consumption-time freshness
  and `stopEpoch` fencing were not actually linearized against concurrent bumps; `expiresAt` was
  defined but never checked; grant creation didn't tie `boundStopEpoch` to the envelope it approved.
- **Axis C (human-approval binding / R3 bypass)**, thread `01a0504f-db1b-7ec1-aa1e-bdaf710b7b84`:
  verdict REJECT. 1 BLOCKER + 2 MAJOR. Root finding: `checkAndConsume` never recomputed
  `envelopeHash`/disposition from the canonical `DecisionRecord`, so a submitted envelope's own
  (falsifiable) claims of `POLICY_SATISFIED`/an approved hash were trusted directly; `expiresAt`
  unchecked; `approverIdentity` had no eligibility/authentication policy.
- **Axis D (DecisionRecord → execution separation)**, thread `01a05051-1336-7db2-b056-55bac0bc6e81`:
  verdict FAIL. 1 BLOCKER + 1 MAJOR. Findings: `ALLOW_ONCE` is a genuine positive authorization fact
  (this ADR's own thesis language overclaimed otherwise) and V1C, once built, would already hold the
  authorization side a future Gateway needs; the ADR's claim that a future Gateway "would construct a
  `PublicationEnvelope`" established a new, unauthorized producer relationship into the existing
  Publication Protocol (`CODEX_ROLES.md` names Claude as the sole producer, "never a worker").

**Claude's adjudication (Round 1):** all findings accepted as valid; none required changing frozen
ADR-0005 (no `PROTOCOL-BOUNDARY BLOCKER` was raised by any of the four). Fixes applied directly to
the ADR: added a mandatory, privileged "Independent Re-Verification" step (`independentlyRederive`)
that re-derives the canonical `DecisionRecord`/`TaskRecord` (hash-verified) and re-runs
`evaluateAuthorization` itself rather than trusting a submitted envelope's fields; made
`authorizationId` a deterministic function of `(decisionRequestId, recordHash)`; added a global
reader-writer-lock fencing model for `stopEpoch` vs. consumption; added an `expiresAt` check inside
the atomic consumption section; tied `AuthorizationGrant.boundStopEpoch` to the recomputed envelope
at creation time; specified `approverIdentity` as captured non-spoofably by the admin path's own
authentication mechanism, not caller-asserted; made the admin/client disjoint-type separation a
normative V1C requirement; softened the "no capability grant of any kind" thesis to an honest
comparison with the already-accepted Publication Broker source-implemented-not-activated precedent,
and added a V1C exit-gate requirement (no consumer of the Ledger may exist until V1D is separately
authorized); removed the unauthorized `PublicationEnvelope`-construction claim, replacing it with an
explicit non-decision.

**Round 2 — one fresh, independent Codex Reviewer** (`mcp__codex__codex`, read-only, no memory of
Round 1), thread `01a0505a-8463-79f1-8eca-53deb4edd9f1`, re-attacking the corrected design
specifically to check whether the Round 1 fixes actually held: verdict BLOCKER. 1 BLOCKER + 1 MAJOR
+ 1 MINOR. Root finding: the fix's own concurrency gate was keyed on the submitted (untrusted)
`authorizationId`, not the independently-derived canonical one — two concurrent submissions with
different fabricated IDs could each acquire a different gate and both reach `ALLOW_ONCE` before
either marked the ledger. Also: the grant-creation invariant was specified only in prose, without
the same reader-writer-lock rigor consumption itself has; the field-mismatch ordering was described
as a forensic/causal claim rather than a diagnostic-precedence one.

**Claude's adjudication (Round 2):** all three findings accepted as valid. Fixed by splitting
re-derivation into an ungated `resolveCanonicalRecord` (pure read, produces the trustworthy
canonical `authorizationId`) that runs *before* the gate is acquired, with the gate itself now keyed
on that canonical value, never the submission's claim; grant creation's rule now explicitly requires
holding the shared/reader form of the same global `stopEpoch` lock across re-derivation, epoch
comparison, and durable persistence; the field-mismatch ordering is now described as "diagnostic
precedence," not causal classification.

**Claude's own additional self-review**, applied directly (not a separate Codex round, given
diminishing marginal value after two independent adversarial rounds; named here rather than hidden):
found and fixed a dangling section cross-reference ("see 'Two Kinds of Staleness' below," a heading
that was never actually written); found and fixed a correctness bug where the schema proposal listed
`EXPIRED_BY_DRIFT`/`REVOKED_BY_STOP_EPOCH`/`CONSUMED` as legal values of the envelope's own
`disposition` field, which would have broken the hash-immutability the whole design depends on
(`envelopeHash` covers `disposition`; mutating it post-construction would silently invalidate any
already-issued `AuthorizationGrant`) — corrected so `disposition` is fixed at construction to exactly
two values, and the State Machine diagram is now explicitly described as the Ledger's own tracked
lifecycle for an `authorizationId`, not a mutation of the immutable envelope; found and fixed a
malformed bullet in "Alternatives Considered" (a missing bullet marker/title had silently merged two
alternatives into one) and two literal duplicated bullets in "Open Questions" (an editing artifact
from an earlier insertion).

**Residual, honestly flagged**: after these self-driven fixes, no third independent Codex Reviewer
round was run against the exact final text — two independent adversarial rounds already converged
toward decreasing severity (Round 1: multiple BLOCKERs across all four axes; Round 2: one BLOCKER,
found and fixed), and this is a design document, not executable code, so the marginal value of a
third round was judged not to outweigh the cost. This is Claude's own technical judgment call, named
explicitly rather than silently assumed away — a human reviewer may reasonably want one more pass
before treating the design as final.

**Verifier** (`mcp__codex__codex`, fresh, read-only, independent, thread
`01a0505f-aba2-7723-aaa9-8690ff8c0225`, no design opinion, deterministic checks only): **11/11
checks PASS.** `git diff main --check` clean; `git diff main -- docs/adr/ADR-0005-DECISION-COUNCIL-
PROTOCOL.md` empty; `git diff main --` over the Decision Council kernel/simulator/schema/tests empty;
Shadow Council exercise + finalized run bundle
(`.project/run-bundles/shadow-council-v1a-cli-harness-remediated/`) empty; `PUBLICATION_BROKER.md`/
`CODEX_ROLES.md`/`AGENT_POLICY.md`/`publication-builder.mjs`/`tools/publication-broker/` all empty;
only 4 Markdown files changed/added (`docs/adr/ADR-0006-DECISION-AUTHORIZATION-BOUNDARY.md` new;
`.project/CURRENT_TASK.md`, `.project/PROJECT_STATE.md`, `.project/CONTEXT_INDEX.md` modified) — no
executable, script, or schema file added anywhere; direct text inspection confirmed no runnable-code
claim or execution instruction anywhere in the ADR; `npm run check:project-consistency` 7/7 PASS;
`npm run context` confirmed clean bootstrap-visible state matching this record.

**Human review is the next gate.** This task's local publication commit (once prepared) is not
pushed; no PR is touched or created; no merge occurs. Nothing in this task activates execution,
bounded autonomy, Publication Broker provisioning, or any council→tool/action path — all remain
separate, explicitly human-authorized future work, exactly as the ADR's own "Non-Goals" states.
