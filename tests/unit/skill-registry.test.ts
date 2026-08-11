import { describe, expect, it } from "vitest";

import { VENDORED_SKILLS, getVendoredSkillInventory } from "../../src/services/skill-registry.js";

const EXCLUDED_SKILLS = ["implement", "handoff", "to-spec", "to-tickets", "triage"];

describe("vendored skill registry", () => {
  it("contains exactly the frozen allowlist", () => {
    const inventory = getVendoredSkillInventory();

    expect(inventory.map((skill) => skill.name)).toEqual([...VENDORED_SKILLS]);
    expect(inventory).toHaveLength(8);
    for (const excluded of EXCLUDED_SKILLS) {
      expect(inventory.map((skill) => skill.name)).not.toContain(excluded);
    }
  });

  it("records reproducible provenance for every adapted skill", () => {
    const inventory = getVendoredSkillInventory();

    for (const skill of inventory) {
      expect(skill.repository).toBe("https://github.com/mattpocock/skills.git");
      expect(skill.commit).toMatch(/^[a-f0-9]{40}$/);
      expect(skill.sourcePath).toMatch(/^skills\/.+\/SKILL\.md$/);
      expect(skill.license).toBe("MIT");
      expect(skill.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(skill.adaptedSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(skill.adaptedSha256).not.toBe(skill.originalSha256);
      expect(skill.adaptations.length).toBeGreaterThan(0);
    }
  });

  it("records the upstream rename instead of silently substituting it", () => {
    const renamed = getVendoredSkillInventory().find(
      (skill) => skill.name === "writing-great-skills",
    );

    expect(renamed?.upstreamName).toBe("writing-for-agents");
    expect(renamed?.adaptations.join(" ")).toMatch(/rename/i);
  });
});
