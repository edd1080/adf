import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { SafeRelativePath } from "../domain/change-plan.js";
import { sha256 } from "../infrastructure/hashing.js";

export type TemplateVariables = Record<string, string>;

export type TemplateStrategy =
  "replace-if-unmodified" | "merge-markers" | "merge-json" | "preserve";

export type TemplateInventoryItem = {
  id: string;
  targetPath: string;
  strategy: TemplateStrategy;
  version: string;
  sha256: string;
  variables: readonly string[];
};

export type RenderedTemplate = TemplateInventoryItem & {
  content: string;
  renderedSha256: string;
};

type TemplateDefinition = Omit<TemplateInventoryItem, "sha256"> & {
  sourcePath: string;
};

const TEMPLATE_ROOT = new URL("../../templates/", import.meta.url);

const DEFINITIONS: readonly TemplateDefinition[] = [
  definition("core-agents", "core/AGENTS.md.hbs", "AGENTS.md", "merge-markers"),
  definition(
    "harness-manifest",
    "core/harness/manifest.yml.hbs",
    ".harness/manifest.yml",
    "replace-if-unmodified",
    [
      "frameworkVersion",
      "installedAt",
      "specKitVersion",
      "defaultIntegration",
      "installedIntegrations",
    ],
  ),
  definition(
    "harness-state",
    "core/harness/STATE.md.hbs",
    ".harness/STATE.md",
    "replace-if-unmodified",
  ),
  definition(
    "harness-handoff",
    "core/harness/HANDOFF.md.hbs",
    ".harness/HANDOFF.md",
    "replace-if-unmodified",
  ),
  definition("harness-lessons", "core/harness/LESSONS.md.hbs", ".harness/LESSONS.md", "preserve"),
  definition("product-brief", "docs/product/brief.md.hbs", "docs/product/brief.md", "preserve"),
  definition("product-prd", "docs/product/prd.md.hbs", "docs/product/prd.md", "preserve"),
  definition(
    "product-glossary",
    "docs/product/glossary.md.hbs",
    "docs/product/glossary.md",
    "preserve",
  ),
  definition(
    "product-user-flow",
    "docs/product/user-flow.md.hbs",
    "docs/product/user-flows/{{slug}}.md",
    "preserve",
    ["role", "slug"],
  ),
  definition(
    "references-index",
    "docs/references/index.md.hbs",
    "docs/references/index.md",
    "preserve",
  ),
  definition(
    "feature-verification",
    "spec-kit/verification.md.hbs",
    "specs/{{featureId}}/verification.md",
    "preserve",
    ["featureId"],
  ),
];

export function getTemplateInventory(): TemplateInventoryItem[] {
  return DEFINITIONS.map((template) => {
    const source = readTemplateSource(template);
    return {
      id: template.id,
      targetPath: template.targetPath,
      strategy: template.strategy,
      version: template.version,
      sha256: sha256(source),
      variables: template.variables,
    };
  });
}

export function renderTemplate(id: string, variables: TemplateVariables): RenderedTemplate {
  const definition = DEFINITIONS.find((template) => template.id === id);
  if (definition === undefined) throw new Error(`Unknown template: ${id}`);

  const unknownVariables = Object.keys(variables).filter(
    (variable) => !definition.variables.includes(variable),
  );
  if (unknownVariables.length > 0) {
    throw new Error(`Unknown template variable(s) for ${id}: ${unknownVariables.join(", ")}`);
  }

  const missingVariables = definition.variables.filter(
    (variable) => variables[variable] === undefined,
  );
  if (missingVariables.length > 0) {
    throw new Error(`Missing template variable(s) for ${id}: ${missingVariables.join(", ")}`);
  }

  const source = readTemplateSource(definition);
  const targetPath = renderText(definition.targetPath, variables);
  const content = renderText(source, variables);
  SafeRelativePath.parse(targetPath);

  return {
    id: definition.id,
    targetPath,
    strategy: definition.strategy,
    version: definition.version,
    sha256: sha256(source),
    variables: definition.variables,
    content,
    renderedSha256: sha256(content),
  };
}

function definition(
  id: string,
  sourcePath: string,
  targetPath: string,
  strategy: TemplateStrategy,
  variables: readonly string[] = [],
): TemplateDefinition {
  return { id, sourcePath, targetPath, strategy, version: "0.1.0", variables };
}

function readTemplateSource(template: TemplateDefinition): string {
  return readFileSync(fileURLToPath(new URL(template.sourcePath, TEMPLATE_ROOT)), "utf8");
}

function renderText(input: string, variables: TemplateVariables): string {
  return input.replace(/{{\s*([a-zA-Z][a-zA-Z0-9]*)\s*}}/g, (_match, variable: string) => {
    const value = variables[variable];
    if (value === undefined) throw new Error(`Missing template variable: ${variable}`);
    return value;
  });
}
