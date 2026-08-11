import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { runDoctor } from "../../src/commands/doctor.js";
import { runInit } from "../../src/commands/init.js";
import { runNext } from "../../src/commands/next.js";
import { createTempProject, type TempProject } from "../helpers/temp-project.js";

const projects: TempProject[] = [];

afterEach(async () => {
  await Promise.all(projects.splice(0).map((project) => project.cleanup()));
});

describe("ADF clean-room Day Zero", () => {
  it("takes an empty directory to a healthy G1 intake without product code", async () => {
    const target = await project();
    const dependencies = harnessDependencies(["codex"]);

    const installed = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies,
    );
    const doctor = await runDoctor(target.root, { specKit: dependencies.specKit });
    const next = await runNext(target.root);

    expect(installed.status).toBe("installed");
    expect(doctor.healthy).toBe(true);
    expect(next.action).toBe("Inicia el proyecto.");
    expect(installed.written.some((path) => /(?:src|app)\//.test(path))).toBe(false);
  });

  it("preserves brownfield instructions and existing product evidence", async () => {
    const target = await project();
    const dependencies = harnessDependencies(["codex"]);
    const brief = `---\ntitle: Existing brief\nstatus: draft\nauthority: product\nowner: owner\nlast_reviewed: 2026-08-11\n---\n\n# Existing brief\n`;
    await target.write("AGENTS.md", "# Existing local rules\n\nKeep this section.\n");
    await target.write("docs/product/brief.md", brief);
    await target.write("src/index.ts", "export const existing = true;\n");

    const installed = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies,
    );

    expect(installed.status).toBe("installed");
    expect(await readFile(target.path("docs/product/brief.md"), "utf8")).toBe(brief);
    expect(await readFile(target.path("src/index.ts"), "utf8")).toBe(
      "export const existing = true;\n",
    );
    expect(await readFile(target.path("AGENTS.md"), "utf8")).toContain("Keep this section.");
    expect(await readFile(target.path("AGENTS.md"), "utf8")).toContain("ADF:START");

    const repeated = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies,
    );
    expect(repeated.status).toBe("installed");
    expect(repeated.written).toEqual([]);
  });

  it("is idempotent and performs zero ADF writes on a second install", async () => {
    const target = await project();
    const dependencies = harnessDependencies(["codex"]);
    await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies,
    );
    const before = await readFile(target.path(".harness/manifest.yml"));

    const repeated = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies,
    );

    expect(repeated.status).toBe("installed");
    expect(repeated.written).toEqual([]);
    expect(await readFile(target.path(".harness/manifest.yml"))).toEqual(before);
    expect(repeated.plan.actions.every((action) => action.kind === "noop")).toBe(true);
  });

  it("installs one shared skill set for Codex and OpenCode", async () => {
    const target = await project();
    const installed = await runInit(
      {
        root: target.root,
        defaultAgent: "codex",
        integrations: ["codex", "opencode"],
        yes: true,
      },
      harnessDependencies(["codex", "opencode"]),
    );

    expect(installed.status).toBe("installed");
    expect(await readFile(target.path("opencode.json"), "utf8")).toContain("permission");
    expect(await readFile(target.path(".opencode/agents/reviewer.md"), "utf8")).toContain("review");
    expect(
      installed.plan.actions.filter(
        (action) => action.path === ".agents/skills/project-intake/SKILL.md",
      ),
    ).toHaveLength(1);
  });
});

async function project(): Promise<TempProject> {
  const value = await createTempProject();
  projects.push(value);
  return value;
}

function harnessDependencies(integrations: string[]) {
  return {
    now: () => new Date("2026-08-11T12:00:00.000Z"),
    confirm: async () => true,
    specKit: {
      detect: async () => ({
        available: true,
        initialized: true,
        capabilities: {
          version: "0.13.3",
          bundle: false,
          workflow: true,
          multiIntegration: true,
          integrations,
          defaultIntegration: integrations[0],
        },
        diagnostics: [],
      }),
      proposeBootstrap: () => ({
        commands: [],
        deliveryMode: "local-templates" as const,
        diagnostics: [],
      }),
    },
    execute: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
  };
}
