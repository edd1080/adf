import { access, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { parse } from "yaml";

import type { Diagnostic } from "../domain/diagnostics.js";
import { sha256 } from "../infrastructure/hashing.js";
import { NodeFileSystem } from "../infrastructure/filesystem.js";
import {
  listMarkdownFiles,
  parseFrontmatter,
  readManifest,
  readState,
  resolveDocumentLink,
} from "../services/harness-reader.js";
import { getCoreSkillInventory, getVendoredSkillInventory } from "../services/skill-registry.js";
import type { SpecKitAdapter } from "../services/spec-kit-adapter.js";

export type DoctorReport = {
  healthy: boolean;
  exitCode: 0 | 1;
  diagnostics: Diagnostic[];
};

type DoctorDependencies = {
  specKit: Pick<SpecKitAdapter, "detect">;
};

const REQUIRED_G1_FILES = [
  "docs/product/brief.md",
  "docs/product/prd.md",
  ".specify/memory/constitution.md",
  "docs/references/index.md",
] as const;
const VALID_AUTHORITIES = new Set(["product", "technical", "observational", "reference"]);

export async function runDoctor(
  root: string,
  dependencies: DoctorDependencies,
): Promise<DoctorReport> {
  const diagnostics: Diagnostic[] = [];
  const fileSystem = new NodeFileSystem();
  let manifest;
  let state;
  try {
    manifest = (await readManifest(root)).manifest;
  } catch (error) {
    diagnostics.push(
      errorDiagnostic("MANIFEST_INVALID", error, "Run `adf init` or repair the manifest."),
    );
    return report(diagnostics);
  }
  try {
    state = (await readState(root)).state;
  } catch (error) {
    diagnostics.push(errorDiagnostic("STATE_INVALID", error, "Repair `.harness/STATE.md`."));
  }

  for (const managed of manifest.managedFiles) {
    const path = resolve(root, managed.path);
    if (!(await fileSystem.exists(path))) {
      diagnostics.push({
        severity: "error",
        code: "MANAGED_FILE_MISSING",
        message: `Managed file is missing: ${managed.path}`,
        remediation: "Run `adf update --check` and review the repair plan.",
      });
      continue;
    }
    const content = await readFile(path);
    const observedSha256 =
      managed.scope === "managed-block"
        ? managedBlockSha256(content.toString("utf8"))
        : sha256(content);
    if (observedSha256 !== managed.installedSha256) {
      diagnostics.push({
        severity: "error",
        code: "MANAGED_HASH_MISMATCH",
        message: `Managed file was modified: ${managed.path}`,
        remediation: "Review the local modification before updating or restoring the managed file.",
      });
    }
  }

  const requiredSkills = [...getCoreSkillInventory(), ...getVendoredSkillInventory()];
  const requiredNames = new Set(requiredSkills.map((skill) => skill.name));
  for (const skill of requiredSkills) {
    const path = resolve(root, `.agents/skills/${skill.name}/SKILL.md`);
    if (!(await fileSystem.exists(path))) {
      diagnostics.push({
        severity: "error",
        code: "SKILL_MISSING",
        message: `Required skill is missing: ${skill.name}`,
        remediation: "Run `adf update --check` and review the managed repair.",
      });
    }
    for (const dependency of skill.dependencies) {
      if (!requiredNames.has(dependency)) {
        diagnostics.push({
          severity: "error",
          code: "SKILL_DEPENDENCY_MISSING",
          message: `${skill.name} depends on unavailable skill ${dependency}`,
          remediation: "Install the complete pinned ADF skill set.",
        });
      }
    }
  }

  try {
    const agents = await readFile(resolve(root, "AGENTS.md"), "utf8");
    if (
      !agents.includes("Project Lifecycle Router") ||
      !agents.includes("G0") ||
      !agents.includes("G6")
    ) {
      diagnostics.push({
        severity: "error",
        code: "AGENTS_ROUTER_INVALID",
        message: "AGENTS.md does not contain the ADF lifecycle router.",
        remediation: "Restore the ADF managed block without deleting user-owned instructions.",
      });
    }
  } catch (error) {
    diagnostics.push(errorDiagnostic("AGENTS_MISSING", error, "Restore root `AGENTS.md`."));
  }

  const detection = await dependencies.specKit.detect(root);
  diagnostics.push(...detection.diagnostics);
  if (!detection.available || detection.capabilities === undefined) {
    if (!diagnostics.some((diagnostic) => diagnostic.code === "SPEC_KIT_MISSING")) {
      diagnostics.push({
        severity: "error",
        code: "SPEC_KIT_MISSING",
        message: "Spec Kit is not available.",
        remediation: "Install with: uv tool install specify-cli",
      });
    }
  } else {
    if (
      detection.capabilities.defaultIntegration !== undefined &&
      detection.capabilities.defaultIntegration !== manifest.specKit.defaultIntegration
    ) {
      diagnostics.push({
        severity: "error",
        code: "SPEC_KIT_DEFAULT_MISMATCH",
        message: `Spec Kit default integration is ${detection.capabilities.defaultIntegration}, but the ADF manifest records ${manifest.specKit.defaultIntegration}.`,
        remediation:
          "Reconcile the Spec Kit default integration and the ADF manifest before continuing.",
      });
    }
    const installed = new Set(detection.capabilities.integrations);
    for (const integration of manifest.specKit.installedIntegrations) {
      if (!installed.has(integration)) {
        diagnostics.push({
          severity: "error",
          code: "SPEC_KIT_INTEGRATION_MISMATCH",
          message: `Manifest integration is not installed: ${integration}`,
          remediation: `Run \`specify integration install ${integration}\` after reviewing its preview.`,
        });
      }
    }
  }

  if (state !== undefined && ["bootstrap", "intake"].includes(state.lifecycle)) {
    for (const path of REQUIRED_G1_FILES) {
      if (!(await fileSystem.exists(resolve(root, path)))) {
        diagnostics.push({
          severity: "error",
          code: "G1_DOCUMENT_MISSING",
          message: `Required intake document is missing: ${path}`,
          remediation: "Restore the intake scaffold before continuing project discovery.",
        });
      }
    }
  }

  await inspectDocuments(root, diagnostics);
  if (!diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    diagnostics.push({
      severity: "info",
      code: "DOCTOR_OK",
      message: "ADF harness integrity checks passed.",
      remediation: "Continue with `adf next`.",
    });
  }
  return report(diagnostics);
}

async function inspectDocuments(root: string, diagnostics: Diagnostic[]): Promise<void> {
  for (const path of await listMarkdownFiles(root)) {
    const content = await readFile(path, "utf8");
    try {
      const metadata = parse(parseFrontmatter(content).frontmatter) as Record<string, unknown>;
      if (typeof metadata.authority !== "string" || !VALID_AUTHORITIES.has(metadata.authority)) {
        diagnostics.push({
          severity: "error",
          code: "DOCUMENT_AUTHORITY_INVALID",
          message: `Invalid document authority: ${relative(root, path)}`,
          remediation: "Use product, technical, observational, or reference authority.",
        });
      }
    } catch (error) {
      diagnostics.push(
        errorDiagnostic(
          "DOCUMENT_FRONTMATTER_INVALID",
          error,
          `Repair frontmatter in ${relative(root, path)}.`,
        ),
      );
    }
    for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = resolveDocumentLink(path, match[1] ?? "");
      if (target === null) continue;
      try {
        await access(target);
      } catch {
        diagnostics.push({
          severity: "error",
          code: "DOCUMENT_LINK_BROKEN",
          message: `Broken link in ${relative(root, path)}: ${match[1]}`,
          remediation: "Correct the link or restore the referenced local file.",
        });
      }
    }
  }
}

function errorDiagnostic(code: string, error: unknown, remediation: string): Diagnostic {
  return {
    severity: "error",
    code,
    message: error instanceof Error ? error.message : String(error),
    remediation,
  };
}

function report(diagnostics: Diagnostic[]): DoctorReport {
  const healthy = !diagnostics.some((diagnostic) => diagnostic.severity === "error");
  return { healthy, exitCode: healthy ? 0 : 1, diagnostics };
}

function managedBlockSha256(content: string): string | undefined {
  const startMarker = "<!-- ADF:START -->";
  const endMarker = "<!-- ADF:END -->";
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end < start) return undefined;
  return sha256(content.slice(start + startMarker.length, end).trim());
}
