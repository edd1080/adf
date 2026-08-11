---
name: bug-fix
description: "Drive evidence-first bug fixing from exact symptom to verified regression protection. Use when a bug, defect, failure, exception, wrong result, or performance regression is reported."
license: MIT
metadata:
  adf-version: "0.1.0"
  adf-lifecycle: "active-feature"
  adf-trigger: "bug fixing"
  adf-dependencies: "context-router,diagnosing-bugs,tdd,verify-work"
---

# Bug fix

Use the smallest reproducible loop to find and remove the root cause.

## Read

1. Read the report, relevant context selected by `context-router`, active specs, logs, and recent changes.
2. Read applicable glossary terms and decisions before naming the failure.
3. Redact secrets from every displayed command, log, trace, and fixture.

## Process

1. Invoke `diagnosing-bugs` and build one tight, deterministic, red-capable command for the user's exact symptom.
2. Reproduce and minimize before ranking falsifiable hypotheses.
3. Confirm the correct public seam, then invoke `tdd`: write the regression test, observe RED, implement the minimal root-cause fix, and observe GREEN.
4. Re-run the original unminimized loop and relevant regression suite.
5. Remove tagged instrumentation and temporary harnesses.

## May write

After Gate G4 and explicit `GO`, write the minimal test, source, fixture, and verification changes required by the root cause. Inventory every path and explain temporary artifacts that were removed.

## Stop

Stop if no red-capable loop can be built, the observed symptom differs from the report, the correct test seam is absent, or the fix contradicts approved behavior. Request the missing evidence or decision. Git publication and external mutation require explicit authorization.

## Completion criteria

- The minimized repro failed before the fix and the regression test records that RED evidence.
- The root cause and falsified alternatives are stated.
- The minimal fix passes the regression test and original repro.
- Relevant checks pass, instrumentation is removed, and evidence is recorded.
