import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Diagnostic } from "../domain/diagnostics.js";
import type { ProcessRunner, RunResult } from "../infrastructure/process-runner.js";

export type SpecKitIntegration = "codex" | "opencode";

export type SpecKitCapabilities = {
  version: string;
  bundle: boolean;
  workflow: boolean;
  multiIntegration: boolean;
  integrations: readonly string[];
  defaultIntegration: string | undefined;
};

export type SpecKitDetection = {
  available: boolean;
  initialized: boolean;
  capabilities?: SpecKitCapabilities;
  diagnostics: Diagnostic[];
};

export type ProposedCommand = {
  command: "specify";
  args: string[];
};

export type BootstrapProposal = {
  commands: ProposedCommand[];
  deliveryMode: "bundle-workflow" | "local-templates";
  diagnostics: Diagnostic[];
};

export type BootstrapRequest = {
  initialized: boolean;
  requestedDefault: SpecKitIntegration;
  requestedIntegrations: readonly SpecKitIntegration[];
  capabilities: SpecKitCapabilities;
};

export class SpecKitAdapter {
  constructor(readonly runner: ProcessRunner) {}

  async detect(root: string): Promise<SpecKitDetection> {
    const versionResult = await this.runner.run("specify", ["version"], { cwd: root });
    if (versionResult.exitCode !== 0) {
      return {
        available: false,
        initialized: false,
        diagnostics: [
          {
            severity: "error",
            code: "SPEC_KIT_MISSING",
            message: commandFailure("specify version", versionResult),
            remediation: "Install a pinned official Spec Kit release, then run ADF doctor again.",
          },
        ],
      };
    }

    const [bundle, workflow, multi, status] = await Promise.all([
      this.runner.run("specify", ["bundle", "--help"], { cwd: root }),
      this.runner.run("specify", ["workflow", "--help"], { cwd: root }),
      this.runner.run("specify", ["integration", "install", "--help"], { cwd: root }),
      this.runner.run("specify", ["integration", "status", "--json"], { cwd: root }),
    ]);

    const diagnostics: Diagnostic[] = [];
    recordUnavailableCapability("BUNDLE", bundle, diagnostics);
    recordUnavailableCapability("WORKFLOW", workflow, diagnostics);
    const integrationState =
      parseIntegrationState(status.exitCode === 0 ? status.stdout : "") ??
      (await readIntegrationFile(root));
    const version = extractVersion(versionResult.stdout);

    return {
      available: true,
      initialized:
        integrationState !== undefined &&
        (integrationState.defaultIntegration !== undefined ||
          integrationState.integrations.length > 0),
      capabilities: {
        version,
        bundle: bundle.exitCode === 0,
        workflow: workflow.exitCode === 0,
        multiIntegration: multi.exitCode === 0,
        integrations: integrationState?.integrations ?? [],
        defaultIntegration: integrationState?.defaultIntegration,
      },
      diagnostics,
    };
  }

  proposeBootstrap(request: BootstrapRequest): BootstrapProposal {
    const diagnostics: Diagnostic[] = [];
    const commands: ProposedCommand[] = [];
    const requested = [...new Set(request.requestedIntegrations)];
    const installed = new Set(request.capabilities.integrations);

    if (!request.initialized) {
      commands.push({
        command: "specify",
        args: ["init", ".", "--integration", request.requestedDefault],
      });
      installed.add(request.requestedDefault);
    } else if (
      request.capabilities.defaultIntegration !== undefined &&
      request.capabilities.defaultIntegration !== request.requestedDefault
    ) {
      diagnostics.push({
        severity: "warning",
        code: "SPEC_KIT_DEFAULT_PRESERVED",
        message: `Existing default integration ${request.capabilities.defaultIntegration} will be preserved.`,
        remediation:
          "Use an explicit Spec Kit integration switch after reviewing its rescaffolding preview.",
      });
    }

    for (const integration of requested) {
      if (installed.has(integration)) continue;
      if (installed.size > 0 && !request.capabilities.multiIntegration) {
        diagnostics.push({
          severity: "error",
          code: "SPEC_KIT_MULTI_INTEGRATION_UNAVAILABLE",
          message: `Cannot install ${integration} alongside the existing integration with this Spec Kit version.`,
          remediation:
            "Upgrade Spec Kit or select a single integration; ADF will not use --force silently.",
        });
        continue;
      }

      commands.push({ command: "specify", args: ["integration", "install", integration] });
      installed.add(integration);
    }

    return {
      commands,
      deliveryMode:
        request.capabilities.bundle && request.capabilities.workflow
          ? "bundle-workflow"
          : "local-templates",
      diagnostics,
    };
  }
}

type IntegrationState = {
  integrations: string[];
  defaultIntegration: string | undefined;
};

function extractVersion(output: string): string {
  return output.match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/)?.[0] ?? output.trim();
}

function parseIntegrationState(content: string): IntegrationState | undefined {
  if (content.trim() === "") return undefined;
  try {
    const value = JSON.parse(content) as Record<string, unknown>;
    const defaultIntegration = stringValue(value.default_integration ?? value.defaultIntegration);
    const integrations = stringArray(value.installed_integrations ?? value.installedIntegrations);
    return { integrations, defaultIntegration };
  } catch {
    return undefined;
  }
}

async function readIntegrationFile(root: string): Promise<IntegrationState | undefined> {
  const path = resolve(root, ".specify/integration.json");
  try {
    await access(path);
    return parseIntegrationState(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function recordUnavailableCapability(
  name: "BUNDLE" | "WORKFLOW",
  result: RunResult,
  diagnostics: Diagnostic[],
): void {
  if (result.exitCode === 0) return;
  diagnostics.push({
    severity: "warning",
    code: `SPEC_KIT_${name}_UNAVAILABLE`,
    message: commandFailure(`specify ${name.toLowerCase()} --help`, result),
    remediation: "ADF will use its embedded local templates for this capability.",
  });
}

function commandFailure(command: string, result: RunResult): string {
  const detail = result.stderr.trim() || result.stdout.trim() || "no diagnostic output";
  return `${command} failed with exit ${result.exitCode}: ${detail}`;
}
