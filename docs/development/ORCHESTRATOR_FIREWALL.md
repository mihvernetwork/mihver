# MIHVER Orchestrator Firewall

The firewall is a development control-plane guardrail against a cooperative
agent's own drift. It exists because a policy instruction to “delegate” was
repeatedly rationalized away while the main thread still had the capability to
do the work directly. Mechanical checks replace reminders at the relevant
Claude Code lifecycle boundaries.

This is not a security boundary against a determined adversary with shell
access. In particular, Bash command scanning is heuristic, not an OS sandbox;
it can be evaded. Real protection requires filesystem permissions and human
ownership of the enforcement files and user settings.

## Known limitations — what this does NOT protect against

This firewall is a development control-plane guardrail against a cooperative
agent's own drift. It is **not** a defense against a determined adversary with
shell access. V1 has these explicit boundaries:

- The host fails open: if a hook is missing, crashes, or exits non-zero, the
  tool proceeds. Enforcement depends on the installed engine being present and
  healthy; the per-invocation executable self-hash check and regular `--status`
  inspection detect different drift cases but cannot repair a missing hook.
- Shell-command scanning is a heuristic, not an OS sandbox. Computed,
  indirect, or obfuscated paths can evade it.
- Receipts and the `runtime/threads.jsonl` thread-authority store are
  tamper-**evident**, not tamper-**proof**. Their chains use unkeyed SHA-256,
  and any process running as the same OS user—including delegated Codex or a
  subagent shell—can rewrite a ledger, the thread store, and their same-user
  writable head anchors. In particular, a pre-seeded binding could assign
  VERIFIER authority to a write-capable thread. Genuine protection requires OS-level privilege
  separation: a separate OS identity holding the trust root, as already
  documented for the Publication Broker. This is a V1 boundary and a
  candidate for future work.
- Executable and engine hashes are drift detection, not adversarial
  protection. A same-user writer able to replace the executable can also
  replace or remove its self-check. Like the ledgers, installation integrity
  is tamper-evident rather than tamper-proof. There is also an explicit
  hash-to-import TOCTOU window: a same-user writer can replace a verified
  engine file after the loader hashes it but before dynamic import reads it.
  OS-level privilege separation between the running agent and the trust-root
  owner is what actually closes this race.
- Workspace fingerprints intentionally exclude `.gitignore`d files (this
  repository ignores only `node_modules/`). A mutation confined to an ignored
  path is invisible to the Stop gate.
- `ConfigChange` protects only the running session's applied configuration; it
  is not a substitute for filesystem permissions or human ownership.
- `codex-reply` exposes no sandbox parameter, so the sandbox cannot be checked
  again per reply. Authority is instead bound to the thread at creation.
- Stop never self-releases. If an unmet gate exhausts the host's
  `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`, the turn remains **UNRESOLVED**, not
  complete.
- Environment path overrides are honored only by the repository source copy,
  whose install binding is a placeholder. Installed identity comes from a
  populated binding embedded in the generated executable. Removing or
  corrupting its adjacent manifest cannot demote it to source mode: it ignores
  overrides and fails closed.
- A duplicate Codex `threadId` permanently poisons that thread's authority.
  This deliberate fail-safe denies rather than grants authority, but it can
  cause denial of service if Codex ever reuses identifiers.
- Break-glass is human-only by design and convention, but this is not
  mechanically enforceable against same-user delegated execution.

## Trust model

The model-writable repository contains source, tests, the installer, and this
policy description. It is not the enforcement trust root. A human installs a
copy under the user's Claude Code directory:

```text
<home>/.claude/mihver-firewall/
  bin/mihver-firewall-<version>-<shorthash>.mjs
  bin/mihver-firewall-<version>-<shorthash>.mjs.manifest.json
  releases/<shorthash>/src/...
  manifest.json
  backups/settings.<iso8601>.json
  runtime/<session_id>/<prompt_id>/ledger.jsonl
  runtime/threads.jsonl
```

The executable filename is derived from a SHA-256 digest of a staged copy of
the complete engine source tree together with the final rendered loader bytes.
Staged and rendered bytes are hashed before the
content-addressed name is chosen, so concurrent source mutation cannot publish
different bytes under a precomputed name. The manifest records the SHA-256 of every copied
file. Each executable embeds its canonical repository root, trust root,
version, source commit, and validator hash/version; it derives its engine
directory and adjacent manifest filename from its own content-addressed name. On every
invocation the loader hashes itself, reads that per-executable manifest,
enumerates every `.mjs` in its bound engine directory, requires set-equality
with the manifest file list, and verifies every hash. Only then does it
dynamically import the dispatcher; no engine module executes beforehand. Hook
commands always name the installed, content-addressed executable
under this user-owned trust root. They never execute a repository path. If a
hook executed the repository copy, any agent with repository write access
could rewrite its own enforcement.

The installer registers hooks in the user-level
`<home>/.claude/settings.json`. Hook arrays from enabled settings sources are
merged. Project or local repository settings cannot use `disableAllHooks` or
`allowManagedHooksOnly` to disable a user-level hook; those controls are only
effective from policy, user, or flag settings. This is why user-level settings
are the configuration trust root. The human should separately use operating
system ownership and permissions to prevent the running agent from modifying
that root.

`ConfigChange` blocking protects the running session's applied configuration.
It is not a substitute for filesystem permissions or human ownership.

## Hook registration and ownership

The installer adds one all-match entry (no `matcher`, which means all tools or
events) to each of `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
`UserPromptSubmit`, `Stop`, and `ConfigChange`. Existing settings keys and
unrelated entries—including entries in those same event arrays—are retained.
With placeholders expanded, the block added to each event array is:

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "\"<home>/.claude/mihver-firewall/bin/mihver-firewall-<version>-<shorthash>.mjs\" # MIHVER_OWNER=orchestrator-firewall-v1",
      "timeout": 10
    }
  ]
}
```

