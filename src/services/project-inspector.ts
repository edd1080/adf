import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import type { Diagnostic } from "../domain/diagnostics.js";
import { NodeFileSystem } from "../infrastructure/filesystem.js";
import { sha256 } from "../infrastructure/hashing.js";
import { SystemProcessRunner, type ProcessRunner } from "../infrastructure/process-runner.js";

export type DocumentObservation = {
  path: string;
  status?: string;
  authority?: string;
};

export type ExistingFileObservation = {
  path: string;
  sha256: string;
  adfManagedBlockSha256?: string;
};

export type ProjectInspection = {
  root: string;
  kind: "greenfield" | "brownfield";
  git: { present: boolean; dirty: boolean | "unknown" };
  specKit: { present: boolean; integrationFile?: string };
  agents: { agentsMd: boolean; codex: boolean; opencode: boolean };
  documents: DocumentObservation[];
  files: ExistingFileObservation[];
  conflicts: Diagnostic[];
  warnings: Diagnostic[];
};

type InspectorDependencies = {
  processRunner?: ProcessRunner;
};

const IGNORED_WALK_DIRECTORIES = new Set([".git", "node_modules", "dist"]);

export async function inspectProject(
  root: string,
  dependencies: InspectorDependencies = {},
): Promise<ProjectInspection> {
  const resolvedRoot = resolve(root);
  const fileSystem = new NodeFileSystem();
  const runner = dependencies.processRunner ?? new SystemProcessRunner();
  const rootEntries = await readdir(resolvedRoot, { withFileTypes: true });
  const meaningfulEntries = rootEntries.filter(
    (entry) => entry.name !== ".git" && entry.name !== ".DS_Store",
  );
  const gitPresent = await fileSystem.exists(resolve(resolvedRoot, ".git"));
  const gitDirty = gitPresent ? await detectDirtyGit(resolvedRoot, runner) : "unknown";
  const warnings: Diagnostic[] = [];

  if (gitDirty === true) {
    warnings.push({
      severity: "warning",
      code: "GIT_DIRTY",
      message: "The target Git working tree has uncommitted changes.",
      remediation: "Review the bootstrap preview carefully before applying changes.",
    });
  }

  const specifyDirectory = resolve(resolvedRoot, ".specify");
  const integrationPath = resolve(specifyDirectory, "integration.json");
  const specKitPresent = await fileSystem.exists(specifyDirectory);
  const integrationFilePresent = await fileSystem.exists(integrationPath);
  const conflicts = await findUnsafeSymlinks(resolvedRoot);

  return {
    root: resolvedRoot,
    kind: meaningfulEntries.length === 0 ? "greenfield" : "brownfield",
    git: { present: gitPresent, dirty: gitDirty },
    specKit: {
      present: specKitPresent,
      ...(integrationFilePresent ? { integrationFile: ".specify/integration.json" } : {}),
    },
    agents: {
      agentsMd: await fileSystem.exists(resolve(resolvedRoot, "AGENTS.md")),
      codex:
        (await fileSystem.exists(resolve(resolvedRoot, ".codex"))) ||
        (await fileSystem.exists(resolve(resolvedRoot, ".agents/skills"))),
      opencode:
        (await fileSystem.exists(resolve(resolvedRoot, "opencode.json"))) ||
        (await fileSystem.exists(resolve(resolvedRoot, ".opencode"))),
    },
    documents: await inspectDocuments(resolvedRoot),
    files: await inspectExistingFiles(resolvedRoot),
    conflicts,
    warnings,
  };
}

