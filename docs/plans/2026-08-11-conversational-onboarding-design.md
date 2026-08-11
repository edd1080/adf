# Conversational Onboarding Design

## Decision

ADF will document two equivalent operating surfaces: a recommended conversational route for users who delegate terminal work to Codex or OpenCode, and a command reference for users who operate the terminal directly.

The conversational route uses three approval-aware prompts:

1. Inspect prerequisites and produce an ADF dry-run preview.
2. Apply the approved plan and validate the harness.
3. Start project intake after inspecting existing documentation.

## Documentation ingestion policy

Existing project documents are user-owned sources. ADF must inventory and classify them before asking questions or writing. It preserves originals, maps their content to the canonical ADF paths, and creates or updates only the smallest canonical layer required for G1.

Generic or differently structured documents are acceptable inputs. Before G1, their relevant decisions must be represented in canonical documents with predictable paths, metadata, unresolved TBDs, contradictions, and traceability to the sources.

## Prompt-master policy

ADF replaces the behavioral portion of a project prompt master through `AGENTS.md`, lifecycle state, skills, gates, and Spec Kit. Product context still travels as repository documentation. The normal first project instruction remains `Inicia el proyecto`, optionally followed by the location of imported discovery documents and an instruction to preserve them.

## Safety

- Preview precedes installation.
- Missing prerequisites are reported before installation.
- No `--force`, commit, push, tag, publication, deployment, or document reorganization is implied.
- G1–G4 remain explicit human decisions.
