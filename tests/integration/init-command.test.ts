import { readdir, readFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import { runInit } from "../../src/commands/init.js";
import type { BootstrapProposal, SpecKitDetection } from "../../src/services/spec-kit-adapter.js";
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

describe("adf init", () => {
  it("previews and installs a greenfield harness after approval", async () => {
    const target = await project();
    const result = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies(),
    );

    expect(result.status).toBe("installed");
    expect(result.exitCode).toBe(0);
    expect(result.nextAction).toBe("Inicia el proyecto.");
    expect(result.plan.actions.some((action) => action.path === "AGENTS.md")).toBe(true);
    expect(await readFile(target.path(".harness/manifest.yml"), "utf8")).toContain("framework:");
    expect(await readFile(target.path(".agents/skills/project-intake/SKILL.md"), "utf8")).toContain(
      "name: project-intake",
    );
    expect(await readFile(target.path("AGENTS.md"), "utf8")).toContain("<!-- ADF:START -->");
    const manifest = parse(await readFile(target.path(".harness/manifest.yml"), "utf8")) as {
      managedFiles: Array<{ path: string; scope?: string }>;
    };
    expect(manifest.managedFiles).toContainEqual(
      expect.objectContaining({ path: "AGENTS.md", scope: "managed-block" }),
    );
  });

  it("performs zero writes during dry-run", async () => {
    const target = await project();
    const before = await readdir(target.root);

    const result = await runInit(
      {
        root: target.root,
        defaultAgent: "opencode",
        integrations: ["opencode"],
        dryRun: true,
      },
      dependencies(),
    );

    expect(result.status).toBe("dry-run");
    expect(await readdir(target.root)).toEqual(before);
  });

  it("aborts a conflict before any write", async () => {
    const target = await project();
    await target.write(".harness/STATE.md", "user-owned-state");

    const result = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies(),
    );

    expect(result.status).toBe("conflict");
    expect(result.exitCode).toBe(3);
    expect(await readFile(target.path(".harness/STATE.md"), "utf8")).toBe("user-owned-state");
    await expect(readFile(target.path(".harness/manifest.yml"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("returns success without writes when the user declines", async () => {
    const target = await project();
    const result = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"] },
      dependencies({ confirm: async () => false }),
    );

    expect(result.status).toBe("declined");
    expect(result.exitCode).toBe(0);
    expect(await readdir(target.root)).toEqual([]);
  });

  it("does not install Spec Kit implicitly when it is missing", async () => {
    const target = await project();
    const result = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies({ detection: missingSpecKit() }),
    );

    expect(result.status).toBe("blocked");
    expect(result.exitCode).toBe(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.remediation).join(" ")).toContain(
      "uv tool install specify-cli",
    );
    expect(await readdir(target.root)).toEqual([]);
  });

  it("previews the selected default and additional integration", async () => {
    const target = await project();
    const result = await runInit(
      {
        root: target.root,
        defaultAgent: "codex",
        integrations: ["codex", "opencode"],
        dryRun: true,
      },
      dependencies({
        proposal: {
          commands: [
            { command: "specify", args: ["init", ".", "--integration", "codex"] },
            { command: "specify", args: ["integration", "install", "opencode"] },
          ],
          deliveryMode: "bundle-workflow",
          diagnostics: [],
        },
      }),
    );

    expect(result.specKit.commands).toEqual([
      { command: "specify", args: ["init", ".", "--integration", "codex"] },
      { command: "specify", args: ["integration", "install", "opencode"] },
    ]);
    expect(result.json).toEqual(
      expect.objectContaining({
        status: "dry-run",
        plan: result.plan,
        diagnostics: result.diagnostics,
        nextAction: "Inicia el proyecto.",
      }),
    );
  });

  it("includes local preset and workflow registration in the approved preview", async () => {
    const target = await project();
    const result = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], dryRun: true },
      dependencies({
        detection: {
          ...availableSpecKit(),
          capabilities: { ...availableSpecKit().capabilities!, workflow: true },
        },
      }),
    );

    expect(result.specKit.commands).toEqual([
      { command: "specify", args: ["preset", "add", "--dev", ".harness/spec-kit/preset"] },
      {
        command: "specify",
        args: ["workflow", "add", "--dev", ".harness/spec-kit/workflow"],
      },
    ]);
  });

  it("preserves the existing Spec Kit default and records requested additional agents", async () => {
    const target = await project();
    const result = await runInit(
      {
        root: target.root,
        defaultAgent: "codex",
        integrations: ["codex"],
        yes: true,
      },
      dependencies({
        detection: {
          ...availableSpecKit(),
          capabilities: {
            ...availableSpecKit().capabilities!,
            integrations: ["opencode", "codex"],
            defaultIntegration: "opencode",
          },
        },
      }),
    );
    const manifest = parse(await readFile(target.path(".harness/manifest.yml"), "utf8")) as {
      specKit: { defaultIntegration: string; installedIntegrations: string[] };
    };

    expect(result.status).toBe("installed");
    expect(manifest.specKit.defaultIntegration).toBe("opencode");
    expect(manifest.specKit.installedIntegrations).toEqual(["opencode", "codex"]);
  });

  it("executes Spec Kit bootstrap before writing ADF files", async () => {
    const target = await project();
    let manifestExistedDuringBootstrap = true;
    const events: string[] = [];
    const result = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies({
        detection: { ...availableSpecKit(), initialized: false },
        proposal: {
          commands: [{ command: "specify", args: ["init", ".", "--integration", "codex"] }],
          deliveryMode: "local-templates",
          diagnostics: [],
        },
        preview: async () => {
          events.push("preview");
        },
        execute: async () => {
          events.push("spec-kit");
          manifestExistedDuringBootstrap = await fileExists(target.path(".harness/manifest.yml"));
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      }),
    );

    expect(result.status).toBe("installed");
    expect(manifestExistedDuringBootstrap).toBe(false);
    expect(events).toEqual(["preview", "spec-kit"]);
  });

  it("blocks non-interactive brownfield Spec Kit initialization before writes", async () => {
    const target = await project();
    await target.write("README.md", "# Existing project\n");
    let executed = false;

    const result = await runInit(
      { root: target.root, defaultAgent: "codex", integrations: ["codex"], yes: true },
      dependencies({
        detection: { ...availableSpecKit(), initialized: false },
        proposal: {
          commands: [{ command: "specify", args: ["init", ".", "--integration", "codex"] }],
          deliveryMode: "local-templates",
          diagnostics: [],
        },
        execute: async () => {
          executed = true;
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      }),
    );

    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map((item) => item.code)).toContain("SPEC_KIT_CONFIRMATION_REQUIRED");
    expect(executed).toBe(false);
    expect(await readFile(target.path("README.md"), "utf8")).toBe("# Existing project\n");
    expect(await fileExists(target.path(".harness/manifest.yml"))).toBe(false);
  });
});

type DependencyOverrides = {
  confirm?: () => Promise<boolean>;
  detection?: SpecKitDetection;
  proposal?: BootstrapProposal;
  preview?: () => Promise<void>;
  execute?: () => Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

function dependencies(overrides: DependencyOverrides = {}) {
  const detection = overrides.detection ?? availableSpecKit();
  const proposal = overrides.proposal ?? {
    commands: [],
    deliveryMode: "local-templates" as const,
    diagnostics: [],
  };
  return {
    now: () => new Date("2026-08-11T12:00:00.000Z"),
    ...(overrides.preview === undefined ? {} : { preview: overrides.preview }),
    confirm: overrides.confirm ?? (async () => true),
    specKit: {
      detect: async () => detection,
      proposeBootstrap: () => proposal,
    },
    execute: overrides.execute ?? (async () => ({ exitCode: 0, stdout: "", stderr: "" })),
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

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

function missingSpecKit(): SpecKitDetection {
  return {
    available: false,
    initialized: false,
    diagnostics: [
      {
        severity: "error",
        code: "SPEC_KIT_MISSING",
        message: "specify was not found",
        remediation: "Install with: uv tool install specify-cli",
      },
    ],
  };
}
