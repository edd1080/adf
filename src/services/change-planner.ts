import type { ChangePlan, FileAction } from "../domain/change-plan.js";
import type { Manifest } from "../domain/manifest.js";
import { sha256 } from "../infrastructure/hashing.js";
import type { ProjectInspection } from "./project-inspector.js";
import type { RenderedTemplate } from "./template-registry.js";

const ACTION_ORDER: readonly FileAction["kind"][] = [
  "create",
  "merge",
  "preserve",
  "conflict",
  "noop",
];

export function planChanges(
  inspection: ProjectInspection,
  templates: readonly RenderedTemplate[],
  installedManifest?: Manifest,
): ChangePlan {
  const existingByPath = new Map(inspection.files.map((file) => [file.path, file]));
  const managedByPath = new Map(
    (installedManifest?.managedFiles ?? []).map((file) => [file.path, file]),
  );

  const actions = [...templates]
    .sort((left, right) => left.targetPath.localeCompare(right.targetPath))
    .map<FileAction>((template) => {
      const existing = existingByPath.get(template.targetPath);
      if (existing === undefined) return { kind: "create", path: template.targetPath };
      if (existing.sha256 === template.renderedSha256) {
        return { kind: "noop", path: template.targetPath };
      }
      if (
        template.strategy === "merge-markers" &&
        existing.sha256 ===
          sha256(`<!-- ADF:START -->\n${template.content.trim()}\n<!-- ADF:END -->\n`)
      ) {
        return { kind: "noop", path: template.targetPath };
      }
      if (
        template.strategy === "merge-markers" &&
        existing.adfManagedBlockSha256 === sha256(template.content.trim())
      ) {
        return { kind: "noop", path: template.targetPath };
      }

      const managed = managedByPath.get(template.targetPath);
      if (managed !== undefined) {
        const observedInstalledSha256 =
          managed.scope === "managed-block" ? existing.adfManagedBlockSha256 : existing.sha256;
        if (observedInstalledSha256 !== managed.installedSha256) {
          return {
            kind: "conflict",
            path: template.targetPath,
            reason: "Managed file was modified after installation",
          };
        }

        return {
          kind: "merge",
          path: template.targetPath,
          strategy: template.strategy === "merge-markers" ? "managed-block" : template.strategy,
        };
      }

      if (template.strategy === "merge-markers") {
        return { kind: "merge", path: template.targetPath, strategy: "managed-block" };
      }

      if (template.strategy === "merge-json") {
        return { kind: "merge", path: template.targetPath, strategy: "merge-json" };
      }

      if (template.strategy === "preserve") {
        return {
          kind: "preserve",
          path: template.targetPath,
          reason: "Existing user-owned file",
        };
      }

      return {
        kind: "conflict",
        path: template.targetPath,
        reason: "Existing user-owned file has no safe merge strategy",
      };
    });

  return {
    applicable:
      inspection.conflicts.length === 0 && actions.every((action) => action.kind !== "conflict"),
    actions,
  };
}

export function renderChangePlanJson(plan: ChangePlan): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}

export function renderChangePlanText(plan: ChangePlan): string {
  const sections = ACTION_ORDER.flatMap((kind) => {
    const actions = plan.actions.filter((action) => action.kind === kind);
    if (actions.length === 0) return [];
    const marker = markerFor(kind);
    return [
      `${kind.toUpperCase()}\n${actions.map((action) => `  ${marker} ${action.path}`).join("\n")}`,
    ];
  });

  return `${sections.join("\n\n")}\n`;
}

function markerFor(kind: FileAction["kind"]): string {
  switch (kind) {
    case "create":
      return "+";
    case "merge":
      return "~";
    case "preserve":
      return "=";
    case "conflict":
      return "!";
    case "noop":
      return "·";
  }
}
