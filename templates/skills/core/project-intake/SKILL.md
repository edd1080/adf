---
name: project-intake
description: "Guide project intake from an empty, partial, complete, or brownfield documentation set. Use when lifecycle is intake, the user says Inicia el proyecto, or project intake must reach Gate G1 before feature work."
license: MIT
metadata:
  adf-version: "0.1.0"
  adf-lifecycle: "intake"
  adf-trigger: "project intake"
  adf-dependencies: "grill-with-docs,domain-modeling"
---

# Project intake

Build the smallest approved product context that makes feature specification safe. Inspect first; ask only for decisions or unavailable evidence.

## Read

1. Read `AGENTS.md`, `.harness/manifest.yml`, `.harness/STATE.md`, and existing files under `docs/`.
2. Read `.specify/memory/constitution.md` when present.
3. For brownfield projects, inspect code and configuration as observational evidence.
4. Classify each source as `product`, `technical`, `observational`, or `reference`; preserve its declared status and owner.

## Process

1. Inventory documents as absent, partial, complete, contradictory, or obsolete.
2. Choose the matching intake path: guided interview, gap completion, consistency audit, or brownfield observation.
3. Establish `docs/product/brief.md`, `docs/product/prd.md`, `.specify/memory/constitution.md`, and `docs/references/index.md`.
4. Add conditional documents only when the project needs them: glossary, role-based user flows, UX/UI context, architecture, data, integrations, security, privacy, compliance, AI, or migration.
5. Describe each required role flow with purpose, preconditions, trigger, numbered main flow, alternatives, states, permissions, data effects, edge cases, acceptance criteria, open questions, and sources.
6. Mark unresolved facts as `[TBD — owner — blocker]`. Present contradictions and product choices to the human.

## May write

Create or update intake documents as `draft` or `review`. Mark a document `approved` and update G1 state only after explicit human approval. List every written path when the intake round ends.

## Stop

Stop on a blocking contradiction, an ownerless blocking TBD, or a request to implement code. Gate G1 requires human approval; validation evidence never grants approval. Keep Git publication and external mutation behind explicit authorization.

## Completion criteria

- Required documents exist with status, authority, owner, and review date.
- Required roles and flows are covered, references are indexed, and blocking contradictions are resolved.
- Blocking TBDs name an owner.
- The human explicitly approves G1.
- `.harness/STATE.md` names the exact next action without starting implementation.
