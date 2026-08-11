#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { parse } from "yaml";

export const VENDORED_SKILLS = [
  "grilling",
  "grill-with-docs",
  "domain-modeling",
  "codebase-design",
  "tdd",
  "diagnosing-bugs",
  "code-review",
  "writing-great-skills",
];

const REPOSITORY = "https://github.com/mattpocock/skills.git";
const ADF_VERSION = "0.1.0";

const DEFINITIONS = [
  definition(
    "grilling",
    "skills/productivity/grilling",
    [],
    ["Add a local fact-finding fallback when subagents are unavailable."],
  ),
  definition(
    "grill-with-docs",
    "skills/engineering/grill-with-docs",
    ["grilling", "domain-modeling"],
    ["Make the two skill dependencies explicit.", "Remove unsupported invocation metadata."],
  ),
  definition(
    "domain-modeling",
    "skills/engineering/domain-modeling",
    [],
    [
      "Redirect the glossary to docs/product/glossary.md.",
      "Redirect architectural decisions to docs/decisions/.",
    ],
  ),
  definition(
    "codebase-design",
    "skills/engineering/codebase-design",
    [],
    ["Add a sequential design fallback when subagents are unavailable."],
  ),
  definition(
    "tdd",
    "skills/engineering/tdd",
    ["codebase-design"],
    ["Use ADF glossary and decision paths.", "Preserve the red-before-green vertical-slice loop."],
  ),
  definition(
    "diagnosing-bugs",
    "skills/engineering/diagnosing-bugs",
    ["tdd"],
    ["Use ADF glossary and decision paths.", "Preserve the tight red-capable reproduction gate."],
  ),
  definition(
    "code-review",
    "skills/engineering/code-review",
    [],
    [
      "Use local specs without assuming a configured issue tracker.",
      "Run review axes sequentially when subagents are unavailable.",
      "Keep the review read-only and inventory all writes.",
    ],
  ),
  definition(
    "writing-great-skills",
    "skills/productivity/writing-for-agents",
    [],
    [
      "Record upstream rename from writing-for-agents to the stable ADF name writing-great-skills.",
      "Remove agent-specific invocation metadata for Codex and OpenCode portability.",
    ],
    "writing-for-agents",
  ),
];

const EXPECTED_LAYOUTS = {
  grilling: ["SKILL.md", "agents/openai.yaml"],
  "grill-with-docs": ["SKILL.md", "agents/openai.yaml"],
  "domain-modeling": ["ADR-FORMAT.md", "CONTEXT-FORMAT.md", "SKILL.md", "agents/openai.yaml"],
  "codebase-design": ["DEEPENING.md", "DESIGN-IT-TWICE.md", "SKILL.md", "agents/openai.yaml"],
  tdd: ["SKILL.md", "agents/openai.yaml", "mocking.md", "tests.md"],
  "diagnosing-bugs": ["SKILL.md", "agents/openai.yaml", "scripts/hitl-loop.template.sh"],
  "code-review": ["SKILL.md", "agents/openai.yaml"],
  "writing-for-agents": ["SKILL-MECHANICS.md", "SKILL.md", "agents/openai.yaml"],
};

export function validateAllowlist(allowlist) {
  if (JSON.stringify(allowlist) !== JSON.stringify(VENDORED_SKILLS)) {
    throw new Error(`Allowlist must be exactly: ${VENDORED_SKILLS.join(",")}`);
  }
}

