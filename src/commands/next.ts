import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readState } from "../services/harness-reader.js";

export type NextResult = { action: string; exitCode: 0 | 1 };

export async function runNext(root: string): Promise<NextResult> {
  try {
    const { state } = await readState(root);
    const handoff = await readFile(resolve(root, ".harness/HANDOFF.md"), "utf8");
    if (!/No active handoff\./i.test(handoff)) {
      return { action: "Continúa el proyecto.", exitCode: 0 };
    }
    if (state.lifecycle === "intake" || state.lifecycle === "bootstrap") {
      return { action: "Inicia el proyecto.", exitCode: 0 };
    }
    if (
      state.activeFeature === null &&
      (state.lifecycle === "project-ready" || state.lifecycle === "feature-selection")
    ) {
      return { action: "Selecciona la primera feature.", exitCode: 0 };
    }
    return { action: state.nextAction.prompt, exitCode: 0 };
  } catch {
    return { action: "Ejecuta `adf doctor` y repara el estado del harness.", exitCode: 1 };
  }
}
