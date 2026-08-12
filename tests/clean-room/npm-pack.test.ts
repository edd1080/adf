import { fileURLToPath } from "node:url";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

type PackResult = Array<{ files: Array<{ path: string }> }>;

describe("npm package boundary", () => {
  it("contains every runtime asset and excludes development or local state", async () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const cache = await mkdtemp(join(tmpdir(), "adf-npm-cache-"));
    await execa("npm", ["run", "build"], { cwd: root });
    const result = await execa("npm", ["pack", "--json", "--dry-run"], {
      cwd: root,
      env: { npm_config_cache: cache },
    });
    await rm(cache, { recursive: true, force: true });
    const packed = JSON.parse(result.stdout) as PackResult;
    const paths = packed[0]?.files.map((file) => file.path) ?? [];

    expect(paths).toContain("dist/cli.js");
    expect(paths).toContain("templates/core/AGENTS.md.hbs");
    expect(paths).toContain("templates/skills/core/project-intake/SKILL.md");
    expect(paths).toContain("templates/skills/vendor/grilling/SKILL.md");
    expect(paths).toContain("templates/spec-kit/workflow/workflow.yml");
    expect(paths).toContain("schemas/manifest.schema.json");
    expect(paths).toContain("README.md");
    expect(paths).toContain("LICENSE");
    expect(paths).toContain("THIRD_PARTY_NOTICES.md");
    expect(paths.some((path) => path.startsWith("tests/"))).toBe(false);
    expect(paths.some((path) => path.startsWith(".git/"))).toBe(false);
    expect(paths.some((path) => path.startsWith(".harness/"))).toBe(false);
    expect(paths.some((path) => path.includes(".env"))).toBe(false);
  }, 120_000);

  it("runs both names through the symlink shape used by npm bin shims", async () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const binDirectory = await mkdtemp(join(tmpdir(), "adf-bin-"));
    await execa("npm", ["run", "build"], { cwd: root });
    for (const binary of ["adf-harness-kit", "adf"]) {
      const bin = join(binDirectory, binary);
      await symlink(resolve(root, "dist/cli.js"), bin);
      const result = await execa("node", [bin, "--version"]);
      expect(result.stdout).toBe("0.1.0");
    }
    await rm(binDirectory, { recursive: true, force: true });
  });

  it.runIf(process.env.ADF_RELEASE_NETWORK === "1")(
    "installs the tarball and executes both public npm shims",
    async () => {
      const root = fileURLToPath(new URL("../../", import.meta.url));
      const packageDirectory = await mkdtemp(join(tmpdir(), "adf-package-"));
      const installDirectory = await mkdtemp(join(tmpdir(), "adf-install-"));
      const cacheDirectory = await mkdtemp(join(tmpdir(), "adf-release-cache-"));
      const env = { npm_config_cache: cacheDirectory };
      await execa("npm", ["run", "build"], { cwd: root });
      const packed = await execa(
        "npm",
        ["pack", "--json", "--ignore-scripts", "--pack-destination", packageDirectory],
        { cwd: root, env },
      );
      const packResult = JSON.parse(packed.stdout) as Array<{ filename: string }>;
      const tarball = join(packageDirectory, packResult[0]?.filename ?? "missing.tgz");

      await execa(
        "npm",
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--no-package-lock",
          "--prefix",
          installDirectory,
          tarball,
        ],
        { cwd: root, env },
      );

      for (const binary of ["adf-harness-kit", "adf"]) {
        const result = await execa(join(installDirectory, "node_modules/.bin", binary), [
          "--version",
        ]);
        expect(result.stdout).toBe("0.1.0");
      }

      await rm(packageDirectory, { recursive: true, force: true });
      await rm(installDirectory, { recursive: true, force: true });
      await rm(cacheDirectory, { recursive: true, force: true });
    },
    120_000,
  );
});
