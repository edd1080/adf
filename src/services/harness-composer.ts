import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { stringify } from "yaml";

import type { Manifest } from "../domain/manifest.js";
import { sha256 } from "../infrastructure/hashing.js";
import { getAgentAdapterFiles } from "./agent-adapters.js";
import { getCoreSkillInventory, getVendoredSkillInventory } from "./skill-registry.js";
import {
  renderTemplate,
  type RenderedTemplate,
  type TemplateStrategy,
} from "./template-registry.js";

export type HarnessAgent = "codex" | "opencode";

export type HarnessCompositionInput = {
  frameworkVersion: string;
  installedAt: string;
  specKitVersion: string;
  defaultIntegration: HarnessAgent;
  installedIntegrations: readonly HarnessAgent[];
};

export type HarnessComposition = {
  input: HarnessCompositionInput;
  templates: RenderedTemplate[];
};

const PROJECT_ROOT = new URL("../../", import.meta.url);
const SPEC_KIT_PACKAGE_FILES = [
  "workflow/workflow.yml",
  "preset/preset.yml",
  "preset/templates/plan-addendum.md",
  "steps/adf-validate-gate/step.yml",
  "bundle/bundle.yml",
] as const;

export function composeHarnessTemplates(input: HarnessCompositionInput): HarnessComposition {
  const templates: RenderedTemplate[] = [
    renderTemplate("core-agents", {}),
    renderTemplate("harness-state", {}),
    renderTemplate("harness-handoff", {}),
    renderTemplate("harness-lessons", {}),
    renderTemplate("product-brief", {}),
    renderTemplate("product-prd", {}),
    renderTemplate("product-glossary", {}),
    renderTemplate("references-index", {}),
    fileTemplate(
      "project-constitution",
      ".specify/memory/constitution.md",
      readProjectFile("templates/spec-kit/constitution.md.hbs"),
      "preserve",
      input.frameworkVersion,
    ),
    ...specKitPackageTemplates(input.frameworkVersion),
    ...skillTemplates(input.frameworkVersion),
    ...adapterTemplates(input),
  ];
  const manifest = buildManifest(input, templates);
  templates.push(manifestTemplate(input.frameworkVersion, manifest));

  return {
    input: { ...input, installedIntegrations: [...input.installedIntegrations] },
    templates: templates.sort((left, right) => left.targetPath.localeCompare(right.targetPath)),
  };
}

export function refreshCompositionManifest(composition: HarnessComposition): HarnessComposition {
  const withoutManifest = composition.templates.filter(
    (template) => template.targetPath !== ".harness/manifest.yml",
  );
  const manifest = buildManifest(composition.input, withoutManifest);
  return {
    ...composition,
    templates: [
      ...withoutManifest,
      manifestTemplate(composition.input.frameworkVersion, manifest),
    ].sort((left, right) => left.targetPath.localeCompare(right.targetPath)),
  };
}

export function isStaticManagedTemplate(template: RenderedTemplate): boolean {
  return (
    template.targetPath.startsWith(".agents/skills/") ||
    template.targetPath.startsWith(".opencode/agents/") ||
    template.targetPath.startsWith(".harness/spec-kit/")
  );
}

export function isUpdatableTemplate(template: RenderedTemplate): boolean {
  return (
    isStaticManagedTemplate(template) ||
    template.targetPath === "AGENTS.md" ||
    template.targetPath === "opencode.json"
  );
}

function specKitPackageTemplates(version: string): RenderedTemplate[] {
  return SPEC_KIT_PACKAGE_FILES.map((path) =>
    fileTemplate(
      `spec-kit-${path.replaceAll("/", "-")}`,
      `.harness/spec-kit/${path}`,
      readProjectFile(`templates/spec-kit/${path}`),
      "replace-if-unmodified",
      version,
    ),
  );
}

