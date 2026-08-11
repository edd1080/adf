import type { SpecKitIntegration } from "./spec-kit-adapter.js";

export type OnboardingAnswers = {
  target: string;
  defaultAgent: SpecKitIntegration;
  installAdditionalAgent: boolean;
  documentationPath?: string;
};

export type OnboardingConfig = {
  target: string;
  defaultAgent: SpecKitIntegration;
  integrations: SpecKitIntegration[];
  documentationPath?: string;
};

export function createOnboardingConfig(answers: OnboardingAnswers | null): OnboardingConfig | null {
  if (answers === null) return null;
  const target = answers.target.trim();
  if (target === "") return null;

  const additionalAgent: SpecKitIntegration =
    answers.defaultAgent === "codex" ? "opencode" : "codex";
  const documentationPath = answers.documentationPath?.trim();

  return {
    target,
    defaultAgent: answers.defaultAgent,
    integrations: answers.installAdditionalAgent
      ? [answers.defaultAgent, additionalAgent]
      : [answers.defaultAgent],
    ...(documentationPath === undefined || documentationPath === "" ? {} : { documentationPath }),
  };
}

export function buildFirstProjectPrompt(documentationPath?: string): string {
  if (documentationPath === undefined || documentationPath.trim() === "") {
    return "Inicia el proyecto.";
  }
  return [
    "Inicia el proyecto.",
    "",
    `La documentación preparada durante discovery está en ${documentationPath.trim()}.`,
    "Inspecciónala antes de preguntarme cualquier cosa.",
    "Preserva las fuentes originales y propón únicamente la normalización y los gaps necesarios para llegar a G1.",
  ].join("\n");
}

export function validateDocumentationPath(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? "Enter the documentation path." : undefined;
}

export function buildInitSummary(status: string, nextAction: string): string {
  return `\nStatus: ${status}${status === "installed" ? `\nNext: ${nextAction}` : ""}\n`;
}
