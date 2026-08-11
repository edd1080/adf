# Conversational Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a natural-language, agent-operated onboarding route at the beginning of the official ADF guide.

**Architecture:** Keep the CLI contract unchanged and document a conversational layer that delegates those same commands to Codex or OpenCode. Preserve existing source documents and normalize only the canonical G1 layer.

**Tech Stack:** Markdown documentation, ADF CLI, GitHub Spec Kit, Codex, OpenCode.

---

### Task 1: Add the conversational route

**Files:**

- Modify: `docs/day-zero.md`
- Modify: external deliverable `outputs/GUIA-OFICIAL-ADF-0.1.0.md`

1. Add the prerequisites the user must provide.
2. Add the preview, apply/validate, and intake prompts.
3. Keep the existing terminal reference below the conversational route.

### Task 2: Explain document ingestion

**Files:**

- Modify: `docs/day-zero.md`
- Modify: external deliverable `outputs/GUIA-OFICIAL-ADF-0.1.0.md`

1. Explain absent, partial, complete, generic, and brownfield inputs.
2. Define preservation of originals and the canonical normalization layer.
3. Clarify that README is optional and does not replace brief or PRD.
4. Explain why a behavioral prompt master is no longer necessary.

### Task 3: Verify and synchronize

**Files:**

- Verify: `docs/day-zero.md`
- Verify: external deliverable `outputs/GUIA-OFICIAL-ADF-0.1.0.md`

1. Run Prettier on the source guide.
2. Run the documentation format check.
3. Synchronize the source tree to the official checkout without touching `.git`, `node_modules`, or `dist`.
4. Do not commit, push, tag, or publish without separate authorization.
