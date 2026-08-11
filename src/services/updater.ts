import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ChangePlan } from "../domain/change-plan.js";
import type { Manifest } from "../domain/manifest.js";
import { sha256 } from "../infrastructure/hashing.js";
import { planChanges } from "./change-planner.js";
import {
  isUpdatableTemplate,
  refreshCompositionManifest,
  type HarnessComposition,
} from "./harness-composer.js";
import type { ProjectInspection } from "./project-inspector.js";

export type UpdatePlan = {
  plan: ChangePlan;
  templates: HarnessComposition["templates"];
  orphaned: string[];
};

export async function planHarnessUpdate(
  root: string,
  inspection: ProjectInspection,
  installed: Manifest,
  source: HarnessComposition,
): Promise<UpdatePlan> {
  const refreshed = refreshCompositionManifest(source);
  const sourceTemplates = refreshed.templates.filter(
    (template) => isUpdatableTemplate(template) || template.targetPath === ".harness/manifest.yml",
  );
  const sourcePaths = new Set(
    sourceTemplates.filter(isUpdatableTemplate).map((template) => template.targetPath),
  );
  const orphaned = installed.managedFiles
    .map((file) => file.path)
    .filter((path) => !sourcePaths.has(path))
    .sort();
  const manifestHash = sha256(await readFile(resolve(root, ".harness/manifest.yml")));
  const installedForPlan: Manifest = {
    ...installed,
    managedFiles: [
      ...installed.managedFiles,
      {
        path: ".harness/manifest.yml",
        strategy: "replace-if-unmodified",
        installedSha256: manifestHash,
      },
    ],
  };

  return {
    plan: planChanges(inspection, sourceTemplates, installedForPlan),
    templates: sourceTemplates,
    orphaned,
  };
}
