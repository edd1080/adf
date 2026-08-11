import { describe, expect, it } from "vitest";

import { VENDORED_SKILLS, getVendoredSkillInventory } from "../../src/services/skill-registry.js";

describe("vendored skill dependencies", () => {
  it("declares only allowlisted dependencies", () => {
    const inventory = getVendoredSkillInventory();
    const allowed = new Set<string>(VENDORED_SKILLS);

    for (const skill of inventory) {
      for (const dependency of skill.dependencies) {
        expect(allowed.has(dependency)).toBe(true);
      }
    }
  });

  it("makes grill-with-docs depend explicitly on its two primitives", () => {
    const grillWithDocs = getVendoredSkillInventory().find(
      (skill) => skill.name === "grill-with-docs",
    );

    expect(grillWithDocs?.dependencies).toEqual(["grilling", "domain-modeling"]);
  });

  it("has an acyclic dependency graph", () => {
    const inventory = getVendoredSkillInventory();
    const dependencies = new Map(inventory.map((skill) => [skill.name, skill.dependencies]));

    const visit = (name: string, path: readonly string[]): void => {
      expect(path).not.toContain(name);
      for (const dependency of dependencies.get(name) ?? []) visit(dependency, [...path, name]);
    };

    for (const skill of inventory) visit(skill.name, []);
  });
});
