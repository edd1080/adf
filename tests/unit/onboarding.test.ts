import { describe, expect, it } from "vitest";

import {
  buildFirstProjectPrompt,
  buildInitSummary,
  createOnboardingConfig,
  validateDocumentationPath,
} from "../../src/services/onboarding.js";

describe("onboarding contract", () => {
  it("builds a Codex-only installation config", () => {
    expect(
      createOnboardingConfig({
        target: " ./my-project ",
        defaultAgent: "codex",
        installAdditionalAgent: false,
      }),
    ).toEqual({
      target: "./my-project",
      defaultAgent: "codex",
      integrations: ["codex"],
    });
  });

  it("adds the opposite agent without duplicating the default", () => {
    expect(
      createOnboardingConfig({
        target: ".",
        defaultAgent: "opencode",
        installAdditionalAgent: true,
      }),
    ).toEqual({
      target: ".",
      defaultAgent: "opencode",
      integrations: ["opencode", "codex"],
    });
  });

  it("normalizes an existing documentation path", () => {
    expect(
      createOnboardingConfig({
        target: ".",
        defaultAgent: "codex",
        installAdditionalAgent: false,
        documentationPath: " docs/discovery ",
      }),
    ).toEqual({
      target: ".",
      defaultAgent: "codex",
      integrations: ["codex"],
      documentationPath: "docs/discovery",
    });
  });

  it("returns null when the wizard is cancelled or incomplete", () => {
    expect(createOnboardingConfig(null)).toBeNull();
    expect(
      createOnboardingConfig({
        target: "  ",
        defaultAgent: "codex",
        installAdditionalAgent: false,
      }),
    ).toBeNull();
  });

  it("builds the canonical first prompt without documentation", () => {
    expect(buildFirstProjectPrompt()).toBe("Inicia el proyecto.");
  });

  it("builds a preservation-aware first prompt with documentation", () => {
    expect(buildFirstProjectPrompt("docs/discovery")).toBe(
      [
        "Inicia el proyecto.",
        "",
        "La documentación preparada durante discovery está en docs/discovery.",
        "Inspecciónala antes de preguntarme cualquier cosa.",
        "Preserva las fuentes originales y propón únicamente la normalización y los gaps necesarios para llegar a G1.",
      ].join("\n"),
    );
  });

  it("requires a path after documentation was confirmed", () => {
    expect(validateDocumentationPath("  ")).toBe("Enter the documentation path.");
    expect(validateDocumentationPath("docs/discovery")).toBeUndefined();
  });

  it("shows the first action only after a successful installation", () => {
    expect(buildInitSummary("installed", "Inicia el proyecto.")).toContain(
      "Next: Inicia el proyecto.",
    );
    expect(buildInitSummary("blocked", "Inicia el proyecto.")).not.toContain("Next:");
    expect(buildInitSummary("dry-run", "Inicia el proyecto.")).not.toContain("Next:");
  });
});
