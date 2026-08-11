import { readState } from "../services/harness-reader.js";

export type StatusResult = {
  lifecycle: string;
  currentGate: string;
  activeFeature: string | null;
  blockers: string[];
  lastSession: string | null;
  exitCode: 0 | 1;
};

export async function runStatus(root: string): Promise<StatusResult> {
  try {
    const document = await readState(root);
    return {
      lifecycle: document.state.lifecycle,
      currentGate: document.state.currentGate,
      activeFeature: document.state.activeFeature,
      blockers: extractBlockers(document.body),
      lastSession: document.body.match(/^Last session:\s*(.+)$/m)?.[1]?.trim() ?? null,
      exitCode: 0,
    };
  } catch {
    return {
      lifecycle: "unknown",
      currentGate: "unknown",
      activeFeature: null,
      blockers: ["Harness state is invalid or missing."],
      lastSession: null,
      exitCode: 1,
    };
  }
}

function extractBlockers(body: string): string[] {
  const section = body.match(/## Blockers\s*\n([\s\S]*?)(?:\n## |$)/)?.[1]?.trim();
  if (section === undefined || /^(?:none|ninguno)/i.test(section)) return [];
  return section
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}
