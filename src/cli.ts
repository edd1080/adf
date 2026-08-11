#!/usr/bin/env node

import {
  confirm as promptConfirm,
  isCancel,
  select as promptSelect,
  text as promptText,
} from "@clack/prompts";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runNext } from "./commands/next.js";
import { runStatus } from "./commands/status.js";
import { runUpdate } from "./commands/update.js";
import { SystemProcessRunner } from "./infrastructure/process-runner.js";
import { renderChangePlanText } from "./services/change-planner.js";
import {
  buildFirstProjectPrompt,
  buildInitSummary,
  createOnboardingConfig,
  type OnboardingAnswers,
  validateDocumentationPath,
} from "./services/onboarding.js";
import { SpecKitAdapter, type SpecKitIntegration } from "./services/spec-kit-adapter.js";

type CliDependencies = {
  wizard?: GuidedOnboardingDependencies;
};

export type GuidedOnboardingDependencies = {
  collectAnswers?: () => Promise<OnboardingAnswers | null>;
  executeInit?: (
    target: string,
    options: Pick<InitCliOptions, "agent" | "also">,
  ) => Promise<{ status: string } | null>;
  write?: (value: string) => void;
};

export function buildCli(dependencies: CliDependencies = {}): Command {
  const program = new Command()
    .name("adf-harness-kit")
    .description("Agentic Development Framework")
    .version("0.1.0")
    .action(async () => runInteractiveWizard(dependencies.wizard));

  program
    .command("init")
    .description("Preview and install ADF into a project")
    .argument("[target]", "project directory", ".")
    .option("--agent <agent>", "default agent: codex or opencode", parseAgent, "codex")
    .option("--also <agents...>", "additional integrations", parseAgents, [])
    .option("--dry-run", "print the complete plan without writing")
    .option("--yes", "apply a conflict-free plan without confirmation")
    .option("--json", "emit one machine-readable JSON document")
    .action(async (target: string, options: InitCliOptions) => {
      await executeInitCli(target, options);
    });

  program
    .command("doctor")
    .description("Validate harness, documentation, skills, and Spec Kit integration")
    .argument("[target]", "project directory", ".")
    .option("--json", "emit JSON")
    .action(async (target: string, options: JsonOptions) => {
      const report = await runDoctor(resolve(target), {
        specKit: new SpecKitAdapter(new SystemProcessRunner()),
      });
      if (options.json) writeJson(report);
      else writeDiagnostics(report.diagnostics);
      process.exitCode = report.exitCode;
    });

  program
    .command("status")
    .description("Show the current lifecycle gate and active work")
    .argument("[target]", "project directory", ".")
    .option("--json", "emit JSON")
    .action(async (target: string, options: JsonOptions) => {
      const status = await runStatus(resolve(target));
      if (options.json) writeJson(status);
      else {
        process.stdout.write(
          [
            `Lifecycle: ${status.lifecycle}`,
            `Gate: ${status.currentGate}`,
            `Feature: ${status.activeFeature ?? "none"}`,
            `Blockers: ${status.blockers.length === 0 ? "none" : status.blockers.join("; ")}`,
            `Last session: ${status.lastSession ?? "none"}`,
          ].join("\n") + "\n",
        );
      }
      process.exitCode = status.exitCode;
    });

  program
    .command("next")
    .description("Print the canonical next prompt")
    .argument("[target]", "project directory", ".")
    .option("--json", "emit JSON")
    .action(async (target: string, options: JsonOptions) => {
      const next = await runNext(resolve(target));
      if (options.json) writeJson(next);
      else process.stdout.write(`${next.action}\n`);
      process.exitCode = next.exitCode;
    });

  program
    .command("update")
    .description("Safely update only unmodified ADF-managed files")
    .argument("[target]", "project directory", ".")
    .option("--check", "preview available updates")
    .option("--yes", "apply the displayed conflict-free update without confirmation")
    .option("--json", "emit JSON")
    .action(async (target: string, options: UpdateCliOptions) => {
      const root = resolve(target);
      const preview = await runUpdate({ root, check: true });
      if (options.check || preview.status !== "updates-available") {
        writeUpdateResult(preview, options.json, true);
        process.exitCode = preview.exitCode;
        return;
      }
      if (options.json && !options.yes) {
        writeJson({
          status: "invocation-error",
          message: "Use `--check --json` for preview or add `--yes --json` to apply.",
        });
        process.exitCode = 2;
        return;
      }

      writeUpdateResult(preview, false, true, options.json ? process.stderr : process.stdout);
      if (!options.yes) {
        const answer = await promptConfirm({ message: "Apply this conflict-free ADF update?" });
        if (isCancel(answer) || !answer) {
          process.stdout.write("\nStatus: declined\n");
          process.exitCode = 0;
          return;
        }
      }

      const update = await runUpdate({ root });
      writeUpdateResult(update, options.json, false);
      process.exitCode = update.exitCode;
    });

  return program;
}

