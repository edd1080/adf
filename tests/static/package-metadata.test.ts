import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("public npm package metadata", () => {
  it("publishes both the friendly and operational binaries", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      name: string;
      private?: boolean;
      publishConfig?: { access?: string };
      bin: Record<string, string>;
      repository?: { type: string; url: string };
    };

    expect(packageJson.name).toBe("adf-harness-kit");
    expect(packageJson.private).not.toBe(true);
    expect(packageJson.publishConfig?.access).toBe("public");
    expect(packageJson.bin).toEqual({
      "adf-harness-kit": "dist/cli.js",
      adf: "dist/cli.js",
    });
    expect(packageJson.repository?.url).toContain("github.com/edd1080/adf.git");
  });
});
