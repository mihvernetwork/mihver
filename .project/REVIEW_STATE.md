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

Task: DECISION-COUNCIL-V1A-KERNEL-SIMULATOR
Branch: `feat/decision-council-v1a-kernel-simulator`
Target: main
Publication:
- Local Publication Builder authorized: yes, per this task's own explicit instruction ("prepare
  exactly one local commit through the repository publication flow"), gated on verification passing
  and review findings being adjudicated (both met — see below)
- remote publication: human manual fallback only (unchanged by this task)
- one local commit, subject `feat: add deterministic decision council kernel`, no push, no PR
  mutation, no merge, no Shadow Council or other follow-on task started

Foundation-only: this task defines and proves the Decision Council protocol (typed artifacts, pure
deterministic kernel, fake-agent simulator) — no real LLM/provider/MCP/tool/shell/Publication
Broker connection, no execution gateway, no Shadow Council. See `.project/CURRENT_TASK.md` for the
full file-by-file change list and Codex-role thread IDs.

**Reviewer** (`mcp__codex__codex`, fresh/independent, read-only sandbox, thread
`01a04b3a-0720-7f21-9e2b-d0f9479d1c2a`, authored none of the material under review). Verdict as
reported: "CHANGES REQUIRED — one MAJOR protocol identity flaw," plus 39 PASS items (full ADR read;
3-seat topology; orchestrator/council separation; canonical-JSON reuse; domain-separated hashing;
candidate full-meaning binding; exact-candidate vote binding; commitment-before-reveal; FSM
invalid-transition handling; R0–R4 quorum math incl. diversity/proposer-exclusion/human-approval-
required; context/HEAD/epoch freshness checks; malformed-artifact handling; determinism boundary
(no clock/randomness/network/filesystem/env); no execution gateway; Non-Goals respected; 36/36 tests
passing at review time). The one MAJOR finding: the kernel cannot detect a single caller submitting
well-formed artifacts under multiple different `seatId`s, since no cryptographic signing/channel
binding authenticates that a submitted artifact truly originated from a process distinct from any
other seat's.

**Adjudicated by Claude — finding's required code/design change REJECTED, its documentation-
precision point ACCEPTED.** The task's own text explicitly disclaims exactly the property the
finding wants proven for V1A: "Do not claim this proves real-world provider independence. It
proves only the typed protocol invariant that Shadow Council will later have to attest." No
signing/authentication primitive is specified anywhere in the task; adding one now would be
Shadow-Council-shaped work the task's Non-Goals explicitly exclude, and the task's Stopping Rule
forbids speculative hardening beyond what's reproducibly required. What "duplicate seat masquerading
as another reviewer" means under the task's own IDENTITY/INDEPENDENCE framing — registering two
`CouncilConfig` seats with an identical (`provider`,`modelFamily`,`modelId`) triple under different
`seatId` labels — is correctly rejected (`DUPLICATE_SEAT_IDENTITY`, kernel-test-covered, and in the
Reviewer's own PASS list). Applied fix: tightened `ADR-0005`'s "Risks" section so it no longer reads
as claiming more anti-masquerading protection than the design provides (wording-only; no schema/
kernel/simulator/test change). This adjudication, and the reasoning above, is recorded here per
`REVIEW_PROTOCOL.md`'s "reject unsupported material recommendations explicitly, not silently."

Two smaller gaps found during **Claude's own direct review** (prior to dispatching the independent
Verifier/Reviewer, per `AGENT_POLICY.md`'s "Claude independently re-verifies"): `DECISION_REQUEST_MISMATCH`
and `PROPOSER_ROLE_VIOLATION` were both implemented in the kernel but had zero test coverage, despite
both being explicitly named required reject-behaviors in the task's IDENTITY/INDEPENDENCE section.
Sent back to the same Implementer thread (a revision of its own prior output, not an independent
verification role) for two precise, bounded test additions before the independent Verifier/Reviewer
ran; confirmed fixed by inspection and independently reconfirmed passing by the Verifier below.

**Verifier** (`mcp__codex__codex`, fresh/independent session, `workspace-write` sandbox, thread
`01a04b39-9b4a-7731-9b4b-a78dea6bb0c4`, never a continuation of the Implementer's own thread):
`node tests/dev/decision-council-kernel.test.mjs` — **18 passed, 0 failed**; `node tests/dev/decision-council-simulator.test.mjs`
— **18 passed, 0 failed**; `npm run check:project-consistency` — **7/7 PASS**; `npm test`
(`tests/contracts/validate-contracts.mjs`) — **170 fixtures PASS** (this task's new schema is not
wired into that validator, matching existing repository convention for every other
`schemas/dev/*.schema.json`, which is validated by its own dedicated test file instead); `git status
--short` showed exactly the 6 new files plus modified `package.json`; `git diff --stat package.json`
showed exactly the 2 added script lines. **ALL CHECKS PASS.**

**Adjudication**: implementation complete and independently verified; one Reviewer MAJOR finding
adjudicated and rejected with explicit task-text justification (documentation precision fix applied
instead); two Claude-found test-coverage gaps fixed and reconfirmed; no unresolved blocking finding.
Proceeding to the one authorized local commit via the Local Publication Builder.

**Human review is the next gate** — this task does not authorize a push, PR, or merge, and does not
start Shadow Council or any other follow-on task.
