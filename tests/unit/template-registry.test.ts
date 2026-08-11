import { describe, expect, it } from "vitest";

import {
  getTemplateInventory,
  renderTemplate,
  type TemplateVariables,
} from "../../src/services/template-registry.js";

const EXPECTED_IDS = [
  "core-agents",
  "harness-manifest",
  "harness-state",
  "harness-handoff",
  "harness-lessons",
  "product-brief",
  "product-prd",
  "product-glossary",
  "product-user-flow",
  "references-index",
  "feature-verification",
];

describe("template registry", () => {
  it("ships every required template with stable metadata and a digest", () => {
    const inventory = getTemplateInventory();

    expect(inventory.map((template) => template.id)).toEqual(EXPECTED_IDS);
    for (const template of inventory) {
      expect(template.targetPath).not.toContain("templates/");
      expect(template.version).toBe("0.1.0");
      expect(template.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(["replace-if-unmodified", "merge-markers", "preserve"]).toContain(template.strategy);
    }
  });

  it("renders only declared variables", () => {
    expect(() => renderTemplate("core-agents", { surprise: "value" })).toThrow(
      /unknown template variable/i,
    );
  });

  it("fails when a required variable is missing", () => {
    expect(() => renderTemplate("product-user-flow", { role: "Administrator" })).toThrow(
      /missing template variable.*slug/i,
    );
  });

  it("renders target paths and contents deterministically", () => {
    const variables: TemplateVariables = { role: "Administrator", slug: "administrator" };

    const first = renderTemplate("product-user-flow", variables);
    const second = renderTemplate("product-user-flow", variables);

    expect(first).toEqual(second);
    expect(first.targetPath).toBe("docs/product/user-flows/administrator.md");
    expect(first.content).toContain("# Administrator User Flow");
  });

  it("keeps AGENTS.md as a thin lifecycle router", () => {
    const agents = renderTemplate("core-agents", {} as TemplateVariables).content;

    expect(agents).toContain("Project Lifecycle Router");
    expect(agents).toContain("Sources of Truth");
    expect(agents).toContain("G0");
    expect(agents).toContain("G6");
    expect(agents).toContain("Inspect before asking");
    expect(agents).toContain("Never implement before Gate G4");
    expect(agents).toContain("Never commit, push, deploy");
    expect(agents).toContain("Load detailed procedures from `.agents/skills/` only when relevant");
    expect(agents).not.toContain("## Full project-intake procedure");
  });
});
