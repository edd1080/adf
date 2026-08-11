import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import type {
  ProcessRunner,
  RunOptions,
  RunResult,
} from "../../src/infrastructure/process-runner.js";
import { SpecKitAdapter, type SpecKitCapabilities } from "../../src/services/spec-kit-adapter.js";
import { createTempProject, type TempProject } from "../helpers/temp-project.js";

const projects: TempProject[] = [];

afterEach(async () => {
  await Promise.all(projects.splice(0).map((project) => project.cleanup()));
});

async function project(): Promise<TempProject> {
  const value = await createTempProject();
  projects.push(value);
  return value;
}

describe("SpecKitAdapter.detect", () => {
  it("returns actionable diagnostics when specify is absent", async () => {
    const target = await project();
    const runner = new FakeRunner({
      "specify version": { exitCode: 127, stdout: "", stderr: "command not found" },
    });

    const result = await new SpecKitAdapter(runner).detect(target.root);

    expect(result.available).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SPEC_KIT_MISSING",
        remediation: expect.stringMatching(/pinned official Spec Kit release/i),
      }),
    );
  });

  it("detects version, integrations, bundles, workflows, and multi-install", async () => {
    const target = await project();
    const status = await fixture("integration-status.json");
    const runner = capableRunner(status);

    const result = await new SpecKitAdapter(runner).detect(target.root);

    expect(result).toEqual({
      available: true,
      initialized: true,
      capabilities: {
        version: "0.13.3",
        bundle: true,
        workflow: true,
        multiIntegration: true,
        integrations: ["codex", "opencode"],
        defaultIntegration: "codex",
      },
      diagnostics: [],
    });
  });

  it("falls back to .specify/integration.json when status is unavailable", async () => {
    const target = await project();
    await target.write(".specify/integration.json", await fixture("integration-file.json"));
    const runner = capableRunner("not-json", {
      integrationStatus: { exitCode: 2, stdout: "", stderr: "unsupported" },
    });

    const result = await new SpecKitAdapter(runner).detect(target.root);

    expect(result.initialized).toBe(true);
    expect(result.capabilities?.defaultIntegration).toBe("opencode");
    expect(result.capabilities?.integrations).toEqual(["opencode"]);
  });

  it("retains exit code and stderr from failed capability probes", async () => {
    const target = await project();
    const runner = capableRunner("{}", {
      bundle: { exitCode: 9, stdout: "", stderr: "bundle disabled by policy" },
    });

    const result = await new SpecKitAdapter(runner).detect(target.root);

    expect(result.capabilities?.bundle).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SPEC_KIT_BUNDLE_UNAVAILABLE",
        message: expect.stringMatching(/exit 9.*bundle disabled by policy/i),
      }),
    );
  });
});

describe("SpecKitAdapter.proposeBootstrap", () => {
  it("proposes Codex initialization followed by OpenCode installation", () => {
    const capabilities = capabilitiesFixture({ integrations: [], defaultIntegration: undefined });

    const proposal = new SpecKitAdapter(new FakeRunner({})).proposeBootstrap({
      initialized: false,
      requestedDefault: "codex",
      requestedIntegrations: ["codex", "opencode"],
      capabilities,
    });

    expect(proposal.commands).toEqual([
      { command: "specify", args: ["init", ".", "--integration", "codex"] },
      { command: "specify", args: ["integration", "install", "opencode"] },
    ]);
    expect(proposal.deliveryMode).toBe("bundle-workflow");
  });

  it("does not silently change an existing default integration", () => {
    const capabilities = capabilitiesFixture({
      integrations: ["opencode"],
      defaultIntegration: "opencode",
    });

    const proposal = new SpecKitAdapter(new FakeRunner({})).proposeBootstrap({
      initialized: true,
      requestedDefault: "codex",
      requestedIntegrations: ["codex", "opencode"],
      capabilities,
    });

    expect(proposal.commands).toEqual([
      { command: "specify", args: ["integration", "install", "codex"] },
    ]);
    expect(proposal.commands).not.toContainEqual(
      expect.objectContaining({ args: expect.arrayContaining(["use"]) }),
    );
    expect(proposal.diagnostics).toContainEqual(
      expect.objectContaining({ code: "SPEC_KIT_DEFAULT_PRESERVED" }),
    );
  });

  it("degrades to embedded local templates without bundle or workflow support", () => {
    const capabilities = capabilitiesFixture({ bundle: false, workflow: false });

    const proposal = new SpecKitAdapter(new FakeRunner({})).proposeBootstrap({
      initialized: false,
      requestedDefault: "codex",
      requestedIntegrations: ["codex"],
      capabilities,
    });

    expect(proposal.deliveryMode).toBe("local-templates");
  });
});

function capableRunner(
  status: string,
  overrides: Partial<Record<"bundle" | "workflow" | "multi" | "integrationStatus", RunResult>> = {},
): FakeRunner {
  return new FakeRunner({
    "specify version": { exitCode: 0, stdout: "specify-cli 0.13.3", stderr: "" },
    "specify bundle --help": overrides.bundle ?? { exitCode: 0, stdout: "bundle help", stderr: "" },
    "specify workflow --help": overrides.workflow ?? {
      exitCode: 0,
      stdout: "workflow help",
      stderr: "",
    },
    "specify integration install --help": overrides.multi ?? {
      exitCode: 0,
      stdout: "--force multi-install",
      stderr: "",
    },
    "specify integration status --json": overrides.integrationStatus ?? {
      exitCode: 0,
      stdout: status,
      stderr: "",
    },
  });
}

function capabilitiesFixture(overrides: Partial<SpecKitCapabilities> = {}): SpecKitCapabilities {
  return {
    version: "0.13.3",
    bundle: true,
    workflow: true,
    multiIntegration: true,
    integrations: ["codex", "opencode"],
    defaultIntegration: "codex",
    ...overrides,
  };
}

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`../fixtures/spec-kit/${name}`, import.meta.url), "utf8");
}

class FakeRunner implements ProcessRunner {
  readonly calls: { command: string; args: readonly string[]; options?: RunOptions }[] = [];

  constructor(readonly responses: Record<string, RunResult>) {}

  async run(command: string, args: readonly string[], options?: RunOptions): Promise<RunResult> {
    this.calls.push({ command, args, ...(options === undefined ? {} : { options }) });
    return (
      this.responses[`${command} ${args.join(" ")}`] ?? {
        exitCode: 127,
        stdout: "",
        stderr: "unconfigured fake command",
      }
    );
  }
}