async function executeInitCli(target: string, options: InitCliOptions) {
  if (options.json && !options.yes && !options.dryRun) {
    writeJson({
      status: "invocation-error",
      message: "Use `--dry-run --json` for preview or add `--yes --json` to apply.",
    });
    process.exitCode = 2;
    return null;
  }
  const runner = new SystemProcessRunner();
  const specKit = new SpecKitAdapter(runner);
  const integrations = [...new Set([options.agent, ...options.also])];
  let previewPrinted = false;
  const previewDiagnosticCodes = new Set<string>();
  const result = await runInit(
    {
      root: resolve(target),
      defaultAgent: options.agent,
      integrations,
      ...(options.dryRun === undefined ? {} : { dryRun: options.dryRun }),
      ...(options.yes === undefined ? {} : { yes: options.yes }),
    },
    {
      now: () => new Date(),
      preview: async (plan, proposal, diagnostics) => {
        previewPrinted = true;
        diagnostics.forEach((diagnostic) => previewDiagnosticCodes.add(diagnostic.code));
        writeInitPreview(
          plan,
          proposal,
          diagnostics,
          options.json ? process.stderr : process.stdout,
        );
      },
      confirm: async () => {
        const answer = await promptConfirm({ message: "Apply this conflict-free ADF plan?" });
        return !isCancel(answer) && answer;
      },
      specKit,
      execute: async (command, args, cwd) =>
        runner.run(command, args, { cwd, interactive: options.yes !== true }),
    },
  );
  if (options.json) writeJson(result.json);
  else {
    if (!previewPrinted) {
      result.diagnostics.forEach((diagnostic) => previewDiagnosticCodes.add(diagnostic.code));
      writeInitPreview(result.plan, result.specKit, result.diagnostics, process.stdout);
    }
    writeDiagnostics(
      result.diagnostics.filter((diagnostic) => !previewDiagnosticCodes.has(diagnostic.code)),
    );
    process.stdout.write(buildInitSummary(result.status, result.nextAction));
  }
  process.exitCode = result.exitCode;
  return result;
}

export async function runInteractiveWizard(
  dependencies: GuidedOnboardingDependencies = {},
): Promise<void> {
  const write = dependencies.write ?? ((value: string) => process.stdout.write(value));
  write("ADF guided onboarding\n\n");
  const answers = await (dependencies.collectAnswers ?? collectOnboardingAnswers)();
  const config = createOnboardingConfig(answers);
  if (config === null) {
    write("\nOnboarding cancelled. No ADF files were written.\n");
    return;
  }

  const execute = dependencies.executeInit ?? executeInitCli;
  const result = await execute(config.target, {
    agent: config.defaultAgent,
    also: config.integrations.filter((agent) => agent !== config.defaultAgent),
  });
  if (result?.status !== "installed") return;

  write(
    `\nADF is ready. Open ${config.defaultAgent === "codex" ? "Codex" : "OpenCode"} in ${resolve(config.target)} and send:\n\n${buildFirstProjectPrompt(config.documentationPath)}\n`,
  );
}

