import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { sha256 } from "../infrastructure/hashing.js";

export const VENDORED_SKILLS = [
  "grilling",
  "grill-with-docs",
  "domain-modeling",
  "codebase-design",
  "tdd",
  "diagnosing-bugs",
  "code-review",
  "writing-great-skills",
] as const;

export const CORE_SKILLS = [
  "project-intake",
  "session-start",
  "context-router",
  "bug-fix",
  "verify-work",
  "feature-close",
  "session-end",
] as const;

export type VendoredSkillName = (typeof VENDORED_SKILLS)[number];
export type CoreSkillName = (typeof CORE_SKILLS)[number];
export type SkillName = VendoredSkillName | CoreSkillName;
export type RoutingLifecycle = "intake" | "active-handoff" | "active-feature" | "ready";

export type SkillFrontmatter = {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  [key: string]: unknown;
};

export type SkillDocument = {
  frontmatter: SkillFrontmatter;
  body: string;
};

export type VendoredSkillInventoryItem = {
  name: VendoredSkillName;
  upstreamName: string;
  repository: string;
  commit: string;
  sourcePath: string;
  templatePath: string;
  license: string;
  originalSha256: string;
  adaptedSha256: string;
  adaptations: readonly string[];
  dependencies: readonly VendoredSkillName[];
  resources: readonly string[];
};

export type CoreSkillInventoryItem = {
  name: CoreSkillName;
  templatePath: string;
  description: string;
  trigger: string;
  dependencies: readonly SkillName[];
};

export type SkillRoute = {
  skills: readonly SkillName[];
  gate: "G1" | "G4" | "G5" | "G6" | "none";
};

type UpstreamManifest = {
  repository: string;
  commit: string;
  license: string;
  skills: Array<Omit<VendoredSkillInventoryItem, "repository" | "commit" | "license">>;
};

const PROJECT_ROOT = new URL("../../", import.meta.url);
const UPSTREAM_MANIFEST_PATH = "templates/skills/vendor/UPSTREAM.yml";

const CORE_DEFINITIONS: ReadonlyArray<{
  name: CoreSkillName;
  trigger: string;
}> = [
  { name: "project-intake", trigger: "project intake" },
  { name: "session-start", trigger: "session continuity" },
  { name: "context-router", trigger: "context routing" },
  { name: "bug-fix", trigger: "bug fixing" },
  { name: "verify-work", trigger: "work verification" },
  { name: "feature-close", trigger: "feature closure" },
  { name: "session-end", trigger: "session handoff" },
];

export function getVendoredSkillInventory(): VendoredSkillInventoryItem[] {
  const manifest = readYaml<UpstreamManifest>(UPSTREAM_MANIFEST_PATH);
  const names = manifest.skills.map((skill) => skill.name);

  if (JSON.stringify(names) !== JSON.stringify(VENDORED_SKILLS)) {
    throw new Error("Vendored skill manifest does not match the frozen allowlist");
  }

  return manifest.skills.map((skill) => {
    const document = readSkillDocument(skill.templatePath);
    const content = readProjectFile(skill.templatePath);
    if (document.frontmatter.name !== skill.name) {
      throw new Error(`Skill name does not match directory: ${skill.templatePath}`);
    }
    if (sha256(content) !== skill.adaptedSha256) {
      throw new Error(`Adapted skill hash mismatch: ${skill.name}`);
    }

    return {
      ...skill,
      repository: manifest.repository,
      commit: manifest.commit,
      license: manifest.license,
    };
  });
}

export function getCoreSkillInventory(): CoreSkillInventoryItem[] {
  return CORE_DEFINITIONS.map((definition) => {
    const templatePath = `templates/skills/core/${definition.name}/SKILL.md`;
    const document = readSkillDocument(templatePath);
    if (document.frontmatter.name !== definition.name) {
      throw new Error(`Core skill name does not match directory: ${templatePath}`);
    }
    const dependencies = parseDependencies(document.frontmatter.metadata?.["adf-dependencies"]);

    return {
      name: definition.name,
      templatePath,
      description: document.frontmatter.description,
      trigger: definition.trigger,
      dependencies,
    };
  });
}

export function routeSkills(input: { prompt: string; lifecycle: RoutingLifecycle }): SkillRoute {
  const prompt = normalizePrompt(input.prompt);

  if (input.lifecycle === "intake" || /\binicia (?:el )?proyecto\b/.test(prompt)) {
    return { skills: ["project-intake"], gate: "G1" };
  }
  if (input.lifecycle === "active-handoff" || /\bcontinua (?:el )?proyecto\b/.test(prompt)) {
    return { skills: ["session-start"], gate: "G4" };
  }
  if (/\b(?:cierra|termina|finaliza) (?:la )?sesion\b|\bprepara (?:el )?handoff\b/.test(prompt)) {
    return { skills: ["session-end"], gate: "none" };
  }
  if (/\b(?:cierra|completa|finaliza) (?:la )?feature\b/.test(prompt)) {
    return { skills: ["feature-close"], gate: "G6" };
  }
  if (/\b(?:verifica|demuestra|valida)\b.*\b(?:bloque|criterio|listo|evidencia)\b/.test(prompt)) {
    return { skills: ["verify-work"], gate: "G5" };
  }
  if (/\b(?:bug|error|falla|fallo|defecto|duplica|lento|slow|throwing|failing)\b/.test(prompt)) {
    return { skills: ["bug-fix"], gate: "G4" };
  }
  if (
    /\b(?:review|revisa|audita)\b.*\b(?:pr|pull request|diff|branch|rama|specification|especificacion)\b/.test(
      prompt,
    )
  ) {
    return { skills: ["code-review"], gate: "none" };
  }
  if (
    /\b(?:implementa|construye|agrega|anade|crea)\b.*\b(?:flujo|feature|funcionalidad|comportamiento)\b/.test(
      prompt,
    )
  ) {
    return { skills: ["context-router"], gate: "G4" };
  }

  return { skills: [], gate: /\b(?:typo|errata)\b/.test(prompt) ? "G4" : "none" };
}

export function readSkillDocument(projectRelativePath: string): SkillDocument {
  const content = readProjectFile(projectRelativePath);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
  if (match === null) throw new Error(`Invalid skill frontmatter: ${projectRelativePath}`);

  const frontmatter = parse(match[1] ?? "") as unknown;
  if (!isRecord(frontmatter)) throw new Error(`Invalid skill metadata: ${projectRelativePath}`);
  if (typeof frontmatter.name !== "string" || typeof frontmatter.description !== "string") {
    throw new Error(`Skill requires name and description: ${projectRelativePath}`);
  }

  return {
    frontmatter: frontmatter as SkillFrontmatter,
    body: match[2] ?? "",
  };
}

function readYaml<T>(projectRelativePath: string): T {
  return parse(readProjectFile(projectRelativePath)) as T;
}

function readProjectFile(projectRelativePath: string): string {
  return readFileSync(fileURLToPath(new URL(projectRelativePath, PROJECT_ROOT)), "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDependencies(value: string | undefined): SkillName[] {
  if (value === undefined || value.trim() === "") return [];
  const known = new Set<string>([...CORE_SKILLS, ...VENDORED_SKILLS]);
  return value.split(",").map((dependency) => {
    const name = dependency.trim();
    if (!known.has(name)) throw new Error(`Unknown skill dependency: ${name}`);
    return name as SkillName;
  });
}

function normalizePrompt(prompt: string): string {
  return prompt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
