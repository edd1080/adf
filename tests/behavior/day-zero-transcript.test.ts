import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Transcript = {
  name: string;
  events: Array<{ actor: string; action: string }>;
};

type Workflow = {
  steps: Array<{ id: string; type?: string; command?: string; verdict_input?: string }>;
};

describe("Day Zero transcript contract", () => {
  it("maps the first prompt through explicit human gates and stops before code", async () => {
    const transcript = parse(
      await readFile(new URL("../fixtures/transcripts/day-zero.yml", import.meta.url), "utf8"),
    ) as Transcript;
    const workflow = parse(
      await readFile(
        new URL("../../templates/spec-kit/workflow/workflow.yml", import.meta.url),
        "utf8",
      ),
    ) as Workflow;
    const intake = await readFile(
      new URL("../../templates/skills/core/project-intake/SKILL.md", import.meta.url),
      "utf8",
    );
    const actions = transcript.events.map((event) => event.action);

    expect(actions[0]).toBe("Inicia el proyecto.");
    expect(actions).toContain("project-intake");
    expect(actions.indexOf("inspect-before-asking")).toBeLessThan(
      actions.indexOf("prepare-g1-evidence"),
    );
    expect(actions.at(-1)).toBe("stop-before-implementation");
    expect(intake).toContain("Inspect first; ask only");

    for (const gate of ["gate-g1", "gate-g2", "gate-g3", "gate-g4"]) {
      expect(transcript.events.find((event) => event.action === gate)?.actor).toBe("human");
      expect(workflow.steps.find((step) => step.id === gate)).toMatchObject({
        type: "gate",
        verdict_input: `${gate.slice(5)}_verdict`,
      });
    }

    expect(workflow.steps.some((step) => step.command === "speckit.implement")).toBe(false);
    expect(actions).not.toContain("implement");
  });
});
