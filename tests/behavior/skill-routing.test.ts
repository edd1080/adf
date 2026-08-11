import { readFileSync } from "node:fs";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import {
  getCoreSkillInventory,
  routeSkills,
  type RoutingLifecycle,
} from "../../src/services/skill-registry.js";

type TriggerCase = {
  name: string;
  prompt: string;
  lifecycle: RoutingLifecycle;
  expect: string[];
  forbid: string[];
  gate: string;
};

const cases = parse(
  readFileSync(new URL("../fixtures/triggers/cases.yml", import.meta.url), "utf8"),
) as TriggerCase[];

describe("skill routing fixtures", () => {
  it.each(cases)("routes $name deterministically", (fixture) => {
    const result = routeSkills({ prompt: fixture.prompt, lifecycle: fixture.lifecycle });

    expect(result.skills).toEqual(fixture.expect);
    for (const forbidden of fixture.forbid) expect(result.skills).not.toContain(forbidden);
    expect(result.gate).toBe(fixture.gate);
  });

  it("keeps every core trigger visible in always-loaded descriptions", () => {
    for (const skill of getCoreSkillInventory()) {
      expect(skill.description).toContain(skill.trigger);
    }
  });
});
