import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Workflow = {
  schema_version: string;
  workflow: { id: string; version: string };
  requires: { integrations: { any: string[] } };
  inputs: Record<string, { default?: string; enum?: string[] }>;
  steps: Array<{
    id: string;
    type?: string;
    command?: string;
    options?: string[];
    verdict_input?: string;
  }>;
};

const root = new URL("../../templates/spec-kit/", import.meta.url);

describe("ADF Spec Kit package", () => {
  it("defines a deterministic G1-G4 workflow that stops before implementation", async () => {
    const workflow = parse(
      await readFile(new URL("workflow/workflow.yml", root), "utf8"),
    ) as Workflow;
    const ids = workflow.steps.map((step) => step.id);

    expect(workflow.schema_version).toBe("1.0");
    expect(workflow.workflow).toMatchObject({ id: "adf-day-zero", version: "0.1.0" });
    expect(workflow.requires.integrations.any).toEqual(["codex", "opencode"]);
    expect(ids).toEqual([
      "bootstrap-check",
      "intake-scan",
      "gate-g1",
      "feature-specify",
      "gate-g2",
      "feature-plan",
      "gate-g3",
      "session-contract",
      "gate-g4",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(workflow.steps.some((step) => step.command === "speckit.implement")).toBe(false);
    expect(workflow.steps.some((step) => step.type === "shell")).toBe(false);

    for (const gateName of ["g1", "g2", "g3", "g4"]) {
      const inputName = `${gateName}_verdict`;
      const gate = workflow.steps.find((step) => step.id === `gate-${gateName}`);
      expect(gate).toMatchObject({
        type: "gate",
        options: ["approve", "reject"],
        verdict_input: inputName,
      });
      expect(workflow.inputs[inputName]).toEqual({
        type: "string",
        default: "",
        enum: ["", "approve", "reject"],
      });
    }
  });

  it("pins the preset and all bundle components without remote component URLs", async () => {
    const preset = parse(await readFile(new URL("preset/preset.yml", root), "utf8")) as Record<
      string,
      unknown
    >;
    const bundle = parse(await readFile(new URL("bundle/bundle.yml", root), "utf8")) as {
      bundle: { version: string };
      provides: {
        presets: Array<{ id: string; version: string }>;
        workflows: Array<{ id: string; version: string }>;
        steps: Array<{ id: string; version: string }>;
      };
    };

    expect(preset).toMatchObject({
      schema_version: "1.0",
      preset: { id: "adf-guardrails", version: "0.1.0" },
    });
    expect(bundle.bundle.version).toBe("0.1.0");
    expect(bundle.provides.presets).toEqual([
      expect.objectContaining({ id: "adf-guardrails", version: "0.1.0" }),
    ]);
    expect(bundle.provides.workflows).toEqual([
      expect.objectContaining({ id: "adf-day-zero", version: "0.1.0" }),
    ]);
    expect(bundle.provides.steps).toEqual([
      expect.objectContaining({ id: "adf-validate-gate", version: "0.1.0" }),
    ]);
    expect(JSON.stringify(bundle)).not.toMatch(/https?:\/\//);
  });
});