The ownership marker is a collision-resistant convention, not authentication.
Ownership requires both independent signals: the parsed executable at the
start of `command` must be inside `<home>/.claude/mihver-firewall/bin/`, and the
command must end with the explicit shell comment
`# MIHVER_OWNER=orchestrator-firewall-v1`. Uninstall removes only entries that
meet both conditions. This avoids claiming or deleting third-party hooks based
on a marker alone.

## Human-operated installation

The installer has no import side effect and is not connected to an npm
lifecycle. A human invokes it explicitly from their own shell:

```sh
node tools/orchestrator-firewall/install/mihver-firewall-install.mjs --dry-run
node tools/orchestrator-firewall/install/mihver-firewall-install.mjs --install
node tools/orchestrator-firewall/install/mihver-firewall-install.mjs --status
node tools/orchestrator-firewall/install/mihver-firewall-install.mjs --uninstall
```

`--dry-run` is the default when no mode is supplied. The four modes are
mutually exclusive. `--home <path>` changes the home used to derive `.claude`
(tests must use a temporary directory), and `--repo-root <path>` selects the
source repository (normally inferred from the script location).

Dry-run prints every source and destination path, each source hash, the backup
and manifest targets, and the complete merged `settings.json`; it writes
nothing. Install parses existing settings before making any change. Malformed
JSON aborts without repair or overwrite. It creates a never-pruned timestamped
settings backup before changing settings, copies the versioned engine, validates
serialized JSON, and replaces settings atomically using a
same-directory temporary file and rename. Immediately before that rename it
re-reads `settings.json` and aborts if the bytes differ from those prepared,
preventing a concurrent update from being clobbered. Publication order is:
stage and hash bytes; publish the versioned engine; publish the executable's
adjacent manifest; re-read and byte-compare settings; atomically replace
settings; then update the non-authoritative bookkeeping `manifest.json` last.
An abort before the settings write leaves the old registered executable,
per-executable manifest, and versioned engine intact while new artifacts are
inert. An abort after the settings write leaves the new registered executable
already paired with its valid manifest and engine. Old executable/manifest/
engine tuples are retained so a settings rollback can still invoke its former
loader; there is no cutover window in which hooks reference an executable
without its manifest. **That rollback may restore known-vulnerable enforcement,
including a pre-H1 loader. After any settings rollback, immediately re-run
`--install` so the newest loader is registered.**

Uninstall retains installed engine files, the manifest, runtime state, and all
backup history. It backs up settings and surgically removes only owned hook
entries. Empty event arrays are removed; unrelated hooks and settings remain.

## Status and drift

Status prints exactly one protection state:

- `INSTALLED`: the per-executable manifest is valid, its file list is
  set-equal to the executable plus every `.mjs` in the bound engine directory,
  every file has its recorded SHA-256, the manifest is bound to the canonical repository root,
  and each required hook appears exactly once and is unaltered.
- `NOT_INSTALLED`: no owned hook registrations exist. The status line explicitly
  notes whether retained/orphaned firewall artifacts are still present.
- `DRIFTED`: a recorded file is missing or has a different hash, a required
  hook is missing or altered, the manifest is invalid or bound elsewhere, or
  owned hooks exist without a manifest.

`--status` reports malformed, partial, extra-file, identity-mismatched, or
hash-mismatched installations as `DRIFTED` and exits nonzero; a one-entry
manifest is never accepted. At runtime, the executable's embedded binding
selects installed mode permanently: malformed, missing, partial, or
identity-mismatched adjacent manifest data denies the main-thread direct-work surface with
`FIREWALL_MANIFEST_INVALID`, while a per-invocation executable self-hash
mismatch denies it with `FIREWALL_DRIFT_DETECTED`. Both states ignore
`MIHVER_FIREWALL_HOME` and `MIHVER_FIREWALL_CANONICAL_ROOT`.

Each loader and manifest record an explicit validator version and SHA-256 of
the exact embedded validator source. If the registered loader's validator
generation differs from the repository's current validator, status reports
`DRIFTED`, names both generations, and directs the human to re-run `--install`;
it never silently claims parity or changes registration automatically.

A valid registered executable that is older than the newest installed release
prints `INSTALLED` plus a `superseded release registered` warning. Status never
changes registration automatically; re-run `--install` to select the newest
loader.

This fail-closed denial is deliberately broad rather than scoped by `cwd`:
when an install is broken it cannot reliably establish its bound repository
root. A loud over-denial, reported as `DRIFTED` for human repair, is preferable
to silently disabling enforcement. This does not eliminate the host's separate
fail-open behavior when the hook is missing, cannot execute, or crashes before
it can emit a decision.

## HUMAN BREAK-GLASS

**Warning: break-glass bypass disables enforcement entirely.** It is reserved
for a human acting outside the running agent workflow. From a human-controlled
shell, either run the installer's `--uninstall` mode or directly edit the
user-owned `~/.claude/settings.json` to remove the entries identified by both
ownership signals above. Preserve unrelated hooks and settings; timestamped
backups remain under the trust root.

Break-glass must not be invoked through normal Claude main-thread tools and
must never be presented to Claude as an automatic recovery strategy. There is
deliberately no agent-callable disable command and no automatic recovery path.
Environment path overrides are available only in the placeholder-bound
repository source copy (pure source/test mode). Installed execution always
ignores them, and a missing or broken
installed manifest fails closed instead of reverting to overrides. If enforcement blocks useful work,
the running workflow stops and a human decides whether to bypass it from
outside that workflow.
