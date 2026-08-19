# MIHVER Night Runner — Deterministic Dry-Run Foundation

Status: **Foundation / simulator only.** This document describes `scripts/dev/night-runner.mjs`
as it exists today. The rules in "Proposed Policy Additions" below are **not** part of
`AGENT_POLICY.md` — they are drafted here for human review and are not adopted policy until a
human explicitly approves folding them in.

## Purpose

Night Runner is a control-plane that will eventually schedule unattended ("overnight") execution
of MIHVER tasks. This foundation version builds only the **planning** half: given a queue of
already-authorized tasks, it deterministically computes what *would* happen — which tasks would
run, which would be blocked, which would fail, which would be stopped — without touching
anything. It never invents work: every task it reasons about must already exist, fully
specified, in the queue file it is given.

## What this version does **not** do

This is a structural guarantee, not just a documented promise — `scripts/dev/night-runner.mjs`
imports no process-spawning or networking module (no `node:child_process`, no `http`/`https`, no
`fetch`). It cannot:

- launch Claude or Codex,
- run a shell command or any task's actual work,
- create, switch, commit to, or otherwise modify any git branch,
- write to any file at all — the CLI only ever prints its report to stdout.

A later milestone may add an execution-capable Night Runner; that is out of scope here and would
need its own task and its own human authorization.

## Authorization model

Night Runner never decides what is authorized. Each task in the queue input carries an
`authorized` boolean set by whatever produced the queue file (a human, or a process a human has
approved) — Night Runner only *enforces* that flag. A task without `authorized: true` is never
scheduled; it is deterministically `BLOCKED`.

## State machine

```text
READY ──> RUNNING ──> VALIDATING ──> INDEPENDENT_REVIEW ──> READY_FOR_HUMAN
            │
            ├──(estimated runtime > per-task timeout, retries remain)──> RETRY ──> RUNNING
            └──(estimated runtime > per-task timeout, no retries left)──> FAILED

READY ──(dependency unmet / unauthorized / limit reached)──> BLOCKED | STOPPED
(any pending task, once a queue-level limit trips)──────────────────> STOPPED
```

| State | Meaning |
|---|---|
| `READY` | Implicit starting point for every task; not reported as a final state. |
| `RUNNING` | Simulated execution attempt (this version never actually executes anything). |
| `VALIDATING` | Simulated post-run validation step. |
| `INDEPENDENT_REVIEW` | Simulated independent-review step. |
| `READY_FOR_HUMAN` | Terminal success: the task's simulated result is ready for a human gate. |
| `RETRY` | A timed-out attempt that still has retries available; loops back to `RUNNING`. |
| `BLOCKED` | Terminal: an unmet dependency, an unauthorized task, or an unmet human gate. |
| `FAILED` | Terminal: exhausted `max_retries` while still exceeding `per_task_timeout_seconds`. |
| `STOPPED` | Terminal: the kill switch was engaged, or a queue-level limit was reached. |

Every task's final state and its full transition history are deterministic functions of the
queue document and the kill-switch flag — nothing in the algorithm reads a clock or generates
randomness. The same input always produces byte-identical output.

## Queue input format (JSON)

```json
{
  "queue_id": "example-queue",
  "limits": {
    "max_runtime_seconds": 3600,
    "max_tasks": 10,
    "per_task_timeout_seconds": 900,
    "max_retries": 2
  },
  "tasks": [
    {
      "task_id": "task-a",
      "branch": "chore/task-a",
      "authorized": true,
      "human_gated": false,
      "estimated_runtime_seconds": 300,
      "depends_on": []
    },
    {
      "task_id": "task-b",
      "branch": "chore/task-b",
      "authorized": true,
      "human_gated": false,
      "estimated_runtime_seconds": 200,
      "depends_on": ["task-a"]
    }
  ]
}
```

Structural rules, all enforced before any task is simulated:

- `queue_id`: non-empty string.
- `limits`: all four fields required; `max_runtime_seconds` and `per_task_timeout_seconds` must
  be finite numbers `> 0`; `max_tasks` must be a finite **integer** `> 0`; `max_retries` must be
  a finite integer `>= 0`.
