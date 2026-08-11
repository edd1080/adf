import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

import { FileActionSchema } from "../../src/domain/change-plan.js";
import { DiagnosticSchema } from "../../src/domain/diagnostics.js";
import { ManifestSchema } from "../../src/domain/manifest.js";
import { StateSchema } from "../../src/domain/state.js";

const SHA256 = "a".repeat(64);

describe("StateSchema", () => {
  it("accepts the initial intake state", () => {
    const state = StateSchema.parse({
      schemaVersion: 1,
      lifecycle: "intake",
      currentGate: "G1",
      activeFeature: null,
      approvals: { G1: false, G2: false, G3: false },
      nextAction: { prompt: "Inicia el proyecto." },
    });

    expect(state.lifecycle).toBe("intake");
  });

  it("rejects G4 while earlier human gates are unapproved", () => {
    expect(() =>
      StateSchema.parse({
        schemaVersion: 1,
        lifecycle: "implementation",
        currentGate: "G4",
        activeFeature: "001-bootstrap",
        approvals: { G1: false, G2: false, G3: false },
        nextAction: { prompt: "Implementa." },
      }),
    ).toThrow(/G1, G2 and G3/);
  });

  it("rejects an active feature during intake", () => {
    expect(() =>
      StateSchema.parse({
        schemaVersion: 1,
        lifecycle: "intake",
        currentGate: "G1",
        activeFeature: "001-too-early",
        approvals: { G1: false, G2: false, G3: false },
        nextAction: { prompt: "Inicia el proyecto." },
      }),
    ).toThrow(/active feature/i);
  });
});

describe("ManifestSchema", () => {
  it("requires a SHA-256 for each managed file", () => {
    expect(() =>
      ManifestSchema.parse({
        schemaVersion: 1,
        framework: {
          name: "adf",
          version: "0.1.0",
          installedAt: "2026-08-11T12:00:00.000Z",
        },
        specKit: {
          version: "0.13.3",
          defaultIntegration: "codex",
          installedIntegrations: ["codex", "opencode"],
        },
        managedFiles: [{ path: "AGENTS.md", strategy: "merge-markers" }],
        skills: [],
      }),
    ).toThrow();
  });

  it("requires provenance for vendored skills", () => {
    expect(() =>
      ManifestSchema.parse({
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
        managedFiles: [],
        skills: [
          {
            kind: "vendored",
            name: "grilling",
            source: "https://github.com/mattpocock/skills",
            adaptedSha256: SHA256,
          },
        ],
      }),
    ).toThrow();
  });
});

describe("FileActionSchema", () => {
  it("accepts the five supported action kinds", () => {
    const actions = [
      { kind: "create", path: "AGENTS.md" },
      { kind: "preserve", path: "README.md", reason: "User owned" },
      { kind: "merge", path: "AGENTS.md", strategy: "managed-block" },
      { kind: "conflict", path: "opencode.json", reason: "Invalid JSON" },
      { kind: "noop", path: ".harness/STATE.md" },
    ];

    expect(actions.map((action) => FileActionSchema.parse(action).kind)).toEqual([
      "create",
      "preserve",
      "merge",
      "conflict",
      "noop",
    ]);
  });

  it("rejects paths that escape the project root", () => {
    expect(() => FileActionSchema.parse({ kind: "create", path: "../AGENTS.md" })).toThrow(
      /relative path/i,
    );
  });
});

describe("DiagnosticSchema", () => {
  it("preserves an actionable remediation", () => {
    const diagnostic = DiagnosticSchema.parse({
      severity: "error",
      code: "SPEC_KIT_MISSING",
      message: "Spec Kit is not available.",
      remediation: "Install a pinned official Spec Kit release.",
    });

    expect(diagnostic.remediation).toContain("pinned");
  });
});

describe("editor JSON schemas", () => {
  it.each([
    ["manifest", new URL("../../schemas/manifest.schema.json", import.meta.url)],
    ["state", new URL("../../schemas/state.schema.json", import.meta.url)],
  ])("ships a parseable %s schema", async (_name, url) => {
    const schema = JSON.parse(await readFile(url, "utf8")) as {
      $schema?: string;
      required?: string[];
    };

    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.required).toContain("schemaVersion");
  });
});
