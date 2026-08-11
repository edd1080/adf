import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { ChangePlan } from "../domain/change-plan.js";
import type { Diagnostic } from "../domain/diagnostics.js";
import type { Manifest } from "../domain/manifest.js";
import { NodeFileSystem } from "../infrastructure/filesystem.js";
import type { RunResult } from "../infrastructure/process-runner.js";
import { planChanges } from "../services/change-planner.js";
import { composeHarnessTemplates } from "../services/harness-composer.js";
import { readManifest } from "../services/harness-reader.js";
import { inspectProject, type ProjectInspection } from "../services/project-inspector.js";
import type {
  BootstrapProposal,
  BootstrapRequest,
  SpecKitAdapter,
  SpecKitDetection,
  SpecKitIntegration,
} from "../services/spec-kit-adapter.js";
import { applyChangePlan } from "../services/transaction-writer.js";
import { runDoctor, type DoctorReport } from "./doctor.js";

export type InitOptions = {
  root: string;
  defaultAgent: SpecKitIntegration;
  integrations: readonly SpecKitIntegration[];
  dryRun?: boolean;
  yes?: boolean;
};

export type InitStatus = "installed" | "dry-run" | "declined" | "blocked" | "conflict";

export type InitResult = {
  status: InitStatus;
  exitCode: 0 | 1 | 3;
  plan: ChangePlan;
  specKit: BootstrapProposal;
  diagnostics: Diagnostic[];
  doctor: DoctorReport | null;
  nextAction: "Inicia el proyecto.";
  written: readonly string[];
  json: {
    status: InitStatus;
    plan: ChangePlan;
    diagnostics: Diagnostic[];
    doctor: DoctorReport | null;
    nextAction: "Inicia el proyecto.";
    specKit: BootstrapProposal;
  };
};

type InitDependencies = {
  now: () => Date;
  confirm: () => Promise<boolean>;
  preview?: (
    plan: ChangePlan,
    specKit: BootstrapProposal,
    diagnostics: readonly Diagnostic[],
  ) => Promise<void> | void;
  specKit: Pick<SpecKitAdapter, "detect" | "proposeBootstrap">;
  execute: (command: string, args: readonly string[], cwd: string) => Promise<RunResult>;
};

const EMPTY_PLAN: ChangePlan = { applicable: false, actions: [] };
const EMPTY_PROPOSAL: BootstrapProposal = {
  commands: [],
  deliveryMode: "local-templates",
  diagnostics: [],
};

