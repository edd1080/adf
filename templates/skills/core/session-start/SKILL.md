---
name: session-start
description: "Reconstruct session continuity and present one bounded Session Contract. Use when an active handoff exists, the user says Continua el proyecto, or session continuity is required before mutating work."
license: MIT
metadata:
  adf-version: "0.1.0"
  adf-lifecycle: "active-handoff"
  adf-trigger: "session continuity"
  adf-dependencies: "context-router"
---

# Session start

Rebuild operational context from repository evidence instead of conversational memory.

## Read

1. Read `AGENTS.md`, `.harness/manifest.yml`, `.harness/STATE.md`, and `.harness/HANDOFF.md`.
2. Read only relevant entries from `.harness/LESSONS.md`.
3. Inspect repository changes and the active feature's `spec.md`, `plan.md`, `tasks.md`, and `verification.md`.
4. Invoke `context-router` for the session objective.

## Process

1. Reconcile state, handoff, working tree, and feature artifacts; surface any mismatch.
2. Ask for decisions made outside the repository since the handoff.
3. Classify the mode as discovery, feature, bug-fix, quick-change, or review.
4. Present one Session Contract containing objective, mode, active feature, in-scope, out-of-scope, source docs, planned verification, and human decisions needed.

## May write

Before authorization, write only a corrected handoff or state record when the repository evidence proves it stale and the user accepts the correction. Inventory every path.

## Stop

Stop on conflicting authorities, an invalid active feature, or an ambiguous primary objective. Any session that will mutate code waits for explicit `GO`. Commit, push, release, deployment, and external mutation require separate explicit authorization.

## Completion criteria

- Repository state and handoff agree or their mismatch is resolved.
- One primary objective and its boundaries are explicit.
- Applicable sources and verification commands are named.
- The Session Contract is presented.
- Explicit `GO` is recorded before code mutation.
