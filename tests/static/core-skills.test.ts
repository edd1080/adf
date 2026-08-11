import { describe, expect, it } from "vitest";

import {
  CORE_SKILLS,
  VENDORED_SKILLS,
  getCoreSkillInventory,
  readSkillDocument,
} from "../../src/services/skill-registry.js";

const REQUIRED_SECTIONS = ["## Read", "## May write", "## Stop", "## Completion criteria"];

describe("ADF core skills", () => {
  it("ships the complete core allowlist with portable frontmatter", () => {
    const inventory = getCoreSkillInventory();

    expect(inventory.map((skill) => skill.name)).toEqual([...CORE_SKILLS]);
    for (const skill of inventory) {
      const document = readSkillDocument(skill.templatePath);
      expect(document.frontmatter.name).toBe(skill.name);
      expect(document.frontmatter.description).toMatch(/Use when/i);
      expect(document.frontmatter.license).toBe("MIT");
      expect(document.frontmatter).not.toHaveProperty("disable-model-invocation");
      expect(document.frontmatter.metadata).toEqual(
        expect.objectContaining({ "adf-version": "0.1.0" }),
      );
      for (const section of REQUIRED_SECTIONS) expect(document.body).toContain(section);
      expect(document.body).toContain("explicit authorization");
      expect(document.body).not.toContain("tasks/todo.md");
    }
  });

  it("declares only resolvable dependencies", () => {
    const known = new Set<string>([...CORE_SKILLS, ...VENDORED_SKILLS]);

    for (const skill of getCoreSkillInventory()) {
      for (const dependency of skill.dependencies) expect(known.has(dependency)).toBe(true);
    }
  });

  it("encodes the lifecycle gates and evidence boundaries", () => {
    const documents = new Map(
      getCoreSkillInventory().map((skill) => [
        skill.name,
        readSkillDocument(skill.templatePath).body,
      ]),
    );

    expect(documents.get("project-intake")).toMatch(/G1[\s\S]*human approval/i);
    expect(documents.get("session-start")).toMatch(/Session Contract[\s\S]*explicit `GO`/i);
    expect(documents.get("context-router")).toMatch(/authority[\s\S]*contradiction/i);
    expect(documents.get("bug-fix")).toMatch(/red-capable[\s\S]*regression test/i);
    expect(documents.get("verify-work")).toMatch(/evidence[\s\S]*command/i);
    expect(documents.get("feature-close")).toMatch(/G6[\s\S]*Definition of Done/i);
    expect(documents.get("session-end")).toMatch(/HANDOFF\.md[\s\S]*correction/i);
  });
});
