import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const traceabilityRequirementSchema = z.object({
  requirementId: z.string().regex(/^REQ-[A-Z]+-\d{3}$/),
  source: z.string().min(1),
  epic: z.string().min(1),
  dataRule: z.string().min(1),
  acceptanceCriteriaId: z.string().regex(/^AC-[A-Z]+-\d{3}$/),
  automatedTestIds: z.array(z.string().min(1)).min(1),
  manualEvidence: z.string().min(1),
  uiSurface: z.string().min(1),
  releaseGate: z.string().min(1),
  owner: z.string().min(1),
});

const traceabilitySchema = z.object({
  version: z.string().min(1),
  requirements: z.array(traceabilityRequirementSchema).min(1),
});

describe("traceability matrix", () => {
  it("maps every requirement to required audit fields and existing automated tests", () => {
    const repoRoot = join(import.meta.dirname, "..", "..");
    const traceabilityPath = join(repoRoot, "docs", "traceability.json");
    const traceability = traceabilitySchema.parse(
      JSON.parse(readFileSync(traceabilityPath, "utf8")),
    );

    const requirementIds = new Set<string>();

    for (const requirement of traceability.requirements) {
      expect(requirementIds.has(requirement.requirementId)).toBe(false);
      requirementIds.add(requirement.requirementId);

      for (const automatedTestId of requirement.automatedTestIds) {
        expect(existsSync(join(repoRoot, automatedTestId)), automatedTestId).toBe(true);
      }
    }

    expect(requirementIds).toEqual(
      new Set([
        "REQ-FIRE-001",
        "REQ-FIRE-002",
        "REQ-FIRE-003",
        "REQ-FIRE-004",
        "REQ-FIRE-005",
        "REQ-FIRE-006",
        "REQ-FIRE-007",
        "REQ-INGEST-001",
        "REQ-TXN-001",
        "REQ-REFUND-001",
        "REQ-MILES-001",
        "REQ-MILES-002",
        "REQ-MILES-003",
        "REQ-MCC-001",
        "REQ-UI-001",
        "REQ-UI-002",
        "REQ-UI-003",
        "REQ-DB-001",
        "REQ-DB-002",
        "REQ-SEC-001",
      ]),
    );
  });
});
