import { describe, expect, it } from "vitest";

import {
  getAgentAdapter,
  getAgentAdapterFiles,
  mergeOpenCodeConfig,
} from "../../src/services/agent-adapters.js";

describe("agent adapters", () => {
  it("shares AGENTS.md and one skill root across Codex and OpenCode", () => {
    const codex = getAgentAdapter("codex");
    const opencode = getAgentAdapter("opencode");

    expect(codex.contextPath).toBe("AGENTS.md");
    expect(opencode.contextPath).toBe("AGENTS.md");
    expect(codex.skillRoot).toBe(".agents/skills");
    expect(opencode.skillRoot).toBe(".agents/skills");
    expect(opencode.specKitIntegration).toBe("opencode");
    expect(codex.specKitIntegration).toBe("codex");
  });

  it("emits no duplicate OpenCode skills and no speculative Codex config", () => {
    const paths = [...getAgentAdapterFiles("codex"), ...getAgentAdapterFiles("opencode")].map(
      (file) => file.targetPath,
    );

    expect(paths.some((path) => path.startsWith(".opencode/skills/"))).toBe(false);
    expect(paths).not.toContain(".codex/config.toml");
    expect(paths).toContain("opencode.json");
    expect(paths).toContain(".opencode/agents/reviewer.md");
    expect(paths).toContain(".opencode/agents/debugger.md");
  });

  it("asks before edits and risky shell operations while allowing skill discovery", () => {
    const configFile = getAgentAdapterFiles("opencode").find(
      (file) => file.targetPath === "opencode.json",
    );
    const config = JSON.parse(configFile?.content ?? "") as {
      $schema: string;
      permission: {
        edit: string;
        skill: Record<string, string>;
        bash: Record<string, string>;
      };
    };

    expect(config.$schema).toBe("https://opencode.ai/config.json");
    expect(config.permission.edit).toBe("ask");
    expect(config.permission.skill["*"]).toBe("allow");
    expect(config.permission.bash["*"]).toBe("ask");
    for (const pattern of [
      "git push*",
      "npm publish*",
      "vercel deploy*",
      "docker push*",
      "kubectl apply*",
      "terraform apply*",
    ]) {
      expect(config.permission.bash[pattern]).toBe("ask");
    }
  });

  it("keeps the OpenCode reviewer read-only", () => {
    const reviewer = getAgentAdapterFiles("opencode").find(
      (file) => file.targetPath === ".opencode/agents/reviewer.md",
    );

    expect(reviewer?.content).toMatch(/mode: subagent/);
    expect(reviewer?.content).toMatch(/edit: deny/);
    expect(reviewer?.content).toMatch(/external_directory: deny/);
    expect(reviewer?.content).toContain("Writes: none");
  });

  it("merges managed OpenCode keys without mutating unrelated user config", () => {
    const existing = {
      model: "openai/gpt-5",
      provider: { openai: { options: { reasoningEffort: "high" } } },
      permission: { websearch: "allow", bash: { "custom-safe *": "allow" } },
      agent: { product: { mode: "subagent", description: "User-owned" } },
    };

    const merged = mergeOpenCodeConfig(existing);

    expect(merged).not.toBe(existing);
    expect(merged).toEqual(
      expect.objectContaining({
        model: "openai/gpt-5",
        provider: existing.provider,
        agent: existing.agent,
      }),
    );
    expect(merged.permission).toEqual(
      expect.objectContaining({ websearch: "allow", edit: "ask", skill: { "*": "allow" } }),
    );
    expect(merged.permission.bash).toEqual(
      expect.objectContaining({ "custom-safe *": "allow", "git push*": "ask" }),
    );
    expect(existing).not.toHaveProperty("$schema");
  });
});
