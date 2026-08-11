import { describe, expect, it } from "vitest";

import { getVendoredSkillInventory, readSkillDocument } from "../../src/services/skill-registry.js";

const SUPPORTED_FRONTMATTER = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
]);

describe("vendored skill frontmatter", () => {
  it("is portable between Codex and OpenCode", () => {
    for (const skill of getVendoredSkillInventory()) {
      const document = readSkillDocument(skill.templatePath);

      expect(document.frontmatter.name).toBe(skill.name);
      expect(document.frontmatter.description).toEqual(expect.any(String));
      expect(document.frontmatter.description.length).toBeGreaterThan(0);
      expect(document.frontmatter.description.length).toBeLessThanOrEqual(1024);
      expect(document.frontmatter.license).toBe("MIT");
      expect(skill.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(Object.keys(document.frontmatter).every((key) => SUPPORTED_FRONTMATTER.has(key))).toBe(
        true,
      );
      expect(document.frontmatter).not.toHaveProperty("disable-model-invocation");

      if (document.frontmatter.metadata !== undefined) {
        expect(
          Object.values(document.frontmatter.metadata).every((value) => typeof value === "string"),
        ).toBe(true);
      }
    }
  });
});