async function inspectExistingFiles(root: string): Promise<ExistingFileObservation[]> {
  const files: ExistingFileObservation[] = [];
  await walkFiles(root, async (absolutePath) => {
    const bytes = await readFile(absolutePath);
    const path = toProjectPath(root, absolutePath);
    const managedBlockSha256 =
      path === "AGENTS.md" ? extractManagedBlockSha256(bytes.toString("utf8")) : undefined;
    files.push({
      path,
      sha256: sha256(bytes),
      ...(managedBlockSha256 === undefined ? {} : { adfManagedBlockSha256: managedBlockSha256 }),
    });
  });
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function extractManagedBlockSha256(content: string): string | undefined {
  const startMarker = "<!-- ADF:START -->";
  const endMarker = "<!-- ADF:END -->";
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end < start) return undefined;
  return sha256(content.slice(start + startMarker.length, end).trim());
}

async function detectDirtyGit(root: string, runner: ProcessRunner): Promise<boolean | "unknown"> {
  const result = await runner.run("git", ["status", "--porcelain"], { cwd: root });
  if (result.exitCode !== 0) return "unknown";
  return result.stdout.trim().length > 0;
}

async function inspectDocuments(root: string): Promise<DocumentObservation[]> {
  const docsRoot = resolve(root, "docs");
  const fileSystem = new NodeFileSystem();
  if (!(await fileSystem.exists(docsRoot))) return [];

  const observations: DocumentObservation[] = [];
  await walkFiles(docsRoot, async (absolutePath) => {
    if (!absolutePath.endsWith(".md")) return;
    const content = await readFile(absolutePath, "utf8");
    const metadata = parseFrontmatter(content);
    observations.push({
      path: toProjectPath(root, absolutePath),
      ...(metadata.status === undefined ? {} : { status: metadata.status }),
      ...(metadata.authority === undefined ? {} : { authority: metadata.authority }),
    });
  });

  return observations.sort((left, right) => left.path.localeCompare(right.path));
}

async function findUnsafeSymlinks(root: string): Promise<Diagnostic[]> {
  const conflicts: Diagnostic[] = [];
  const canonicalRoot = await realpath(root);

  await walkEntries(root, async (absolutePath, symbolicLink) => {
    if (!symbolicLink) return;
    try {
      const destination = await realpath(absolutePath);
      if (!isInside(canonicalRoot, destination)) {
        conflicts.push({
          severity: "error",
          code: "SYMLINK_ESCAPE",
          message: `Symlink resolves outside the project: ${toProjectPath(root, absolutePath)}`,
          remediation: "Remove the symlink or choose a target fully contained by the project.",
        });
      }
    } catch {
      conflicts.push({
        severity: "error",
        code: "SYMLINK_BROKEN",
        message: `Symlink cannot be resolved: ${toProjectPath(root, absolutePath)}`,
        remediation: "Repair or remove the broken symlink before bootstrapping ADF.",
      });
    }
  });

  return conflicts;
}

async function walkFiles(
  root: string,
  visit: (absolutePath: string) => Promise<void>,
): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_WALK_DIRECTORIES.has(entry.name)) continue;
    const absolutePath = resolve(root, entry.name);
    if (entry.isDirectory()) await walkFiles(absolutePath, visit);
    else if (entry.isFile()) await visit(absolutePath);
  }
}

async function walkEntries(
  root: string,
  visit: (absolutePath: string, symbolicLink: boolean) => Promise<void>,
): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_WALK_DIRECTORIES.has(entry.name)) continue;
    const absolutePath = resolve(root, entry.name);
    const details = await lstat(absolutePath);
    await visit(absolutePath, details.isSymbolicLink());
    if (details.isDirectory() && !details.isSymbolicLink()) {
      await walkEntries(absolutePath, visit);
    }
  }
}

function parseFrontmatter(content: string): Record<string, string> {
  if (!content.startsWith("---\n")) return {};
  const end = content.indexOf("\n---", 4);
  if (end === -1) return {};

  return Object.fromEntries(
    content
      .slice(4, end)
      .split("\n")
      .map((line) => line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1]!, match[2]!.trim()]),
  );
}

function isInside(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}${sep}`);
}

function toProjectPath(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join("/");
}
