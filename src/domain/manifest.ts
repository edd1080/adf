import { z } from "zod";

import { SafeRelativePath } from "./change-plan.js";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 digest");
const IntegrationSchema = z.enum(["codex", "opencode"]);

const ManagedFileSchema = z.object({
  path: SafeRelativePath,
  strategy: z.enum(["replace-if-unmodified", "merge-markers", "merge-json", "preserve"]),
  installedSha256: Sha256Schema,
  scope: z.enum(["file", "managed-block"]).optional(),
});

const AdfSkillSchema = z.object({
  kind: z.literal("adf"),
  name: z.string().min(1),
  version: z.string().min(1),
  sha256: Sha256Schema,
});

const VendoredSkillSchema = z.object({
  kind: z.literal("vendored"),
  name: z.string().min(1),
  source: z.url(),
  upstreamCommit: z.string().min(7),
  license: z.literal("MIT"),
  originalSha256: Sha256Schema,
  adaptedSha256: Sha256Schema,
  adaptation: z.string().min(1),
});

export const ManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    framework: z.object({
      name: z.literal("adf"),
      version: z.string().min(1),
      installedAt: z.iso.datetime(),
    }),
    specKit: z.object({
      version: z.string().min(1),
      defaultIntegration: IntegrationSchema,
      installedIntegrations: z.array(IntegrationSchema).min(1),
    }),
    managedFiles: z.array(ManagedFileSchema),
    skills: z.array(z.discriminatedUnion("kind", [AdfSkillSchema, VendoredSkillSchema])),
  })
  .superRefine((manifest, context) => {
    if (!manifest.specKit.installedIntegrations.includes(manifest.specKit.defaultIntegration)) {
      context.addIssue({
        code: "custom",
        path: ["specKit", "defaultIntegration"],
        message: "The default integration must also be installed",
      });
    }

    if (
      new Set(manifest.specKit.installedIntegrations).size !==
      manifest.specKit.installedIntegrations.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["specKit", "installedIntegrations"],
        message: "Installed integrations must be unique",
      });
    }
  });

export type Manifest = z.infer<typeof ManifestSchema>;
