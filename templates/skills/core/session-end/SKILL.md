---
name: session-end
description: "Close one work session with verified state and a self-contained continuation. Use when the user asks to end the session, prepare tomorrow's context, or create a session handoff."
license: MIT
metadata:
  adf-version: "0.1.0"
  adf-lifecycle: "any"
  adf-trigger: "session handoff"
  adf-dependencies: "verify-work"
---

# Session end

Externalize enough current truth for another agent to resume without conversational memory.

## Read

1. Read `.harness/STATE.md`, `.harness/HANDOFF.md`, `.harness/LESSONS.md`, active feature tasks and verification, and the current diff.
2. Reconcile what the session intended, changed, verified, decided, and left blocked.

## Process

1. Inventory every created, modified, deleted, and temporary path.
2. Run proportional verification or preserve the latest valid evidence with its timestamp and scope.
3. Update tasks, verification, state, decisions, and blockers.
4. Add a lesson only when a user correction yields a general rule that can prevent recurrence.
5. Write a self-contained `.harness/HANDOFF.md` with objective, completed evidence, decisions, blockers, working-tree state, and one exact next action.

## May write

Write `.harness/STATE.md`, `.harness/HANDOFF.md`, applicable feature records, and correction-derived entries in `.harness/LESSONS.md`. Archive an old handoff only when its replacement is complete. Inventory every path.

## Stop

Stop if the changed-file inventory is incomplete, state contradicts the working tree, required verification is unknown, or the next action cannot be stated. Commit, push, release, deployment, and external mutation require explicit authorization for that action.

## Completion criteria

- Built work, evidence, decisions, blockers, and pending items are explicit.
- `STATE.md` and `HANDOFF.md` agree with the repository.
- Every lesson traces to a correction, not ordinary session history.
- The handoff contains one copy-pasteable next prompt.
- The final report includes the file inventory and verification result.