async function collectOnboardingAnswers(): Promise<OnboardingAnswers | null> {
  const target = await promptText({
    message: "Where is the project you want to prepare?",
    initialValue: ".",
  });
  if (isCancel(target)) return null;

  const defaultAgent = await promptSelect<SpecKitIntegration>({
    message: "Which agent will you use primarily?",
    options: [
      { value: "codex", label: "Codex" },
      { value: "opencode", label: "OpenCode" },
    ],
  });
  if (isCancel(defaultAgent)) return null;

  const installAdditionalAgent = await promptConfirm({
    message: `Also configure ${defaultAgent === "codex" ? "OpenCode" : "Codex"}?`,
    initialValue: false,
  });
  if (isCancel(installAdditionalAgent)) return null;

  const hasDocumentation = await promptConfirm({
    message: "Do you already have project documentation?",
    initialValue: false,
  });
  if (isCancel(hasDocumentation)) return null;

  let documentationPath: string | undefined;
  if (hasDocumentation) {
    const path = await promptText({
      message: "Where is that documentation inside the project?",
      placeholder: "docs/discovery",
      validate: validateDocumentationPath,
    });
    if (isCancel(path)) return null;
    documentationPath = path;
  }

  return {
    target,
    defaultAgent,
    installAdditionalAgent,
    ...(documentationPath === undefined ? {} : { documentationPath }),
  };
}

type JsonOptions = { json?: boolean };
type InitCliOptions = JsonOptions & {
  agent: SpecKitIntegration;
  also: SpecKitIntegration[];
  dryRun?: boolean;
  yes?: boolean;
};
type UpdateCliOptions = JsonOptions & { check?: boolean; yes?: boolean };

function writeInitPreview(
  plan: Parameters<typeof renderChangePlanText>[0],
  specKit: { commands: Array<{ command: string; args: string[] }> },
  diagnostics: readonly { severity: string; code: string; message: string }[],
  output: NodeJS.WriteStream,
): void {
  if (specKit.commands.length > 0) {
    output.write(
      `SPEC KIT\n${specKit.commands
        .map((command) => `  $ ${command.command} ${command.args.join(" ")}`)
        .join("\n")}\n\n`,
    );
  }
  output.write(renderChangePlanText(plan));
  writeDiagnostics(diagnostics);
}

function writeUpdateResult(
  update: Awaited<ReturnType<typeof runUpdate>>,
  json: boolean | undefined,
  includePlan: boolean,
  output: NodeJS.WriteStream = process.stdout,
): void {
  if (json) {
    writeJson(update);
    return;
  }
  if (includePlan) output.write(renderChangePlanText(update.plan));
  if (update.orphaned.length > 0) {
    output.write(`\nOrphaned (not deleted): ${update.orphaned.join(", ")}\n`);
  }
  output.write(`\nStatus: ${update.status}\n`);
}

function parseAgent(value: string): SpecKitIntegration {
  if (value === "codex" || value === "opencode") return value;
  throw new InvalidArgumentError("agent must be codex or opencode");
}

function parseAgents(value: string, previous: SpecKitIntegration[]): SpecKitIntegration[] {
  return [...previous, parseAgent(value)];
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeDiagnostics(
  diagnostics: readonly { severity: string; code: string; message: string }[],
): void {
  for (const diagnostic of diagnostics) {
    process.stderr.write(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}\n`);
  }
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && isMainModule(entryPoint)) {
  buildCli()
    .exitOverride()
    .parseAsync()
    .catch((error: unknown) => {
      if (error instanceof CommanderError) {
        process.exitCode = error.exitCode === 0 ? 0 : 2;
        return;
      }
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}

function isMainModule(entryPoint: string): boolean {
  try {
    return realpathSync(resolve(entryPoint)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
