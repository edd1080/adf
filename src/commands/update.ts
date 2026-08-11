import { parse } from "yaml";

import type { ChangePlan } from "../domain/change-plan.js";
import { ManifestSchema } from "../domain/manifest.js";
import { composeHarnessTemplates, type HarnessComposition } from "../services/harness-composer.js";
import { readManifest } from "../services/harness-reader.js";
import { inspectProject } from "../services/project-inspector.js";
import { applyChangePlan } from "../services/transaction-writer.js";
import { planHarnessUpdate } from "../services/updater.js";

export type UpdateResult = {
  status: "up-to-date" | "updates-available" | "updated" | "conflict";
  exitCode: 0 | 3;
  plan: ChangePlan;
  orphaned: string[];
  written: readonly string[];
};

export async function runUpdate(
  options: { root: string; check?: boolean },
  dependencies: { source?: HarnessComposition } = {},
): Promise<UpdateResult> {
  const { manifest, raw } = await readManifest(options.root);
  const rawManifest = parse(raw) as { framework?: { installedAt?: string } };
  const source =
    dependencies.source ??
    composeHarnessTemplates({
      frameworkVersion: "0.1.0",
      installedAt: rawManifest.framework?.installedAt ?? new Date().toISOString(),
      specKitVersion: manifest.specKit.version,
      defaultIntegration: manifest.specKit.defaultIntegration,
      installedIntegrations: manifest.specKit.installedIntegrations,
    });
  const inspection = await inspectProject(options.root);
  const update = await planHarnessUpdate(
    options.root,
    inspection,
    ManifestSchema.parse(manifest),
    source,
  );

  if (!update.plan.applicable) {
    return {
      status: "conflict",
      exitCode: 3,
      plan: update.plan,
      orphaned: update.orphaned,
      written: [],
    };
  }
  const hasChanges = update.plan.actions.some(
    (action) => action.kind === "create" || action.kind === "merge",
  );
  if (!hasChanges) {
    return {
      status: "up-to-date",
      exitCode: 0,
      plan: update.plan,
      orphaned: update.orphaned,
      written: [],
    };
  }
  if (options.check) {
    return {
      status: "updates-available",
      exitCode: 0,
      plan: update.plan,
      orphaned: update.orphaned,
      written: [],
    };
  }
  const applied = await applyChangePlan(options.root, update.plan, update.templates);
  return {
    status: "updated",
    exitCode: 0,
    plan: update.plan,
    orphaned: update.orphaned,
    written: applied.written,
  };
}
