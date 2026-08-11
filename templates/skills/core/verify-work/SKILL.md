---
name: verify-work
description: "Prove completed work against its Definition of Done with reproducible evidence. Use when checking a slice, validating a task, preparing completion, or performing work verification."
license: MIT
metadata:
  adf-version: "0.1.0"
  adf-lifecycle: "active-feature"
  adf-trigger: "work verification"
  adf-dependencies: ""
---

# Verify work

Treat completion as a claim that must map to current evidence.

## Read

1. Read the active `spec.md`, `plan.md`, `tasks.md`, `verification.md`, and applicable project checks.
2. Read the changed-file inventory and repository diff.
3. Identify each acceptance criterion, task result, and Definition of Done item.

## Process

1. Build an evidence matrix with criterion, verification method, exact command or observation, result, and artifact path.
2. Run proportional focused checks, then relevant regressions, typecheck, lint, and build where applicable.
3. Compare behavior with the fixed point when the change could cause a regression.
4. Mark gaps as failed or blocked; never convert an unrun check into a pass.

## May write

Update `verification.md`, task checkboxes, and state only with evidence observed in this run. Inventory those documentation writes and their supporting command results.

## Stop

Stop completion when any required criterion lacks evidence, a command fails, the environment cannot run a required check, or the diff exceeds approved scope. Risky or external verification requires explicit authorization.

## Completion criteria

- Every required criterion maps to fresh evidence.
- Every command includes its exit result and relevant output summary.
- Failures, skipped checks, and environmental limits remain visible.
- The result is exactly `PASS`, `FAIL`, or `BLOCKED`; only `PASS` can advance the gate.
