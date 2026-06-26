import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const evalItemSchema = z.object({
  id: z.string().min(1),
  area: z.string().min(1),
  priority: z.enum(["blocker", "high", "medium", "low"]),
  requirementRefs: z.array(z.string()).min(1),
  grader: z.object({
    type: z.string().min(1),
  }),
  automationLayer: z.string().min(1),
  scenario: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  expected: z.array(z.string()).min(1),
  passCriteria: z.array(z.string()).min(1),
});

const evalManifestSchema = z.object({
  metadata: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
  evals: z.array(evalItemSchema).min(1),
});

describe("eval manifest", () => {
  it("has unique IDs and includes hardening evals for known release discrepancies", () => {
    const repoRoot = join(import.meta.dirname, "..", "..");
    const manifest = evalManifestSchema.parse(
      JSON.parse(readFileSync(join(repoRoot, "docs", "evals.json"), "utf8")),
    );
    const ids = manifest.evals.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "DB-006",
        "DB-007",
        "PARSER-006",
        "MCC-019",
        "EVAL-001",
      ]),
    );
  });
});
