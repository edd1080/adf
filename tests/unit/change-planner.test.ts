import { describe, expect, it } from "vitest";

import { ManifestSchema, type Manifest } from "../../src/domain/manifest.js";
import { sha256 } from "../../src/infrastructure/hashing.js";
import {
  planChanges,
  renderChangePlanJson,
  renderChangePlanText,
} from "../../src/services/change-planner.js";
import type {
  ExistingFileObservation,
  ProjectInspection,
} from "../../src/services/project-inspector.js";
import { renderTemplate, type RenderedTemplate } from "../../src/services/template-registry.js";

const SHA_A = "a".repeat(64);

function inspection(files: ExistingFileObservation[] = []): ProjectInspection {
  return {
    root: "/project",
    kind: files.length === 0 ? "greenfield" : "brownfield",
    git: { present: false, dirty: "unknown" },
    specKit: { present: false },
    agents: {
      agentsMd: files.some((file) => file.path === "AGENTS.md"),
      codex: false,
      opencode: false,
    },
    documents: [],
    files,
    conflicts: [],
    warnings: [],
  };
}

function manifest(managedFiles: Manifest["managedFiles"]): Manifest {
  return ManifestSchema.parse({
    schemaVersion: 1,
    framework: {
      name: "adf",
      version: "0.1.0",
      installedAt: "2026-08-11T12:00:00.000Z",
    },
    specKit: {
      version: "0.13.3",
      defaultIntegration: "codex",
      installedIntegrations: ["codex"],
    },
    managedFiles,
    skills: [],
  });
}

function rendered(): RenderedTemplate[] {
  return [renderTemplate("product-brief", {}), renderTemplate("core-agents", {})];
}

describe("planChanges", () => {
  it("creates missing files in deterministic path order", () => {
    const plan = planChanges(inspection(), rendered());

    expect(plan.applicable).toBe(true);
    expect(plan.actions).toEqual([
      { kind: "create", path: "AGENTS.md" },
      { kind: "create", path: "docs/product/brief.md" },
    ]);
  });

  it("does nothing when installed bytes equal rendered bytes", () => {
    const templates = rendered();
    const files = templates.map((template) => ({
      path: template.targetPath,
      sha256: template.renderedSha256,
    }));

    const plan = planChanges(inspection(files), templates);

    expect(plan.actions.every((action) => action.kind === "noop")).toBe(true);
  });

  it("preserves a user-owned document with preserve strategy", () => {
    const brief = renderTemplate("product-brief", {});

    const plan = planChanges(inspection([{ path: brief.targetPath, sha256: SHA_A }]), [brief]);

    expect(plan.actions).toEqual([
      { kind: "preserve", path: "docs/product/brief.md", reason: "Existing user-owned file" },
    ]);
  });

  it("merges an existing AGENTS.md through managed markers", () => {
    const agents = renderTemplate("core-agents", {});

    const plan = planChanges(inspection([{ path: "AGENTS.md", sha256: SHA_A }]), [agents]);

    expect(plan.actions).toEqual([{ kind: "merge", path: "AGENTS.md", strategy: "managed-block" }]);
  });

  it("does not rewrite a matching managed block surrounded by user content", () => {
    const agents = renderTemplate("core-agents", {});
    const plan = planChanges(
      inspection([
        {
          path: "AGENTS.md",
          sha256: SHA_A,
          adfManagedBlockSha256: sha256(agents.content.trim()),
        },
      ]),
      [agents],
    );

    expect(plan.actions).toEqual([{ kind: "noop", path: "AGENTS.md" }]);
  });

  it("upgrades an unmodified managed file", () => {
    const state = renderTemplate("harness-state", {});
    const installed = manifest([
      {
        path: state.targetPath,
        strategy: "replace-if-unmodified",
        installedSha256: SHA_A,
      },
    ]);

    const plan = planChanges(
      inspection([{ path: state.targetPath, sha256: SHA_A }]),
      [state],
      installed,
    );

    expect(plan.actions).toEqual([
      {
        kind: "merge",
        path: ".harness/STATE.md",
        strategy: "replace-if-unmodified",
      },
    ]);
  });

  it("blocks an upgrade of a modified managed file", () => {
    const state = renderTemplate("harness-state", {});
    const installed = manifest([
      {
        path: state.targetPath,
        strategy: "replace-if-unmodified",
        installedSha256: SHA_A,
      },
    ]);

    const plan = planChanges(
      inspection([{ path: state.targetPath, sha256: "b".repeat(64) }]),
      [state],
      installed,
    );

    expect(plan.applicable).toBe(false);
    expect(plan.actions).toEqual([
      {
        kind: "conflict",
        path: ".harness/STATE.md",
        reason: "Managed file was modified after installation",
      },
    ]);
  });

  it("renders stable human and JSON previews", () => {
    const plan = planChanges(inspection(), rendered());

    expect(renderChangePlanText(plan)).toContain("CREATE\n  + AGENTS.md");
    expect(renderChangePlanJson(plan)).toBe(`${JSON.stringify(plan, null, 2)}\n`);
  });
});
