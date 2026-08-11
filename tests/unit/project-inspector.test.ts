import { cp, mkdir, symlink } from "node:fs/promises";
import { dirname } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { inspectProject } from "../../src/services/project-inspector.js";
import { SystemProcessRunner } from "../../src/infrastructure/process-runner.js";
import { createTempProject, type TempProject } from "../helpers/temp-project.js";

const projects: TempProject[] = [];

afterEach(async () => {
  await Promise.all(projects.splice(0).map((project) => project.cleanup()));
});

async function project(): Promise<TempProject> {
  const value = await createTempProject();
  projects.push(value);
  return value;
}

describe("inspectProject", () => {
  it("classifies an empty directory as greenfield", async () => {
    const target = await project();

    const inspection = await inspectProject(target.root);

    expect(inspection.kind).toBe("greenfield");
    expect(inspection.git).toEqual({ present: false, dirty: "unknown" });
    expect(inspection.documents).toEqual([]);
  });

  it("classifies application metadata as brownfield", async () => {
    const target = await project();
    await target.write("package.json", '{"name":"existing-app"}');

    const inspection = await inspectProject(target.root);

    expect(inspection.kind).toBe("brownfield");
  });

  it("detects Spec Kit and both agent adapters", async () => {
    const target = await project();
    await target.write(".specify/integration.json", '{"default_integration":"codex"}');
    await target.write("AGENTS.md", "# Existing rules\n");
    await target.write(".codex/config.toml", "# existing\n");
    await target.write("opencode.json", '{"$schema":"https://opencode.ai/config.json"}');

    const inspection = await inspectProject(target.root);

    expect(inspection.specKit).toEqual({
      present: true,
      integrationFile: ".specify/integration.json",
    });
    expect(inspection.agents).toEqual({ agentsMd: true, codex: true, opencode: true });
  });

  it("inventories document authority and status", async () => {
    const target = await project();
    const fixture = new URL("../fixtures/projects/partial-docs", import.meta.url);
    await cp(fixture, target.root, { recursive: true });

    const inspection = await inspectProject(target.root);

    expect(inspection.documents).toEqual([
      expect.objectContaining({
        path: "docs/product/brief.md",
        status: "draft",
        authority: "product",
      }),
    ]);
  });

  it("reports a dirty Git repository as a warning, not a conflict", async () => {
    const target = await project();
    const runner = new SystemProcessRunner();
    expect((await runner.run("git", ["init"], { cwd: target.root })).exitCode).toBe(0);
    await target.write("untracked.txt", "dirty");

    const inspection = await inspectProject(target.root);

    expect(inspection.git).toEqual({ present: true, dirty: true });
    expect(inspection.conflicts).not.toContainEqual(expect.objectContaining({ code: "GIT_DIRTY" }));
    expect(inspection.warnings).toContainEqual(expect.objectContaining({ code: "GIT_DIRTY" }));
  });

  it("blocks a symlink that resolves outside the target", async () => {
    const target = await project();
    const outside = await project();
    const link = target.path("docs/external");
    await mkdir(dirname(link), { recursive: true });
    await symlink(outside.root, link);

    const inspection = await inspectProject(target.root);

    expect(inspection.conflicts).toContainEqual(
      expect.objectContaining({ code: "SYMLINK_ESCAPE", severity: "error" }),
    );
  });
});
