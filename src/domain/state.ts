import { z } from "zod";

const GateSchema = z.enum(["G0", "G1", "G2", "G3", "G4", "G5", "G6"]);
const LifecycleSchema = z.enum([
  "bootstrap",
  "intake",
  "project-ready",
  "feature-selection",
  "specification",
  "planning",
  "implementation",
  "verification",
  "closed",
  "blocked",
]);

const PRE_FEATURE_LIFECYCLES = new Set([
  "bootstrap",
  "intake",
  "project-ready",
  "feature-selection",
]);

export const StateSchema = z
  .object({
    schemaVersion: z.literal(1),
    lifecycle: LifecycleSchema,
    currentGate: GateSchema,
    activeFeature: z.string().min(1).nullable(),
    approvals: z.object({
      G1: z.boolean(),
      G2: z.boolean(),
      G3: z.boolean(),
    }),
    nextAction: z.object({
      command: z.string().min(1).optional(),
      prompt: z.string().min(1),
    }),
  })
  .superRefine((state, context) => {
    if (["G4", "G5", "G6"].includes(state.currentGate)) {
      const allPlanningGatesApproved =
        state.approvals.G1 && state.approvals.G2 && state.approvals.G3;
      if (!allPlanningGatesApproved) {
        context.addIssue({
          code: "custom",
          path: ["approvals"],
          message: "G1, G2 and G3 must be approved before entering G4 or later",
        });
      }
    }

    if (PRE_FEATURE_LIFECYCLES.has(state.lifecycle) && state.activeFeature !== null) {
      context.addIssue({
        code: "custom",
        path: ["activeFeature"],
        message: "An active feature is not allowed before feature specification",
      });
    }

    if (
      ["specification", "planning", "implementation", "verification"].includes(state.lifecycle) &&
      state.activeFeature === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["activeFeature"],
        message: "An active feature is required for this lifecycle",
      });
    }
  });

export type ProjectState = z.infer<typeof StateSchema>;