- Each task requires `task_id` (non-empty string, unique across the queue), `branch` (non-empty
  string, and **never `"main"`** — see "`main` is never a task branch" below), `authorized`
  (boolean), `human_gated` (boolean), `estimated_runtime_seconds` (number `>= 0`), and
  `depends_on` (array of strings, no duplicates within the array).
- **The queue file must already be in topological order**: every id in a task's `depends_on`
  must reference a task that appears at a strictly *earlier* index in the `tasks` array. This
  single rule rules out dangling references, self-references, and cycles all at once, and means
  Night Runner never reorders or infers scheduling order — the queue author's declared order is
  authoritative. A queue that violates this ordering is refused, not silently re-sorted.

Any structural violation is collected (all of them, not just the first) and the whole queue is
refused — see "Refusal" below.

## `main` is never a task branch

A task whose `branch` is exactly `"main"` makes the entire queue structurally invalid and the
whole run is refused. This is a hard, queue-wide check, not a per-task `BLOCKED` outcome — a
queue that asks Night Runner to treat `main` as writable is malformed input, not a schedulable
edge case.

## Dependencies and human-gated chains

A task is only eligible to run once every task named in its `depends_on` has reached
`READY_FOR_HUMAN`. Two additional rules layer on top of plain dependency-success:

- **Any non-`READY_FOR_HUMAN` dependency blocks its dependents.** If a dependency ended
  `BLOCKED` or `FAILED`, everything depending on it is `BLOCKED` too (reason names the dependency
  and its state). A dependency never actually reaches this check as `STOPPED`: once a queue-level
  limit trips or the kill switch engages, every remaining task — dependents included — is
  `STOPPED` directly by the cascade described under "Limits" and "Kill switch" below, before this
  per-dependency check would run for it.
- **A `human_gated: true` dependency always blocks its dependents**, even when that dependency
  itself reached `READY_FOR_HUMAN`. Reaching `READY_FOR_HUMAN` means the *simulated* work is
  ready for a human to look at — it is not the human's sign-off. This simulator has no mechanism
  for recording that a human actually cleared a gate, so any dependent of a human-gated task is
  unconditionally `BLOCKED` in this version.

## Limits

Four limits are read from the queue's `limits` block.

**`max_tasks`** is checked once per task, before its first attempt: once scheduling this task
would exceed the count of tasks already started, this task and every remaining not-yet-decided
task become `STOPPED`. `BLOCKED` tasks (unmet dependency or missing authorization) never count
against it, since they never actually start.

