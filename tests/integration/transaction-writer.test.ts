import { mkdir, readdir, readFile, symlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ChangePlan } from "../../src/domain/change-plan.js";
import {
  NodeFileSystem,
  type FileKind,
  type FileSystem,
} from "../../src/infrastructure/filesystem.js";
import { sha256 } from "../../src/infrastructure/hashing.js";
import { applyChangePlan } from "../../src/services/transaction-writer.js";
import { renderTemplate, type RenderedTemplate } from "../../src/services/template-registry.js";
import { createTempProject, type TempProject } from "../helpers/temp-project.js";

const projects: TempProject[] = [];

afterEach(async () => {
  await Promise.all(projects.splice(0).map((project) => project.cleanup()));
});

async function project(): Promise<TempProject> {
  const value = await createTempProject();
  projects.push(value);
  return value;
}

describe("applyChangePlan", () => {
  it("creates files and merges AGENTS.md without replacing user content", async () => {
    const target = await project();
    await target.write("AGENTS.md", "# User rules\n\nKeep me.\n");
    const templates = [renderTemplate("core-agents", {}), renderTemplate("product-brief", {})];
    const plan: ChangePlan = {
      applicable: true,
      actions: [
        { kind: "merge", path: "AGENTS.md", strategy: "managed-block" },
        { kind: "create", path: "docs/product/brief.md" },
      ],
    };

    const result = await applyChangePlan(target.root, plan, templates);

    expect(result.written).toEqual(["AGENTS.md", "docs/product/brief.md"]);
    expect(await readFile(target.path("AGENTS.md"), "utf8")).toContain("# User rules");
    expect(await readFile(target.path("AGENTS.md"), "utf8")).toContain("<!-- ADF:START -->");
    expect(await readFile(target.path("docs/product/brief.md"), "utf8")).toContain(
      "# Project Brief",
    );
    expect(await transactionDirectories(target.root)).toEqual([]);
  });

  it("restores original bytes after an injected rename failure", async () => {
    const target = await project();
    await target.write("first.txt", "original-first");
    await target.write("second.txt", "original-second");
    const templates = [template("first.txt", "new-first"), template("second.txt", "new-second")];
    const plan: ChangePlan = {
      applicable: true,
      actions: [
        { kind: "merge", path: "first.txt", strategy: "replace-if-unmodified" },
        { kind: "merge", path: "second.txt", strategy: "replace-if-unmodified" },
      ],
    };

    await expect(
      applyChangePlan(target.root, plan, templates, {
        fileSystem: new FailOnRenameFileSystem(3),
      }),
    ).rejects.toThrow("Injected rename failure");

    expect(await readFile(target.path("first.txt"), "utf8")).toBe("original-first");
    expect(await readFile(target.path("second.txt"), "utf8")).toBe("original-second");
    expect(await transactionDirectories(target.root)).toEqual([]);
  });

  it("performs zero writes for a conflict plan", async () => {
    const target = await project();
    await target.write("existing.txt", "untouched");
    const before = await readFile(target.path("existing.txt"));
    const plan: ChangePlan = {
      applicable: false,
      actions: [{ kind: "conflict", path: "existing.txt", reason: "User owned" }],
    };

    await expect(applyChangePlan(target.root, plan, [])).rejects.toThrow(/not applicable/i);

    expect(await readFile(target.path("existing.txt"))).toEqual(before);
    expect(await transactionDirectories(target.root)).toEqual([]);
  });

  it("rejects a target path that escapes the project", async () => {
    const target = await project();
    const plan = {
      applicable: true,
      actions: [{ kind: "create", path: "../escape.txt" }],
    } as ChangePlan;

    await expect(
      applyChangePlan(target.root, plan, [template("../escape.txt", "bad")]),
    ).rejects.toThrow(/relative path|outside project root/i);
  });

  it("never follows an existing symlink while writing", async () => {
    const target = await project();
    const outside = await project();
    const link = target.path("linked");
    await mkdir(dirname(link), { recursive: true });
    await symlink(outside.root, link);
    const plan: ChangePlan = {
      applicable: true,
      actions: [{ kind: "create", path: "linked/escape.md" }],
    };

    await expect(
      applyChangePlan(target.root, plan, [template("linked/escape.md", "blocked")]),
    ).rejects.toThrow(/symlink/i);

    await expect(readFile(join(outside.root, "escape.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await transactionDirectories(target.root)).toEqual([]);
  });
});

function template(path: string, content: string): RenderedTemplate {
  return {
    id: `fixture-${path}`,
    targetPath: path,
    strategy: "replace-if-unmodified",
    version: "0.1.0",
    sha256: sha256(content),
    variables: [],
    content,
    renderedSha256: sha256(content),
  };
}

async function transactionDirectories(targetRoot: string): Promise<string[]> {
  const prefix = `.adf-transaction-${basename(targetRoot)}-`;
  return (await readdir(dirname(targetRoot))).filter((entry) => entry.startsWith(prefix));
}

class FailOnRenameFileSystem implements FileSystem {
  readonly #delegate = new NodeFileSystem();
  #renameCount = 0;

  constructor(readonly failAt: number) {}

  read(path: string): Promise<Buffer> {
    return this.#delegate.read(path);
  }

  write(path: string, content: Uint8Array): Promise<void> {
    return this.#delegate.write(path, content);
  }

  exists(path: string): Promise<boolean> {
    return this.#delegate.exists(path);
  }

  stat(path: string): Promise<FileKind> {
    return this.#delegate.stat(path);
  }

  async rename(from: string, to: string): Promise<void> {
    this.#renameCount += 1;
    if (this.#renameCount === this.failAt) throw new Error("Injected rename failure");
    await this.#delegate.rename(from, to);
  }

  mkdir(path: string): Promise<void> {
    return this.#delegate.mkdir(path);
  }

  remove(path: string): Promise<void> {
    return this.#delegate.remove(path);
  }
}
