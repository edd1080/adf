import { readFile, stat } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { runDoctor } from "../../src/commands/doctor.js";
import { runInit } from "../../src/commands/init.js";
import { runNext } from "../../src/commands/next.js";
import { runStatus } from "../../src/commands/status.js";
import type { SpecKitDetection } from "../../src/services/spec-kit-adapter.js";
import { createTempProject, type TempProject } from "../helpers/temp-project.js";

const projects: TempProject[] = [];

afterEach(async () => {
  await Promise.all(projects.splice(0).map((project) => project.cleanup()));
});

async function installedProject(): Promise<TempProject> {
  const target = await createTempProject();
  projects.push(target);
  await runInit(
    { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
    {
      now: () => new Date("2026-08-11T12:00:00.000Z"),
      confirm: async () => true,
      specKit: {
        detect: async () => availableSpecKit(),
        proposeBootstrap: () => ({
          commands: [],
          deliveryMode: "local-templates",
          diagnostics: [],
        }),
      },
      execute: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    },
  );
  return target;
}

describe("read-only commands", () => {
  it("doctor validates installed files, skill dependencies and lifecycle routing", async () => {
    const target = await installedProject();
    const report = await runDoctor(target.root, {
      specKit: { detect: async () => availableSpecKit() },
    });

    expect(report.healthy).toBe(true);
    expect(report.exitCode).toBe(0);
    expect(report.diagnostics.some((diagnostic) => diagnostic.code === "DOCTOR_OK")).toBe(true);
  });

  it("doctor fails on a modified managed file and malformed document authority", async () => {
    const target = await installedProject();
    await target.write(".agents/skills/project-intake/SKILL.md", "modified");
    await target.write(
      "docs/product/invalid.md",
      "---\nstatus: draft\nauthority: rumor\nowner: test\nlast_reviewed: 2026-08-11\n---\n",
    );

    const report = await runDoctor(target.root, {
      specKit: { detect: async () => availableSpecKit() },
    });

    expect(report.healthy).toBe(false);
    expect(report.exitCode).toBe(1);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["MANAGED_HASH_MISMATCH", "DOCUMENT_AUTHORITY_INVALID"]),
    );
  });

  it("doctor detects modification inside the AGENTS managed block", async () => {
    const target = await installedProject();
    const agents = await readFile(target.path("AGENTS.md"), "utf8");
    await target.write("AGENTS.md", agents.replace("Project Lifecycle Router", "Changed router"));

    const report = await runDoctor(target.root, {
      specKit: { detect: async () => availableSpecKit() },
    });

    expect(report.healthy).toBe(false);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MANAGED_HASH_MISMATCH" }),
        expect.objectContaining({ code: "AGENTS_ROUTER_INVALID" }),
      ]),
    );
  });

  it("status reports lifecycle, gate, active feature, blockers and last session", async () => {
    const target = await installedProject();
    const status = await runStatus(target.root);

    expect(status).toEqual(
      expect.objectContaining({
        lifecycle: "intake",
        currentGate: "G1",
        activeFeature: null,
        blockers: [],
        lastSession: null,
        exitCode: 0,
      }),
    );
  });

  it("next returns exactly one action for each lifecycle branch", async () => {
    const target = await installedProject();
    expect((await runNext(target.root)).action).toBe("Inicia el proyecto.");

    await target.write(
      ".harness/HANDOFF.md",
      "# Active Handoff\n\nObjective: continue implementation.\n",
    );
    expect((await runNext(target.root)).action).toBe("Continúa el proyecto.");

    const state = await readFile(target.path(".harness/STATE.md"), "utf8");
    await target.write(
      ".harness/STATE.md",
      state
        .replace("lifecycle: intake", "lifecycle: project-ready")
        .replace("G1: false", "G1: true"),
    );
    await target.write(".harness/HANDOFF.md", "# Active Handoff\n\nNo active handoff.\n");
    expect((await runNext(target.root)).action).toBe("Selecciona la primera feature.");
  });

  it("performs zero mutations on a dirty tree", async () => {
    const target = await installedProject();
    await target.write("user-dirty.txt", "keep");
    const before = await stat(target.path("user-dirty.txt"));

    await runDoctor(target.root, { specKit: { detect: async () => availableSpecKit() } });
    await runStatus(target.root);
    await runNext(target.root);

    const after = await stat(target.path("user-dirty.txt"));
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect(await readFile(target.path("user-dirty.txt"), "utf8")).toBe("keep");
  });
});

function availableSpecKit(): SpecKitDetection {
  return {
    available: true,
    initialized: true,
    capabilities: {
      version: "0.13.3",
      bundle: false,
      workflow: false,
      multiIntegration: true,
      integrations: ["codex"],
      defaultIntegration: "codex",
    },
    diagnostics: [],
  };
}
