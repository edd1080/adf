import { z } from "zod";

export const SafeRelativePath = z
  .string()
  .min(1)
  .refine(
    (value) => {
      if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) {
        return false;
      }

      return value
        .split("/")
        .every((segment) => segment !== "" && segment !== "." && segment !== "..");
    },
    { message: "Expected a safe relative path inside the project root" },
  );

export const FileActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create"), path: SafeRelativePath }),
  z.object({ kind: z.literal("preserve"), path: SafeRelativePath, reason: z.string().min(1) }),
  z.object({ kind: z.literal("merge"), path: SafeRelativePath, strategy: z.string().min(1) }),
  z.object({ kind: z.literal("conflict"), path: SafeRelativePath, reason: z.string().min(1) }),
  z.object({ kind: z.literal("noop"), path: SafeRelativePath }),
]);

export const ChangePlanSchema = z.object({
  applicable: z.boolean(),
  actions: z.array(FileActionSchema),
});

export type FileAction = z.infer<typeof FileActionSchema>;
export type ChangePlan = z.infer<typeof ChangePlanSchema>;