**`per_task_timeout_seconds`** and **`max_retries`** govern each individual attempt: if a task's
own `estimated_runtime_seconds` exceeds `per_task_timeout_seconds`, the attempt times out (the
estimate doesn't change between attempts, so every attempt of that task times out the same way).
A timed-out attempt consumes one `RETRY` and tries again, until `max_retries` is exhausted, at
which point the task is `FAILED`.

**`max_runtime_seconds`** is a global budget charged **per attempt, not per task**:

- Each attempt (the initial one and every retry's) costs
  `min(estimated_runtime_seconds, per_task_timeout_seconds)` — a timeout-bounded attempt is cut
  off at the timeout and never costs more than that, no matter how much larger the task's own
  estimate is. The full estimate is only ever charged when it doesn't exceed the timeout (i.e.
  when the attempt would have succeeded anyway).
- The budget is checked **before every attempt**, including retries — so a task can be
  interrupted between attempts, not only before its first one. A task that used two retries'
  worth of budget and then can no longer afford a third attempt ends `STOPPED`, with its `history`
  showing exactly the attempts it got to make (e.g. `["READY", "RUNNING", "RETRY", "RUNNING",
  "RETRY", "STOPPED"]`) — it is never charged for an attempt it didn't actually make.
- Once this limit trips (on any task, on any attempt), **every remaining task in the queue is
  `STOPPED`** — the same cascade as `max_tasks` tripping — not just the attempt or task that
  tripped it.

`BLOCKED` tasks never consume `max_runtime_seconds` budget either, since they never attempt to
run.

## Kill switch

Before any per-task simulation, Night Runner checks whether `.project/STOP` exists. If it does,
**every task in the queue is `STOPPED`** (reason: kill switch engaged) and no dependency,
authorization, or limit logic runs at all. Structural validation of the queue still runs first
and still produces `REFUSED` on malformed input regardless of the kill switch, since that check
is diagnostic and never executes anything.

## Refusal

Night Runner refuses to produce a plan — rather than guessing, skipping, or partially
simulating — when the queue document itself is structurally unsafe: schema/type violations
(including a non-integer `max_tasks`), duplicate `task_id`s, a `"main"` task branch, or a
`depends_on` reference that isn't strictly earlier in the array. The report's `status` is `"REFUSED"`, `reasons` lists every violation
found, `tasks` is empty, and the CLI exits non-zero. Refusal is a distinct outcome from any
task's own `BLOCKED`/`FAILED`/`STOPPED` state — those describe a *valid* queue's schedulable
outcomes; `REFUSED` means the input could not be trusted enough to schedule at all.

## Dry-run report (JSON)

```json
{
  "status": "OK",
  "queue_id": "example-queue",
  "limits": { "max_runtime_seconds": 3600, "max_tasks": 10, "per_task_timeout_seconds": 900, "max_retries": 2 },
  "kill_switch_active": false,
  "reasons": [],
  "tasks": [
    {
      "task_id": "task-a",
      "branch": "chore/task-a",
      "final_state": "READY_FOR_HUMAN",
      "history": ["READY", "RUNNING", "VALIDATING", "INDEPENDENT_REVIEW", "READY_FOR_HUMAN"],
      "retries_used": 0,
      "reasons": []
    }
  ],
  "summary": { "total_tasks": 1, "ready_for_human": 1, "blocked": 0, "failed": 0, "stopped": 0 }
}
```

`status` is one of `"OK"`, `"REFUSED"`, or `"STOPPED_BY_KILL_SWITCH"`. The report contains no
timestamps or other non-deterministic fields, so two runs against the same queue file and the
same kill-switch state always produce byte-identical JSON.

## CLI / npm scripts

```text
node scripts/dev/night-runner.mjs <path-to-queue.json>
npm run night-runner -- <path-to-queue.json>
npm run test:night-runner
```

The CLI prints the JSON report to stdout and exits `0` unless `status` is `"REFUSED"`, in which
case it exits `1`. `npm test` (existing contract suite) and `npm run test:night-runner` are
separate scripts; both are run during validation of any change touching Night Runner, but
`npm test` itself is unchanged by this foundation.

The queue-planning logic (`planQueue`) is exported from `scripts/dev/night-runner.mjs` as a pure
function of `(queueDocument, { stopSwitchActive })` — it performs no file or git I/O itself, so
tests exercise it directly without needing to create or delete a real `.project/STOP` file.

## Proposed Policy Additions (pending human review — not yet part of `AGENT_POLICY.md`)

These are candidate rules for a future `AGENT_POLICY.md` amendment, drafted here so the human can
review them alongside the implementation that motivates them. None are in effect as policy.

1. Night Runner may only ever schedule tasks whose queue entry carries `authorized: true`; it
   never determines authorization itself, and a queue producer that sets this flag without a
   human-approved basis for doing so is a process failure outside Night Runner's authority to
   detect.
2. A queue containing a task whose `branch` is `"main"` must be refused wholesale, never silently
   filtered down to the safe subset.
3. A `human_gated: true` task's dependents remain blocked until a separate, explicit human
   clearance mechanism exists and is exercised — reaching `READY_FOR_HUMAN` is never itself
   sufficient to unblock dependents. This foundation version has no clearance mechanism, so this
   rule can currently never be satisfied for a human-gated dependency's dependents.
4. `.project/STOP` must remain a repository-wide, immediate, whole-queue kill switch in any
   future execution-capable Night Runner — not a per-task pause.
5. Any Night Runner version that has not been explicitly authorized by a human to execute real
   work must remain structurally incapable of doing so (no process-spawning or git-mutating
   imports), verifiable by inspection rather than by trusting a runtime flag.
6. Exceeding `max_runtime_seconds` or `max_tasks` stops the remainder of the queue rather than
   skipping only the task that tripped the limit, so a human reviewing a dry-run report sees the
   full blast radius of a limit, not just its first casualty.

## Future work (not built here)

- An actual execution-capable runner (dispatching real Claude/Codex/shell work), gated behind its
  own human-authorized task.
- A clearance mechanism for human-gated tasks so their dependents can become schedulable.
- Queue *generation* tooling (this foundation only consumes a pre-built queue file).
