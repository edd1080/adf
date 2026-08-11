import { z } from "zod";

export const DiagnosticSchema = z.object({
  severity: z.enum(["info", "warning", "error"]),
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  message: z.string().min(1),
  remediation: z.string().min(1).optional(),
});

export type Diagnostic = z.infer<typeof DiagnosticSchema>;
