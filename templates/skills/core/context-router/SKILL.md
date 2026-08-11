---
name: context-router
description: "Select the minimum authoritative project and feature documents for a task. Use when starting non-trivial implementation, review, debugging, data, UX/UI, integration, security, or context routing work."
license: MIT
metadata:
  adf-version: "0.1.0"
  adf-lifecycle: "any"
  adf-trigger: "context routing"
  adf-dependencies: ""
---

# Context router

Load only the context that can change the task's decisions, constraints, or completion criteria.

## Read

1. Read `.harness/STATE.md` and the active feature artifacts.
2. Map task signals to product flows, glossary, UX/UI, architecture, data, integrations, security, references, decisions, and constitution files.
3. Inspect document frontmatter before treating a source as governing.

## Process

1. Start with the task's observable behavior and active Definition of Done.
2. Select the smallest document set that covers product intent, technical constraints, and verification.
3. Order authority as approved governing docs, approved feature artifacts, explicit human decisions, observational evidence, then references.
4. Report missing context, stale sources, and every contradiction before planning a mutation.

## May write

This skill is read-only. Return a context manifest containing selected paths, authority, relevance, and unresolved conflicts. Report `Writes: none`.

## Stop

Stop when two governing sources contradict, a required document is missing, or a draft is being treated as approved. Resume only after the authority or decision is explicit. External reads and any repository mutation require their applicable explicit authorization.

## Completion criteria

- Every selected file has a stated reason and authority.
- No selected reference silently becomes a requirement.
- Missing sources and contradictions are visible.
- The downstream plan cites the selected sources and its verification target.
