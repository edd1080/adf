# npx Distribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish ADF as `adf-harness-kit` with a guided `npx` entry and a deterministic `init` command.

**Architecture:** Add a small onboarding domain service that builds validated wizard input and the final chat prompt. The CLI root action collects terminal answers and delegates to the existing `runInit`; explicit subcommands remain unchanged.

**Tech Stack:** TypeScript, Commander, Clack, Vitest, npm, GitHub Spec Kit.

---

### Task 1: Define the onboarding contract

**Files:**

- Create: `src/services/onboarding.ts`
- Test: `tests/unit/onboarding.test.ts`

1. Write failing tests for agent selection, additional integration, documentation path, cancellation, and the final prompt.
2. Implement the minimal pure onboarding helpers.
3. Run the focused test and typecheck.

### Task 2: Add the root wizard

**Files:**

- Modify: `src/cli.ts`
- Test: `tests/unit/cli.test.ts`
- Test: `tests/clean-room/npm-pack.test.ts`

1. Add dependency-injected wizard answers and a root action.
2. Delegate installation to the existing init execution path.
3. Preserve `init`, `doctor`, `status`, `next`, and `update` behavior.
4. Verify both package-name and `adf` binary shims.

### Task 3: Prepare npm metadata

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

1. Rename the package to `adf-harness-kit`.
2. Remove `private`, add public publish, repository, homepage, bugs, keywords, and both binary aliases.
3. Verify package contents with `npm pack --dry-run`.

### Task 4: Update onboarding documentation

**Files:**

- Modify: `README.md`
- Modify: `docs/day-zero.md`
- Modify: `docs/upgrades.md`
- Modify: external official guide output

1. Make `npx adf-harness-kit@latest` the primary path.
2. Keep tarball and explicit `init` as advanced alternatives.
3. Explain the Prompt 1 alternative and the `init` boundary.

### Task 5: Verify and release

**Files:**

- Verify: complete repository

1. Run `npm run verify`.
2. Pack and execute both binaries from the tarball in a clean room.
3. Synchronize the official checkout.
4. Create the initial Git history and push `main` after authentication permits it.
5. Authenticate npm, publish `0.1.0`, and verify `npx adf-harness-kit@latest` from a clean cache.
6. Do not claim publication until registry and clean-room evidence are both present.
