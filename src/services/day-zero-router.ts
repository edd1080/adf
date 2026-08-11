import type { ProjectInspection } from "./project-inspector.js";

export type DayZeroAssessment = {
  documentation: "none" | "partial" | "complete";
  path: "guided-interview" | "gap-completion" | "consistency-audit" | "brownfield-observation";
  skill: "project-intake";
  currentGate: "G1";
  nextPrompt: "Inicia el proyecto.";
  implementationAllowed: false;
  missingRequiredDocuments: string[];
  questions: string[];
};

const REQUIRED_DOCUMENTS = [
  "docs/product/brief.md",
  "docs/product/prd.md",
  ".specify/memory/constitution.md",
  "docs/references/index.md",
] as const;

export function assessDayZero(inspection: ProjectInspection): DayZeroAssessment {
  const present = new Set([
    ...inspection.documents.map((document) => document.path),
    ...inspection.files.map((file) => file.path),
  ]);
  const missingRequiredDocuments = REQUIRED_DOCUMENTS.filter((path) => !present.has(path));
  const requiredPresent = REQUIRED_DOCUMENTS.length - missingRequiredDocuments.length;
  const documentation =
    requiredPresent === 0 ? "none" : missingRequiredDocuments.length === 0 ? "complete" : "partial";
  const path =
    inspection.kind === "brownfield"
      ? "brownfield-observation"
      : documentation === "none"
        ? "guided-interview"
        : documentation === "partial"
          ? "gap-completion"
          : "consistency-audit";

  return {
    documentation,
    path,
    skill: "project-intake",
    currentGate: "G1",
    nextPrompt: "Inicia el proyecto.",
    implementationAllowed: false,
    missingRequiredDocuments,
    questions: questionsFor(path, missingRequiredDocuments),
  };
}

function questionsFor(path: DayZeroAssessment["path"], missing: readonly string[]): string[] {
  const conditional =
    "¿Existen roles, flujos de usuario, restricciones de UX/UI, datos, integraciones, seguridad o referencias que deban documentarse?";
  switch (path) {
    case "guided-interview":
      return [
        "¿Qué problema resuelve el proyecto, para quién y qué resultado debe producir?",
        "¿Qué alcance, restricciones, decisiones previas y fuentes de contexto ya existen?",
        conditional,
      ];
    case "gap-completion":
      return [
        `¿Quién puede completar o aprobar estos documentos faltantes: ${missing.join(", ")}?`,
        "¿Qué partes de la documentación actual son hechos aprobados, propuestas o están obsoletas?",
        conditional,
      ];
    case "consistency-audit":
      return [
        "¿La documentación sigue vigente y quién tiene autoridad para aprobar G1?",
        "¿Existen contradicciones, decisiones abiertas o supuestos que bloqueen una primera feature?",
        conditional,
      ];
    case "brownfield-observation":
      return [
        "¿Qué comportamiento existente, interfaces y restricciones no deben cambiar?",
        "¿Qué fuentes describen requisitos aprobados y qué puede inferirse solo como observación del código?",
        conditional,
      ];
  }
}
