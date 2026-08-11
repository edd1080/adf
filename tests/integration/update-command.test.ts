import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import { runInit } from "../../src/commands/init.js";
import { runUpdate } from "../../src/commands/update.js";
import { sha256 } from "../../src/infrastructure/hashing.js";
import {
  composeHarnessTemplates,
  type HarnessComposition,
} from "../../src/services/harness-composer.js";
import type { RenderedTemplate } from "../../src/services/template-registry.js";
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
    initDependencies(),
  );
  return target;
}

describe("adf update", () => {
  it("reports changes without writes under --check", async () => {
    const target = await installedProject();
    const before = await readFile(target.path(".harness/manifest.yml"));
    const source = upgradedComposition("0.2.0");

    const result = await runUpdate({ root: target.root, check: true }, { source });

    expect(result.status).toBe("updates-available");
    expect(await readFile(target.path(".harness/manifest.yml"))).toEqual(before);
  });

  it("upgrades unmodified managed files and creates a new template", async () => {
    const target = await installedProject();
    const source = upgradedComposition("0.2.0", [
      template("new-static", ".agents/skills/new-static/SKILL.md", "new"),
    ]);

    const result = await runUpdate({ root: target.root }, { source });

    expect(result.status).toBe("updated");
    expect(await readFile(target.path(".agents/skills/new-static/SKILL.md"), "utf8")).toBe("new");
    const manifest = parse(await readFile(target.path(".harness/manifest.yml"), "utf8")) as {
      framework: { version: string };
    };
    expect(manifest.framework.version).toBe("0.2.0");
  });

  it("turns a user-modified managed file into a conflict", async () => {
    const target = await installedProject();
    await target.write(".agents/skills/project-intake/SKILL.md", "user modification");

    const result = await runUpdate({ root: target.root }, { source: upgradedComposition("0.2.0") });

    expect(result.status).toBe("conflict");
    expect(result.exitCode).toBe(3);
    expect(await readFile(target.path(".agents/skills/project-intake/SKILL.md"), "utf8")).toBe(
      "user modification",
    );
  });

  it("reports removed templates as orphaned without deleting them", async () => {
    const target = await installedProject();
    const current = composeHarnessTemplates(compositionInput("0.2.0"));
    const source: HarnessComposition = {
      ...current,
      templates: current.templates.filter(
        (item) => item.targetPath !== ".agents/skills/project-intake/SKILL.md",
      ),
    };

    const result = await runUpdate({ root: target.root }, { source });

    expect(result.orphaned).toContain(".agents/skills/project-intake/SKILL.md");
    expect(await readFile(target.path(".agents/skills/project-intake/SKILL.md"), "utf8")).toContain(
      "name: project-intake",
    );
  });

  it("updates vendored provenance and adapted hashes together", async () => {
    const target = await installedProject();
    const result = await runUpdate({ root: target.root }, { source: upgradedComposition("0.2.0") });
    const manifest = parse(await readFile(target.path(".harness/manifest.yml"), "utf8")) as {
      skills: Array<{
        kind: string;
        name: string;
        adaptedSha256?: string;
        upstreamCommit?: string;
      }>;
    };
    const grilling = manifest.skills.find((skill) => skill.name === "grilling");

    expect(result.status).toBe("updated");
    expect(grilling?.upstreamCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(grilling?.adaptedSha256).toBe(
      sha256(await readFile(target.path(".agents/skills/grilling/SKILL.md"))),
    );
  });

  it("updates the AGENTS managed block while preserving user instructions", async () => {
    const target = await installedProject();
    const existing = await readFile(target.path("AGENTS.md"), "utf8");
    await target.write("AGENTS.md", `# User instructions\n\nKeep me.\n\n${existing}`);
    const source = upgradedComposition("0.2.0");
    source.templates = source.templates.map((item) =>
      item.targetPath === "AGENTS.md"
        ? template(
            item.id,
            item.targetPath,
            `${item.content}\nNew managed routing rule.\n`,
            "merge-markers",
          )
        : item,
    );

    const result = await runUpdate({ root: target.root }, { source });
    const agents = await readFile(target.path("AGENTS.md"), "utf8");

    expect(result.status).toBe("updated");
    expect(agents).toContain("# User instructions");
    expect(agents).toContain("New managed routing rule.");
  });

  it("refuses to overwrite a user-modified AGENTS managed block", async () => {
    const target = await installedProject();
    const existing = await readFile(target.path("AGENTS.md"), "utf8");
    const modified = existing.replace("Project Lifecycle Router", "Locally modified router");
    await target.write("AGENTS.md", modified);

    const result = await runUpdate({ root: target.root }, { source: upgradedComposition("0.2.0") });

    expect(result.status).toBe("conflict");
    expect(result.exitCode).toBe(3);
    expect(await readFile(target.path("AGENTS.md"), "utf8")).toBe(modified);
  });
});

function upgradedComposition(
  version: string,
  additions: RenderedTemplate[] = [],
): HarnessComposition {
  const current = composeHarnessTemplates(compositionInput(version));
  const templates = current.templates.map((item) =>
    item.targetPath === ".agents/skills/project-intake/SKILL.md"
      ? template(item.id, item.targetPath, `${item.content}\n<!-- upgraded -->\n`)
      : item,
  );
  return { ...current, templates: [...templates, ...additions] };
}

function compositionInput(frameworkVersion: string) {
  return {
    frameworkVersion,
    installedAt: "2026-08-11T12:00:00.000Z",
    specKitVersion: "0.13.3",
    defaultIntegration: "codex" as const,
    installedIntegrations: ["codex" as const],
  };
}

function template(
  id: string,
  targetPath: string,
  content: string,
  strategy: RenderedTemplate["strategy"] = "replace-if-unmodified",
): RenderedTemplate {
  return {
    id,
    targetPath,
    strategy,
    version: "0.2.0",
    sha256: sha256(content),
    variables: [],
    content,
    renderedSha256: sha256(content),
  };
}

function initDependencies() {
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
          workflow: false,
          multiIntegration: true,
          integrations: ["codex"],
          defaultIntegration: "codex",
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