export async function runInit(
  options: InitOptions,
  dependencies: InitDependencies,
): Promise<InitResult> {
  const root = resolve(options.root);
  const inspection = await inspectProject(root);
  const detection = await dependencies.specKit.detect(root);
  if (!detection.available || detection.capabilities === undefined) {
    const diagnostics = normalizeMissingSpecKit(detection);
    return result("blocked", 1, EMPTY_PLAN, EMPTY_PROPOSAL, diagnostics, null, []);
  }

  const specKit = dependencies.specKit.proposeBootstrap(bootstrapRequest(options, detection));
  const installed = await existingManifest(root);
  if (installed.diagnostic !== undefined) {
    return result("conflict", 3, EMPTY_PLAN, specKit, [installed.diagnostic], null, []);
  }
  const existingDefault = supportedIntegration(detection.capabilities.defaultIntegration);
  const defaultIntegration = detection.initialized
    ? (existingDefault ?? options.defaultAgent)
    : options.defaultAgent;
  const installedIntegrations = [
    ...new Set([
      ...detection.capabilities.integrations.flatMap((integration) => {
        const supported = supportedIntegration(integration);
        return supported === undefined ? [] : [supported];
      }),
      ...options.integrations,
      defaultIntegration,
    ]),
  ];
  const packageCommands =
    detection.capabilities.workflow && installed.manifest === undefined
      ? [
          {
            command: "specify" as const,
            args: ["preset", "add", "--dev", ".harness/spec-kit/preset"],
          },
          {
            command: "specify" as const,
            args: ["workflow", "add", "--dev", ".harness/spec-kit/workflow"],
          },
        ]
      : [];
  const executionProposal: BootstrapProposal = {
    ...specKit,
    commands: [...specKit.commands, ...packageCommands],
  };
  const composition = composeHarnessTemplates({
    frameworkVersion: "0.1.0",
    installedAt: installed.manifest?.framework.installedAt ?? dependencies.now().toISOString(),
    specKitVersion: detection.capabilities.version,
    defaultIntegration,
    installedIntegrations,
  });
  const plan = planChanges(inspection, composition.templates, installed.manifest);
  const diagnostics = [...inspection.warnings, ...detection.diagnostics, ...specKit.diagnostics];
  if (
    detection.initialized &&
    detection.capabilities.defaultIntegration !== undefined &&
    existingDefault === undefined
  ) {
    diagnostics.push({
      severity: "error",
      code: "SPEC_KIT_DEFAULT_UNSUPPORTED",
      message: `Existing Spec Kit default integration is unsupported by ADF v0.1: ${detection.capabilities.defaultIntegration}`,
      remediation: "Set the Spec Kit default integration to codex or opencode, then retry.",
    });
  }
  if (!plan.applicable)
    return result("conflict", 3, plan, executionProposal, diagnostics, null, []);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return result("blocked", 1, plan, executionProposal, diagnostics, null, []);
  }
  if (options.dryRun) return result("dry-run", 0, plan, executionProposal, diagnostics, null, []);
  await dependencies.preview?.(plan, executionProposal, diagnostics);
  if (!options.yes && !(await dependencies.confirm())) {
    return result("declined", 0, plan, executionProposal, diagnostics, null, []);
  }

  if (
    options.yes &&
    inspection.kind === "brownfield" &&
    specKit.commands.some((command) => command.args[0] === "init")
  ) {
    const confirmationRequired: Diagnostic = {
      severity: "error",
      code: "SPEC_KIT_CONFIRMATION_REQUIRED",
      message: "Spec Kit must confirm its merge into this non-empty project.",
      remediation:
        "Re-run without `--yes`, review the ADF plan, and answer the separate Spec Kit merge prompt. ADF will not add `--force` silently.",
    };
    return result(
      "blocked",
      1,
      plan,
      executionProposal,
      [...diagnostics, confirmationRequired],
      null,
      [],
    );
  }

  for (const command of specKit.commands) {
    const execution = await dependencies.execute(command.command, command.args, root);
    if (execution.exitCode !== 0) {
      const failure = executionFailure(
        command,
        execution,
        false,
        await observedMutations(root, inspection),
      );
      return result("blocked", 1, plan, executionProposal, [...diagnostics, failure], null, []);
    }
  }

  const finalInspection = specKit.commands.length === 0 ? inspection : await inspectProject(root);
  const finalPlan = planChanges(finalInspection, composition.templates, installed.manifest);
  if (!finalPlan.applicable) {
    const conflict: Diagnostic = {
      severity: "error",
      code: "POST_SPEC_KIT_CONFLICT",
      message: "Spec Kit created a path that conflicts with the approved ADF plan.",
      remediation:
        "Review the Spec Kit mutations and the new ADF conflict. No ADF files were written.",
    };
    return result(
      "conflict",
      3,
      finalPlan,
      executionProposal,
      [...diagnostics, conflict],
      null,
      [],
    );
  }

  const snapshots = await captureTargets(root, finalPlan);
  let applied;
  try {
    applied = await applyChangePlan(root, finalPlan, composition.templates);
  } catch (error) {
    const failure: Diagnostic = {
      severity: "error",
      code: "ADF_TRANSACTION_FAILED",
      message: error instanceof Error ? error.message : String(error),
      remediation:
        "Inspect the filesystem condition. ADF transactional writes were rolled back; Spec Kit bootstrap files may remain.",
    };
    return result("blocked", 1, finalPlan, executionProposal, [...diagnostics, failure], null, []);
  }

  const beforePackage = packageCommands.length === 0 ? undefined : await inspectProject(root);
  for (const command of packageCommands) {
    const execution = await dependencies.execute(command.command, command.args, root);
    if (execution.exitCode !== 0) {
      const mutations =
        beforePackage === undefined ? [] : await observedMutations(root, beforePackage);
      await restoreTargets(snapshots);
      const failure = executionFailure(command, execution, true, mutations);
      return result(
        "blocked",
        1,
        finalPlan,
        executionProposal,
        [...diagnostics, failure],
        null,
        [],
      );
    }
  }

  const doctor = await runDoctor(root, { specKit: dependencies.specKit });
  return result(
    doctor.healthy ? "installed" : "blocked",
    doctor.healthy ? 0 : 1,
    finalPlan,
    executionProposal,
    [...diagnostics, ...doctor.diagnostics.filter((item) => item.severity === "error")],
    doctor,
    applied.written,
  );
}