export function vendorSkills({ source, output, commit, allowlist }) {
  validateAllowlist(allowlist);
  const sourceRoot = resolve(source);
  const outputRoot = resolve(output);
  const actualCommit = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (actualCommit !== commit) {
    throw new Error(`Checkout commit ${actualCommit} does not match requested commit ${commit}`);
  }

  const licensePath = join(sourceRoot, "LICENSE");
  const license = readFileSync(licensePath, "utf8");
  if (!license.startsWith("MIT License") || !license.includes("Copyright (c) 2026 Matt Pocock")) {
    throw new Error("Expected Matt Pocock MIT license is absent");
  }

  mkdirSync(outputRoot, { recursive: true });
  const records = [];
  for (const item of DEFINITIONS) {
    const upstreamDirectory = join(sourceRoot, item.sourceDirectory);
    const actualLayout = walkFiles(upstreamDirectory);
    const expectedLayout = EXPECTED_LAYOUTS[item.upstreamName];
    if (JSON.stringify(actualLayout) !== JSON.stringify(expectedLayout)) {
      throw new Error(
        `Unexpected upstream paths for ${item.upstreamName}: ${actualLayout.join(", ")}`,
      );
    }

    const originalPath = join(upstreamDirectory, "SKILL.md");
    const original = readFileSync(originalPath, "utf8");
    const adapted = adaptSkill(item, original);
    const targetDirectory = join(outputRoot, item.name);
    mkdirSync(targetDirectory, { recursive: true });
    writeFileSync(join(targetDirectory, "SKILL.md"), adapted);

    const resources = actualLayout.filter(
      (resource) => resource !== "SKILL.md" && resource !== "agents/openai.yaml",
    );
    for (const resource of resources) {
      const target = join(targetDirectory, resource);
      mkdirSync(dirname(target), { recursive: true });
      const content = adaptPaths(readFileSync(join(upstreamDirectory, resource), "utf8"));
      writeFileSync(target, adaptResource(item, resource, content));
      if (resource.endsWith(".sh")) chmodSync(target, 0o755);
    }

    records.push({
      name: item.name,
      upstreamName: item.upstreamName,
      sourcePath: `${item.sourceDirectory}/SKILL.md`,
      templatePath: `templates/skills/vendor/${item.name}/SKILL.md`,
      originalSha256: sha256(original),
      adaptedSha256: sha256(adapted),
      adaptations: [
        "Normalize frontmatter to portable Agent Skills fields and MIT metadata.",
        "Require explicit authorization for Git publication and a final file inventory.",
        ...item.adaptations,
      ],
      dependencies: item.dependencies,
      resources,
    });
  }

  writeFileSync(join(outputRoot, "LICENSE.mattpocock-skills"), license);
  writeFileSync(join(outputRoot, "UPSTREAM.yml"), renderManifest(commit, records));
  return records;
}

function definition(name, sourceDirectory, dependencies, adaptations, upstreamName = name) {
  return { name, upstreamName, sourceDirectory, dependencies, adaptations };
}

function adaptSkill(item, original) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(original);
  if (match === null) throw new Error(`Invalid upstream frontmatter: ${item.upstreamName}`);
  const originalFrontmatter = parse(match[1]);
  let description = String(originalFrontmatter.description ?? "").trim();
  if (item.name === "grill-with-docs") {
    description =
      "Interview the user to sharpen a plan while maintaining the ADF glossary and architectural decisions. Use during discovery when decisions remain unresolved and durable documentation is required.";
  }
  if (item.name === "writing-great-skills") {
    description =
      "Write documents for coding agents. Use when creating or editing skills, AGENTS.md, agent instructions, lifecycle routers, or context pointers.";
  }

  const metadata = [
    `  adf-version: ${quote(ADF_VERSION)}`,
    `  upstream-name: ${quote(item.upstreamName)}`,
  ];
  if (item.dependencies.length > 0) {
    metadata.push(`  adf-dependencies: ${quote(item.dependencies.join(","))}`);
  }

  let body = adaptPaths(match[2]);
  body = adaptBody(item.name, body);
  body = body.replaceAll("writing-for-agents", "writing-great-skills");
  body = `${body.trimEnd()}\n\n## ADF boundaries\n\nKeep Git changes local until the user explicitly authorizes a commit, push, release, or deployment. End with a file inventory covering every created, modified, or deleted path; for read-only work, report \`Writes: none\`.\n`;

  return [
    "---",
    `name: ${item.name}`,
    `description: ${quote(description)}`,
    "license: MIT",
    "metadata:",
    ...metadata,
    "---",
    "",
    body,
  ].join("\n");
}

