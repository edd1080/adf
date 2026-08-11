import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { assessDayZero } from "../../src/services/day-zero-router.js";

type Scenario = {
  name: string;
  kind: "greenfield" | "brownfield";
  documents: Array<{ path: string; status?: string; authority?: string }>;
  expectedPath: string;
  expectedLevel: string;
};

describe("Day Zero router", () => {
  it("routes empty, partial, complete, and brownfield contexts without authorizing code", async () => {
    const fixture = parse(
      await readFile(new URL("../fixtures/day-zero/scenarios.yml", import.meta.url), "utf8"),
    ) as { scenarios: Scenario[] };

    for (const scenario of fixture.scenarios) {
      const assessment = assessDayZero({
        root: "/project",
        kind: scenario.kind,
        git: { present: false, dirty: "unknown" },
        specKit: { present: false },
        agents: { agentsMd: false, codex: false, opencode: false },
        documents: scenario.documents,
        files: [],
        conflicts: [],
        warnings: [],
      });

      expect(assessment.path, scenario.name).toBe(scenario.expectedPath);
      expect(assessment.documentation, scenario.name).toBe(scenario.expectedLevel);
      expect(assessment.skill).toBe("project-intake");
      expect(assessment.currentGate).toBe("G1");
      expect(assessment.nextPrompt).toBe("Inicia el proyecto.");
      expect(assessment.implementationAllowed).toBe(false);
      expect(assessment.questions.length).toBeGreaterThan(0);
    }
  });
});
