import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { parse } from "yaml";

import { ManifestSchema, type Manifest } from "../domain/manifest.js";
import { StateSchema, type ProjectState } from "../domain/state.js";

export type StateDocument = {
  state: ProjectState;
  body: string;
  raw: string;
};

export async function readManifest(root: string): Promise<{ manifest: Manifest; raw: string }> {
  const raw = await readFile(resolve(root, ".harness/manifest.yml"), "utf8");
  return { manifest: ManifestSchema.parse(parse(raw)), raw };
}

export async function readState(root: string): Promise<StateDocument> {
  const raw = await readFile(resolve(root, ".harness/STATE.md"), "utf8");
  const parsed = parseFrontmatter(raw);
  return { state: StateSchema.parse(parse(parsed.frontmatter)), body: parsed.body, raw };
}

export function parseFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content);
  if (match === null) throw new Error("Document is missing YAML frontmatter");
  return { frontmatter: match[1] ?? "", body: match[2] ?? "" };
}

export async function listMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  await walk(resolve(root, "docs"), files);
  return files.sort();
}

async function walk(directory: string, files: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path, files);
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
}

export function resolveDocumentLink(documentPath: string, link: string): string | null {
  if (/^(?:https?:|mailto:|#)/.test(link)) return null;
  const withoutAnchor = link.split("#", 1)[0] ?? "";
  if (withoutAnchor === "") return null;
  return resolve(dirname(documentPath), decodeURIComponent(withoutAnchor));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
