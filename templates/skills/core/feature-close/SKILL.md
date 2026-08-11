---
name: feature-close
description: "Close a feature only after complete verification and two-axis review. Use when the user requests feature closure, all slices appear done, or Gate G6 and feature closure must be evaluated."
license: MIT
metadata:
  adf-version: "0.1.0"
  adf-lifecycle: "active-feature"
  adf-trigger: "feature closure"
  adf-dependencies: "verify-work,code-review"
---

# Feature close

Evaluate Gate G6 against artifacts and current evidence, then leave the repository in a resumable state.

## Read

1. Read the feature spec, plan, tasks, verification record, applicable project docs, state, and handoff.
2. Read the full diff and identify the approved fixed point.
3. Enumerate every Definition of Done item before invoking dependencies.

## Process

1. Invoke `verify-work` and require `PASS` for every slice and feature-level criterion.
2. Invoke `code-review` along separate Standards and Spec axes; resolve blocking findings or record them as blockers.
3. Confirm documentation, decisions, migrations, cleanup, and changed-file inventory.
4. Update lifecycle records and declare one result: `DONE`, `HANDOFF`, `BLOCKED`, or `ABORTED`.

## May write

Update feature verification, tasks, approved documentation, `.harness/STATE.md`, and `.harness/HANDOFF.md` when supported by evidence. Inventory all writes.

## Stop

Stop before G6 on any DoD gap, failed check, unresolved blocking review finding, stale documentation, leftover instrumentation, or scope mismatch. Keep commit, push, release, deployment, and external changes behind explicit authorization.

## Completion criteria

- The complete Definition of Done maps to fresh evidence.
- Standards and Spec reviews are recorded separately.
- Documentation and decisions match delivered behavior.
- State and handoff name the result and exact next action.
- G6 is marked complete only after the human accepts any required product decision.
