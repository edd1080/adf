import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type AgentAdapterName = "codex" | "opencode";

export type AgentAdapter = {
  name: AgentAdapterName;
  contextPath: "AGENTS.md";
  skillRoot: ".agents/skills";
  specKitIntegration: AgentAdapterName;
  documentationPath: string;
};

export type AgentAdapterFile = {
  sourcePath: string;
  targetPath: string;
  strategy: "merge-json" | "replace-if-unmodified";
  content: string;
};

type PermissionAction = "allow" | "ask" | "deny";

export type OpenCodeConfig = {
  $schema: string;
  permission: {
    [key: string]: unknown;
    edit: PermissionAction;
    external_directory: PermissionAction;
    skill: Record<string, PermissionAction>;
    bash: Record<string, PermissionAction>;
  };
  [key: string]: unknown;
};

const TEMPLATE_ROOT = new URL("../../templates/adapters/", import.meta.url);

const ADAPTERS: Record<AgentAdapterName, AgentAdapter> = {
  codex: {
    name: "codex",
    contextPath: "AGENTS.md",
    skillRoot: ".agents/skills",
    specKitIntegration: "codex",
    documentationPath: "templates/adapters/codex/README.md",
  },
  opencode: {
    name: "opencode",
    contextPath: "AGENTS.md",
    skillRoot: ".agents/skills",
    specKitIntegration: "opencode",
    documentationPath: "templates/adapters/opencode/README.md",
  },
};

const FILES: Record<AgentAdapterName, ReadonlyArray<Omit<AgentAdapterFile, "content">>> = {
  codex: [],
  opencode: [
    {
      sourcePath: "opencode/opencode.json.hbs",
      targetPath: "opencode.json",
      strategy: "merge-json",
    },
    {
      sourcePath: "opencode/.opencode/agents/reviewer.md.hbs",
      targetPath: ".opencode/agents/reviewer.md",
      strategy: "replace-if-unmodified",
    },
    {
      sourcePath: "opencode/.opencode/agents/debugger.md.hbs",
      targetPath: ".opencode/agents/debugger.md",
      strategy: "replace-if-unmodified",
    },
  ],
};

export function getAgentAdapter(name: AgentAdapterName): AgentAdapter {
  return { ...ADAPTERS[name] };
}

export function getAgentAdapterFiles(name: AgentAdapterName): AgentAdapterFile[] {
  return FILES[name].map((file) => ({
    ...file,
    content: readTemplate(file.sourcePath),
  }));
}

export function mergeOpenCodeConfig(existing: Record<string, unknown>): OpenCodeConfig {
  const fragment = JSON.parse(
    getAgentAdapterFiles("opencode").find((file) => file.targetPath === "opencode.json")?.content ??
      "{}",
  ) as OpenCodeConfig;
  const existingPermission = isRecord(existing.permission) ? existing.permission : {};
  const existingBash = isRecord(existingPermission.bash) ? existingPermission.bash : {};
  const managedBashKeys = new Set(Object.keys(fragment.permission.bash));
  const preservedBash: Record<string, PermissionAction> = {};
  for (const [key, value] of Object.entries(existingBash)) {
    if (!managedBashKeys.has(key) && isPermissionAction(value)) preservedBash[key] = value;
  }

  return {
    ...structuredClone(existing),
    $schema: fragment.$schema,
    permission: {
      ...structuredClone(existingPermission),
      edit: fragment.permission.edit,
      external_directory: fragment.permission.external_directory,
      skill: fragment.permission.skill,
      bash: { ...preservedBash, ...fragment.permission.bash },
    },
  };
}

function readTemplate(sourcePath: string): string {
  return readFileSync(fileURLToPath(new URL(sourcePath, TEMPLATE_ROOT)), "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPermissionAction(value: unknown): value is PermissionAction {
  return value === "allow" || value === "ask" || value === "deny";
}