function adaptBody(name, body) {
  if (name === "grilling") {
    body = body.replace(
      /Finding _facts_ is your job[\s\S]*?The _decisions_ are the user's — put each to them and wait\./,
      "Finding _facts_ is your job, never the user's. Use subagents for independent fact-finding when available; otherwise inspect the filesystem and tools yourself before asking. Facts are prerequisites you resolve from evidence. The _decisions_ are the user's — put each decision to them and wait.",
    );
  }

  if (name === "grill-with-docs") {
    body = `${body.trim()}\n\nAfter every resolved term or durable decision, invoke the matching dependency immediately. Completion requires an empty decision frontier plus a final inventory of the documentation updated during the interview.\n`;
  }

  if (name === "domain-modeling") {
    body = body.replace(
      /## File structure[\s\S]*?## During the session/,
      "## ADF file structure\n\nUse `docs/product/glossary.md` as the ubiquitous-language source of truth and `docs/decisions/` for architectural decisions. Create decision files lazily. Preserve existing glossary structure and document authority.\n\n## During the session",
    );
  }

  if (name === "code-review") {
    body = body
      .replace(
        "Both axes run as **parallel sub-agents** so they don't pollute each other's context, then this skill aggregates their findings.",
        "Run both axes independently. Prefer parallel subagents when available; otherwise complete two clearly separated sequential passes, resetting the evidence list between axes before aggregating findings.",
      )
      .replace(
        /The issue tracker should have been provided to you[\s\S]*?missing\./,
        "Use an issue tracker only when the repository already configures one. Local specs and user-provided paths remain valid authorities without external tracker setup.",
      )
      .replace("### 4. Spawn both sub-agents in parallel", "### 4. Run both axes independently")
      .replace(
        "If the spec is missing, skip the Spec sub-agent and note this in the final report.",
        "If subagents are unavailable, run the Standards prompt first and retain only its final findings, then run the Spec prompt as a fresh pass. If the spec is missing, skip the Spec axis and note this in the final report.",
      );
  }

  return body;
}

function adaptPaths(content) {
  return content
    .replaceAll("CONTEXT-MAP.md", "docs/product/context-map.md")
    .replaceAll("CONTEXT.md", "docs/product/glossary.md")
    .replaceAll("docs/adr/", "docs/decisions/")
    .replaceAll("docs/adr", "docs/decisions");
}

function adaptResource(item, resource, content) {
  if (item.name === "codebase-design" && resource === "DESIGN-IT-TWICE.md") {
    return content.replace(
      /parallel sub-agents/gi,
      "independent design passes (parallel subagents when available; otherwise sequential passes)",
    );
  }
  return content.replaceAll("writing-for-agents", "writing-great-skills");
}

function renderManifest(commit, records) {
  const lines = [
    `repository: ${quote(REPOSITORY)}`,
    `commit: ${quote(commit)}`,
    'license: "MIT"',
    "skills:",
  ];
  for (const record of records) {
    lines.push(
      `  - name: ${quote(record.name)}`,
      `    upstreamName: ${quote(record.upstreamName)}`,
      `    sourcePath: ${quote(record.sourcePath)}`,
      `    templatePath: ${quote(record.templatePath)}`,
      `    originalSha256: ${quote(record.originalSha256)}`,
      `    adaptedSha256: ${quote(record.adaptedSha256)}`,
      "    adaptations:",
      ...record.adaptations.map((note) => `      - ${quote(note)}`),
      "    dependencies:",
      ...(record.dependencies.length === 0
        ? ["      []"]
        : record.dependencies.map((dependency) => `      - ${quote(dependency)}`)),
      "    resources:",
      ...(record.resources.length === 0
        ? ["      []"]
        : record.resources.map((resource) => `      - ${quote(resource)}`)),
    );
  }
  return `${lines.join("\n")}\n`;
}

function walkFiles(directory) {
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(relative(directory, path));
      else throw new Error(`Unexpected non-file path: ${path}`);
    }
  };
  if (!statSync(directory).isDirectory()) throw new Error(`Missing skill directory: ${directory}`);
  visit(directory);
  return files.sort();
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function quote(value) {
  return JSON.stringify(value);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === undefined || value === undefined || !key.startsWith("--")) {
      throw new Error(
        "Usage: vendor-skills --source PATH --output PATH --commit SHA --allowlist a,b,c",
      );
    }
    values.set(key.slice(2), value);
  }
  for (const required of ["source", "output", "commit", "allowlist"]) {
    if (!values.has(required)) throw new Error(`Missing --${required}`);
  }
  return {
    source: values.get("source"),
    output: values.get("output"),
    commit: values.get("commit"),
    allowlist: values.get("allowlist").split(","),
  };
}

if (
  globalThis.process.argv[1] &&
  pathToFileURL(resolve(globalThis.process.argv[1])).href === import.meta.url
) {
  vendorSkills(parseArguments(globalThis.process.argv.slice(2)));
}
