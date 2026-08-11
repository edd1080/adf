import { mkdtemp, rm } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";

import { SafeRelativePath, type ChangePlan, type FileAction } from "../domain/change-plan.js";
import {
  NodeFileSystem,
  resolveInsideRoot,
  type FileSystem,
} from "../infrastructure/filesystem.js";
import type { RenderedTemplate } from "./template-registry.js";

const ADF_START = "<!-- ADF:START -->";
const ADF_END = "<!-- ADF:END -->";

export type TransactionResult = {
  written: string[];
};

type TransactionDependencies = {
  fileSystem?: FileSystem;
};

type PreparedChange = {
  action: Extract<FileAction, { kind: "create" | "merge" }>;
  targetPath: string;
  stagedPath: string;
  backupPath: string;
  targetExisted: boolean;
};

type AppliedChange = PreparedChange & {
  backupMoved: boolean;
  targetWritten: boolean;
};

export async function applyChangePlan(
  root: string,
  plan: ChangePlan,
  templates: readonly RenderedTemplate[],
  dependencies: TransactionDependencies = {},
): Promise<TransactionResult> {
  if (!plan.applicable || plan.actions.some((action) => action.kind === "conflict")) {
    throw new Error("Change plan is not applicable because it contains conflicts");
  }

  const resolvedRoot = resolve(root);
  const fileSystem = dependencies.fileSystem ?? new NodeFileSystem();
  const templateByPath = new Map(templates.map((template) => [template.targetPath, template]));
  validateMutations(plan, templateByPath);
  const stagingRoot = await mkdtemp(
    join(dirname(resolvedRoot), `.adf-transaction-${basename(resolvedRoot)}-`),
  );
  const applied: AppliedChange[] = [];

  try {
    const prepared = await prepareChanges(
      resolvedRoot,
      stagingRoot,
      plan,
      templateByPath,
      fileSystem,
    );

    for (const change of prepared) {
      const record: AppliedChange = { ...change, backupMoved: false, targetWritten: false };
      applied.push(record);

      if (change.targetExisted) {
        await fileSystem.rename(change.targetPath, change.backupPath);
        record.backupMoved = true;
      }

      await fileSystem.rename(change.stagedPath, change.targetPath);
      record.targetWritten = true;
    }

    return { written: prepared.map((change) => change.action.path) };
  } catch (error) {
    const rollbackErrors = await rollback(applied, fileSystem);
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Transaction failed and rollback was incomplete",
        { cause: error },
      );
    }
    throw error;
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

function validateMutations(
  plan: ChangePlan,
  templateByPath: ReadonlyMap<string, RenderedTemplate>,
): void {
  for (const action of plan.actions) {
    SafeRelativePath.parse(action.path);
    if ((action.kind === "create" || action.kind === "merge") && !templateByPath.has(action.path)) {
      throw new Error(`No rendered template for ${action.path}`);
    }
  }
}

async function prepareChanges(
  root: string,
  stagingRoot: string,
  plan: ChangePlan,
  templateByPath: ReadonlyMap<string, RenderedTemplate>,
  fileSystem: FileSystem,
): Promise<PreparedChange[]> {
  const prepared: PreparedChange[] = [];

  for (const action of plan.actions) {
    if (action.kind !== "create" && action.kind !== "merge") continue;
    const template = templateByPath.get(action.path)!;
    const targetPath = resolveInsideRoot(root, action.path);
    await assertNoSymlink(root, action.path, fileSystem);
    const targetExisted = await fileSystem.exists(targetPath);

    if (action.kind === "create" && targetExisted) {
      throw new Error(`Create precondition failed because target exists: ${action.path}`);
    }
    if (action.kind === "merge" && !targetExisted) {
      throw new Error(`Merge precondition failed because target is missing: ${action.path}`);
    }

    const content = await renderMutationContent(action, template, targetPath, fileSystem);
    const stagedPath = resolveInsideRoot(stagingRoot, `staged/${action.path}`);
    const backupPath = resolveInsideRoot(stagingRoot, `backups/${action.path}`);
    await fileSystem.write(stagedPath, Buffer.from(content));
    prepared.push({ action, targetPath, stagedPath, backupPath, targetExisted });
  }

  return prepared;
}

async function renderMutationContent(
  action: Extract<FileAction, { kind: "create" | "merge" }>,
  template: RenderedTemplate,
  targetPath: string,
  fileSystem: FileSystem,
): Promise<string> {
  if (action.kind === "create" && template.strategy === "merge-markers") {
    return `${ADF_START}\n${template.content.trimEnd()}\n${ADF_END}\n`;
  }
  if (action.kind === "merge" && action.strategy === "managed-block") {
    return mergeManagedBlock(
      (await fileSystem.read(targetPath)).toString("utf8"),
      template.content,
    );
  }
  if (action.kind === "merge" && action.strategy === "merge-json") {
    return mergeJsonDocuments(
      (await fileSystem.read(targetPath)).toString("utf8"),
      template.content,
    );
  }
  return template.content;
}

async function rollback(
  changes: readonly AppliedChange[],
  fileSystem: FileSystem,
): Promise<Error[]> {
  const errors: Error[] = [];
  for (const change of [...changes].reverse()) {
    try {
      if (change.targetWritten && (await fileSystem.exists(change.targetPath))) {
        await fileSystem.remove(change.targetPath);
      }
      if (change.backupMoved) {
        await fileSystem.rename(change.backupPath, change.targetPath);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }
  return errors;
}

async function assertNoSymlink(
  root: string,
  relativePath: string,
  fileSystem: FileSystem,
): Promise<void> {
  let current = resolve(root);
  for (const segment of relativePath.split("/")) {
    current = resolve(current, segment);
    if (!(await fileSystem.exists(current))) continue;
    if ((await fileSystem.stat(current)) === "symlink") {
      throw new Error(`Refusing to write through symlink: ${relativePath}`);
    }
  }

  const normalizedRoot = resolve(root);
  if (current !== normalizedRoot && !current.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(`Resolved path is outside project root: ${relativePath}`);
  }
}

function mergeManagedBlock(existing: string, managedContent: string): string {
  const block = `${ADF_START}\n${managedContent.trimEnd()}\n${ADF_END}`;
  const start = existing.indexOf(ADF_START);
  const end = existing.indexOf(ADF_END);

  if ((start === -1) !== (end === -1)) {
    throw new Error("Existing managed block markers are incomplete");
  }
  if (start === -1) {
    return `${existing.trimEnd()}\n\n${block}\n`;
  }
  if (end < start) throw new Error("Existing managed block markers are out of order");

  return `${existing.slice(0, start)}${block}${existing.slice(end + ADF_END.length)}`;
}

function mergeJsonDocuments(existing: string, managed: string): string {
  const existingValue = JSON.parse(existing) as unknown;
  const managedValue = JSON.parse(managed) as unknown;
  if (!isRecord(existingValue) || !isRecord(managedValue)) {
    throw new Error("JSON merge requires two objects");
  }
  return `${JSON.stringify(deepMerge(existingValue, managedValue), null, 2)}\n`;
}

function deepMerge(existing: Record<string, unknown>, managed: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(managed)) {
    result[key] =
      isRecord(value) && isRecord(existing[key]) ? deepMerge(existing[key], value) : value;
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
