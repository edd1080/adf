import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { runInit } from "../../src/commands/init.js";
import { createTempProject, type TempProject } from "../helpers/temp-project.js";

const projects: TempProject[] = [];

afterEach(async () => {
  await Promise.all(projects.splice(0).map((project) => project.cleanup()));
});

describe("Spec Kit package delivery", () => {
  it("installs the local preset, workflow, step, and bundle sources into a clean project", async () => {
    const target = await createTempProject();
    projects.push(target);

    const result = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies(),
    );

    expect(result.status).toBe("installed");
    await expect(
      readFile(target.path(".harness/spec-kit/workflow/workflow.yml"), "utf8"),
    ).resolves.toContain("id: adf-day-zero");
    await expect(
      readFile(target.path(".harness/spec-kit/preset/preset.yml"), "utf8"),
    ).resolves.toContain("id: adf-guardrails");
    await expect(
      readFile(target.path(".harness/spec-kit/steps/adf-validate-gate/step.yml"), "utf8"),
    ).resolves.toContain("id: adf-validate-gate");
    await expect(
      readFile(target.path(".harness/spec-kit/bundle/bundle.yml"), "utf8"),
    ).resolves.toContain("id: adf");
  });
});

function dependencies() {
  return {
    now: () => new Date("2026-08-11T12:00:00.000Z"),
    confirm: async () => true,
    specKit: {
      detect: async () => ({
        available: true,
        initialized: true,
        capabilities: {
          version: "0.13.3",
          bundle: true,
          workflow: true,
          multiIntegration: true,
          integrations: ["codex"],
          defaultIntegration: "codex",
        },
        diagnostics: [],
      }),
      proposeBootstrap: () => ({
        commands: [],
        deliveryMode: "bundle-workflow" as const,
        diagnostics: [],
      }),
    },
    execute: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
  };
}
