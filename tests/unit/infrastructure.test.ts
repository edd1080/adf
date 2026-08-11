import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FixedClock } from "../../src/infrastructure/clock.js";
import { NodeFileSystem, resolveInsideRoot } from "../../src/infrastructure/filesystem.js";
import { sha256 } from "../../src/infrastructure/hashing.js";
import { SystemProcessRunner } from "../../src/infrastructure/process-runner.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("sha256", () => {
  it("returns a deterministic lowercase digest", () => {
    expect(sha256("adf")).toBe("8e3923723d8b83e7f8c2d00c57c3f00e43c67d7be0bcd9bded3b13c3129ba6f2");
  });
});

describe("FixedClock", () => {
  it("returns the injected instant", () => {
    const instant = new Date("2026-08-11T12:00:00.000Z");

    expect(new FixedClock(instant).now()).toEqual(instant);
  });
});

describe("SystemProcessRunner", () => {
  it("captures stdout, stderr, and a non-zero exit code", async () => {
    const result = await new SystemProcessRunner().run(process.execPath, [
      "-e",
      "process.stdout.write('ok'); process.stderr.write('warning'); process.exitCode = 7;",
    ]);

    expect(result).toEqual({ exitCode: 7, stdout: "ok", stderr: "warning" });
  });
});

describe("NodeFileSystem", () => {
  it("writes and atomically renames bytes through its public interface", async () => {
    const root = await mkdtemp(join(tmpdir(), "adf-infra-"));
    tempRoots.push(root);
    const fs = new NodeFileSystem();
    const staged = join(root, "staged.txt");
    const target = join(root, "target.txt");

    await fs.write(staged, Buffer.from("ready"));
    await fs.rename(staged, target);

    expect(await fs.exists(staged)).toBe(false);
    expect((await fs.read(target)).toString("utf8")).toBe("ready");
    expect(await fs.stat(target)).toBe("file");
  });
});

describe("resolveInsideRoot", () => {
  it("resolves a safe relative path", () => {
    expect(resolveInsideRoot("/workspace/project", ".harness/STATE.md")).toBe(
      "/workspace/project/.harness/STATE.md",
    );
  });

  it("rejects a path that escapes the root", () => {
    expect(() => resolveInsideRoot("/workspace/project", "../secret")).toThrow(
      /outside project root/i,
    );
  });
});
