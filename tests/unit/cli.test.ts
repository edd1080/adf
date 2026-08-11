import { describe, expect, it } from "vitest";

import { buildCli, runInteractiveWizard } from "../../src/cli.js";

describe("buildCli", () => {
  it("uses the public package name in help output", () => {
    expect(buildCli().name()).toBe("adf-harness-kit");
  });

  it("exposes the five ADF commands", () => {
    const names = buildCli().commands.map((command) => command.name());

    expect(names).toEqual(["init", "doctor", "status", "next", "update"]);
  });

  it("launches guided onboarding when invoked without a subcommand", async () => {
    let answerCollections = 0;
    const program = buildCli({
      wizard: {
        collectAnswers: async () => {
          answerCollections += 1;
          return null;
        },
        write: () => undefined,
      },
    });

    await program.exitOverride().parseAsync(["node", "adf"]);

    expect(answerCollections).toBe(1);
  });

  it("delegates wizard answers and prints a documentation-aware first prompt", async () => {
    const writes: string[] = [];
    let receivedTarget = "";
    let receivedOptions: unknown;

    await runInteractiveWizard({
      collectAnswers: async () => ({
        target: "./project",
        defaultAgent: "codex",
        installAdditionalAgent: true,
        documentationPath: "docs/discovery",
      }),
      executeInit: async (target, options) => {
        receivedTarget = target;
        receivedOptions = options;
        return { status: "installed" };
      },
      write: (value) => writes.push(value),
    });

    expect(receivedTarget).toBe("./project");
    expect(receivedOptions).toEqual({ agent: "codex", also: ["opencode"] });
    expect(writes.join("")).toContain(
      "La documentación preparada durante discovery está en docs/discovery.",
    );
  });

  it("does not install after wizard cancellation", async () => {
    let executions = 0;
    const writes: string[] = [];

    await runInteractiveWizard({
      collectAnswers: async () => null,
      executeInit: async () => {
        executions += 1;
        return { status: "installed" };
      },
      write: (value) => writes.push(value),
    });

    expect(executions).toBe(0);
    expect(writes.join("")).toContain("cancelled");
  });

  it("does not print the first prompt after a blocked installation", async () => {
    const writes: string[] = [];

    await runInteractiveWizard({
      collectAnswers: async () => ({
        target: ".",
        defaultAgent: "codex",
        installAdditionalAgent: false,
      }),
      executeInit: async () => ({ status: "blocked" }),
      write: (value) => writes.push(value),
    });

    expect(writes.join("")).not.toContain("Inicia el proyecto.");
  });
});