function skillTemplates(version: string): RenderedTemplate[] {
  const core = getCoreSkillInventory().map((skill) =>
    fileTemplate(
      `core-skill-${skill.name}`,
      `.agents/skills/${skill.name}/SKILL.md`,
      readProjectFile(skill.templatePath),
      "replace-if-unmodified",
      version,
    ),
  );
  const vendored = getVendoredSkillInventory().flatMap((skill) => [
    fileTemplate(
      `vendor-skill-${skill.name}`,
      `.agents/skills/${skill.name}/SKILL.md`,
      readProjectFile(skill.templatePath),
      "replace-if-unmodified",
      version,
    ),
    ...skill.resources.map((resource) =>
      fileTemplate(
        `vendor-skill-${skill.name}-${resource.replaceAll("/", "-")}`,
        `.agents/skills/${skill.name}/${resource}`,
        readProjectFile(`templates/skills/vendor/${skill.name}/${resource}`),
        "replace-if-unmodified",
        version,
      ),
    ),
  ]);
  return [...core, ...vendored];
}

function adapterTemplates(input: HarnessCompositionInput): RenderedTemplate[] {
  if (!input.installedIntegrations.includes("opencode")) return [];
  return getAgentAdapterFiles("opencode").map((file) =>
    fileTemplate(
      `adapter-opencode-${file.targetPath.replaceAll("/", "-")}`,
      file.targetPath,
      file.content,
      file.strategy === "merge-json" ? "merge-json" : "replace-if-unmodified",
      input.frameworkVersion,
    ),
  );
}

function buildManifest(
  input: HarnessCompositionInput,
  templates: readonly RenderedTemplate[],
): Manifest {
  const staticTemplates = templates.filter(isStaticManagedTemplate);
  const managedTemplates = templates.filter(
    (template) => isStaticManagedTemplate(template) || template.targetPath === "AGENTS.md",
  );
  const installedSkillNames = new Set(
    templates
      .filter((template) => template.targetPath.endsWith("/SKILL.md"))
      .map((template) => template.targetPath.split("/").at(-2)),
  );
  const coreSkills: Manifest["skills"] = getCoreSkillInventory()
    .filter((skill) => installedSkillNames.has(skill.name))
    .map((skill) => {
      const template = staticTemplates.find(
        (candidate) => candidate.targetPath === `.agents/skills/${skill.name}/SKILL.md`,
      );
      if (template === undefined) throw new Error(`Missing composed core skill: ${skill.name}`);
      return {
        kind: "adf" as const,
        name: skill.name,
        version: input.frameworkVersion,
        sha256: template.renderedSha256,
      };
    });
  const vendoredSkills: Manifest["skills"] = getVendoredSkillInventory()
    .filter((skill) => installedSkillNames.has(skill.name))
    .map((skill) => ({
      kind: "vendored" as const,
      name: skill.name,
      source: skill.repository,
      upstreamCommit: skill.commit,
      license: "MIT" as const,
      originalSha256: skill.originalSha256,
      adaptedSha256: skill.adaptedSha256,
      adaptation: skill.adaptations.join(" "),
    }));

  return {
    schemaVersion: 1,
    framework: {
      name: "adf",
      version: input.frameworkVersion,
      installedAt: input.installedAt,
    },
    specKit: {
      version: input.specKitVersion,
      defaultIntegration: input.defaultIntegration,
      installedIntegrations: [...new Set(input.installedIntegrations)],
    },
    managedFiles: managedTemplates.map((template) => ({
      path: template.targetPath,
      strategy: template.strategy,
      installedSha256:
        template.targetPath === "AGENTS.md"
          ? sha256(template.content.trim())
          : template.renderedSha256,
      ...(template.targetPath === "AGENTS.md" ? { scope: "managed-block" as const } : {}),
    })),
    skills: [...coreSkills, ...vendoredSkills],
  };
}

function manifestTemplate(version: string, manifest: Manifest): RenderedTemplate {
  return fileTemplate(
    "harness-manifest",
    ".harness/manifest.yml",
    stringify(manifest, { lineWidth: 0 }),
    "replace-if-unmodified",
    version,
  );
}

function fileTemplate(
  id: string,
  targetPath: string,
  content: string,
  strategy: TemplateStrategy,
  version: string,
): RenderedTemplate {
  return {
    id,
    targetPath,
    strategy,
    version,
    sha256: sha256(content),
    variables: [],
    content,
    renderedSha256: sha256(content),
  };
}

function readProjectFile(projectRelativePath: string): string {
  return readFileSync(fileURLToPath(new URL(projectRelativePath, PROJECT_ROOT)), "utf8");
}