function executionFailure(
  command: { command: string; args: readonly string[] },
  execution: RunResult,
  restored: boolean,
  mutations: readonly string[],
): Diagnostic {
  const detail = execution.stderr.trim() || execution.stdout.trim();
  return {
    severity: "error",
    code: "SPEC_KIT_EXECUTION_FAILED",
    message: `${command.command} ${command.args.join(" ")} failed with exit ${execution.exitCode}${detail === "" ? "" : `: ${detail}`}. Observed mutations: ${mutations.length === 0 ? "none detected" : mutations.join(", ")}`,
    remediation: restored
      ? "Resolve the Spec Kit package error and retry; ADF-owned files were restored. Spec Kit bootstrap files may remain."
      : "Resolve the Spec Kit bootstrap error and retry. No ADF files were written; inspect any partial Spec Kit mutations before continuing.",
  };
}

async function observedMutations(root: string, before: ProjectInspection): Promise<string[]> {
  try {
    const after = await inspectProject(root);
    const beforeFiles = new Map(before.files.map((file) => [file.path, file.sha256]));
    const afterFiles = new Map(after.files.map((file) => [file.path, file.sha256]));
    return [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])].sort().flatMap((path) => {
      const oldHash = beforeFiles.get(path);
      const newHash = afterFiles.get(path);
      if (oldHash === undefined) return [`created:${path}`];
      if (newHash === undefined) return [`deleted:${path}`];
      return oldHash === newHash ? [] : [`modified:${path}`];
    });
  } catch (error) {
    return [`inspection-failed:${error instanceof Error ? error.message : String(error)}`];
  }
}

async function existingManifest(
  root: string,
): Promise<{ manifest?: Manifest; diagnostic?: Diagnostic }> {
  const path = resolve(root, ".harness/manifest.yml");
  if (!(await new NodeFileSystem().exists(path))) return {};
  try {
    return { manifest: (await readManifest(root)).manifest };
  } catch (error) {
    return {
      diagnostic: {
        severity: "error",
        code: "MANIFEST_INVALID",
        message: error instanceof Error ? error.message : String(error),
        remediation: "Repair or explicitly archive the existing ADF manifest before retrying.",
      },
    };
  }
}

function bootstrapRequest(options: InitOptions, detection: SpecKitDetection): BootstrapRequest {
  return {
    initialized: detection.initialized,
    requestedDefault: options.defaultAgent,
    requestedIntegrations: options.integrations,
    capabilities: detection.capabilities!,
  };
}

function supportedIntegration(value: string | undefined): SpecKitIntegration | undefined {
  return value === "codex" || value === "opencode" ? value : undefined;
}

function normalizeMissingSpecKit(detection: SpecKitDetection): Diagnostic[] {
  const existing = detection.diagnostics.filter(
    (diagnostic) => diagnostic.code !== "SPEC_KIT_MISSING",
  );
  return [
    ...existing,
    {
      severity: "error",
      code: "SPEC_KIT_MISSING",
      message: "The official `specify` CLI is required and was not found.",
      remediation: "Install a pinned release with: uv tool install specify-cli",
    },
  ];
}

type TargetSnapshot = { path: string; content: Buffer | null };

async function captureTargets(root: string, plan: ChangePlan): Promise<TargetSnapshot[]> {
  const fileSystem = new NodeFileSystem();
  return Promise.all(
    plan.actions
      .filter((action) => action.kind === "create" || action.kind === "merge")
      .map(async (action) => {
        const path = resolve(root, action.path);
        return { path, content: (await fileSystem.exists(path)) ? await readFile(path) : null };
      }),
  );
}

async function restoreTargets(snapshots: readonly TargetSnapshot[]): Promise<void> {
  for (const snapshot of snapshots) {
    if (snapshot.content === null) await rm(snapshot.path, { force: true });
    else {
      await new NodeFileSystem().mkdir(dirname(snapshot.path));
      await writeFile(snapshot.path, snapshot.content);
    }
  }
}

function result(
  status: InitStatus,
  exitCode: 0 | 1 | 3,
  plan: ChangePlan,
  specKit: BootstrapProposal,
  diagnostics: Diagnostic[],
  doctor: DoctorReport | null,
  written: readonly string[],
): InitResult {
  const nextAction = "Inicia el proyecto." as const;
  return {
    status,
    exitCode,
    plan,
    specKit,
    diagnostics,
    doctor,
    nextAction,
    written,
    json: { status, plan, diagnostics, doctor, nextAction, specKit },
  };
}
