# MIHVER Run Bundle v1 — Deterministic Run Record

Status: **V1B typed record and human-report foundation.** A Run Bundle records what happened in
one MIHVER task run. It consumes a `ProjectContextPack` v1 as immutable input; it neither modifies
that pack nor turns the pack into authority.

## Purpose and authority boundary

The bundle is an auditable, deterministic handoff from execution, verification, and review to a
human decision. It describes work and evidence. It never grants permission to execute, publish,
push, open or merge a pull request. `humanActionRequested` states the next requested human action;
it is not proof that action was authorized. The Markdown report has the same boundary.

V1B does not implement task selection or scheduling, Decision Council voting or quorum,
autonomous execution authority, Publication Broker activation, or push/PR/merge automation.

## On-disk layout

The caller supplies the bundle directory with `--out`; the writer emits only:

```text
<out>/run-manifest.json
<out>/task-record.json
<out>/evidence-manifest.json
```

Large or raw evidence remains in caller-owned files elsewhere. An evidence entry may point to one
with `sourcePath` and its verified raw-byte `contentHash`; the writer never copies or embeds it.

## Two distinct hash flavors

Self-hashes are domain-separated. Each is SHA-256 of the domain bytes followed by canonical JSON
of the document without its own hash field:

- `MIHVER:TaskRecord:v1\0` → `taskRecordHash`
- `MIHVER:EvidenceManifest:v1\0` → `evidenceManifestHash`
- `MIHVER:RunManifest:v1\0` → `manifestHash`

The manifest self-hash includes both document references, transitively binding the bundle.
Canonical JSON always comes from `scripts/dev/canonical-json.mjs`.

Content hashes are different: `sha256:<hex>` over raw file bytes, with **no domain prefix**. They
bind external evidence and the canonical document bytes named by manifest references. Never treat
a plain content hash as a domain-separated document identity, or vice versa.

## Compilation, ordering, and ContextPack binding

Before writing, the compiler validates the supplied ProjectContextPack with its v1 schema and
recomputes `contextHash` with the ProjectContextPack's own hash primitive. A mismatch is refused as
`CONTEXT_PACK_HASH_MISMATCH`. The binding copies the verified pack's HEAD, branch, detached state,
and context identity. A null or schema-invalid HEAD is refused; V1B intentionally binds the pack's
declared repository snapshot and does not claim that the current checkout still has that HEAD.
Repository owner/name/remote identity is resolved only by the existing publication-builder helper.

Evidence is byte-sorted by `evidenceId`; artifacts are byte-sorted by path. Duplicate IDs or paths
are hard failures. Produced artifacts are derived from `ARTIFACT` evidence whose action is
`present`; those entries require a source pointer and verified content hash. Deletion evidence does
not describe a produced file and is therefore absent from `artifacts`.

## Append-only and finalization model

An OPEN bundle may receive only new evidence IDs. Existing evidence is reread, self-hashes and
manifest reference hashes are rechecked, external source hashes are rechecked, and the run ID,
ContextPack binding, repository identity, and TaskRecord must remain identical. Any stale or
missing content fails closed. `--finalize` is explicit and requires a caller-supplied ISO-8601
`--finalized-at`; the compiler never reads a clock. Once FINALIZED, every later write is refused as
`RUN_ALREADY_FINALIZED` before any bundle file is touched. POSIX read-only modes are an additional
defense, not the authority boundary.

The three documents are replaced by three sequential same-directory renames, not one atomic
directory transaction. A process or machine crash between those renames can leave an inconsistent
bundle; manifest reference-hash checks on the next append or report read detect that state and fail
closed, so the partial update is never silently trusted.

Output-directory components and targets are checked for traversal and symlinks. New files use
exclusive no-follow opens where supported. Immediately before writing, the compiler also rechecks
that the output path is still the same real directory it originally validated. No Git-mutating
command exists in this subsystem.

**Documented residual limitation**: Node's public `fs` module has no `openat`-relative-to-a-
directory-descriptor primitive, so the realpath-based output-directory check and each `O_NOFOLLOW`
open or same-directory rename are still separate syscalls. A concurrent local attacker who can
replace the `--out` directory itself with a symlink in the narrow window between the final recheck
and a write is not fully defended against by this mechanism. This is a real, acknowledged gap under
an adversarial concurrent-local-attacker model — do not claim it is fully closed. It requires an
attacker already able to mutate the caller-selected filesystem concurrently with compilation and is
consistent with this subsystem's trusted-local-machine threat model.

## Secret-pattern guard and residual limitation

Task and evidence strings are rejected when they resemble an AWS access-key ID, PEM private-key
header, `Authorization: Bearer` value, or `.env` assignment with a long opaque value. This bounded
heuristic makes common accidental leakage harder; it is **not a complete secret scanner**. It can
miss other formats and can produce false positives. Callers remain responsible for sanitization and
for keeping raw transcripts, credentials, and chain-of-thought out of summaries. Summary length is
mechanically capped at 2000 characters.

## Fail-closed human report

`run-bundle-report.mjs` accepts only a FINALIZED directory. Before emitting Markdown it schema-
validates the manifest, TaskRecord, and EvidenceManifest against the same validators the writer
uses, and separately verifies the manifest self-hash, both referenced document byte hashes, both
document self-hashes, and every external evidence source hash. Missing, malformed, schema-invalid,
partial, OPEN, or tampered input produces no report. Its fixed closing sentence states that typed
evidence does not authorize publication or merge.

## CLI

```text
npm run run-bundle -- --out <dir> --run-id <id> --context-pack <pack.json> \
  --task-record <task.json> [--evidence <entry.json>]... [--finalize --finalized-at <ISO-8601>]
npm run run-bundle-report -- --run <dir> [--out <report.md>]
npm run test:run-bundle
```

Both CLIs document `--help`. Writer/report exit `0` on success, `1` on a typed refusal, and `2` on
CLI usage error.
