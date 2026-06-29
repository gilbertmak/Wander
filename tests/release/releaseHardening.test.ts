import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildReleaseHardeningReport,
  findForbiddenBrowserImports,
  type ReleaseEval,
  type ReleaseHardeningRequirement,
} from "../../src/release/releaseHardening";

const repoRoot = join(import.meta.dirname, "..", "..");

describe("Release 3 hardening", () => {
  it("confirms Release 3 requirements have evals, tests, and browser-safe UI imports", () => {
    const traceability = JSON.parse(
      readFileSync(join(repoRoot, "docs", "traceability.json"), "utf8"),
    ) as { requirements: ReleaseHardeningRequirement[] };
    const evalManifest = JSON.parse(readFileSync(join(repoRoot, "docs", "evals.json"), "utf8")) as {
      evals: ReleaseEval[];
    };
    const report = buildReleaseHardeningReport({
      requirements: traceability.requirements,
      evals: evalManifest.evals,
      browserFiles: [
        {
          filePath: "src/ui/App.tsx",
          sourceText: readFileSync(join(repoRoot, "src", "ui", "App.tsx"), "utf8"),
        },
        {
          filePath: "src/planner/commandCentreDashboard.ts",
          sourceText: readFileSync(
            join(repoRoot, "src", "planner", "commandCentreDashboard.ts"),
            "utf8",
          ),
        },
      ],
    });

    expect(report).toMatchObject({
      missingRequirementIds: [],
      missingEvalRequirementIds: [],
      missingTestRequirementIds: [],
      forbiddenBrowserImports: [],
      ready: true,
    });
    expect(report.blockerEvalCount).toBeGreaterThanOrEqual(35);
  });

  it("detects forbidden browser imports", () => {
    expect(
      findForbiddenBrowserImports([
        {
          filePath: "src/ui/Bad.tsx",
          sourceText: 'import { createHash } from "node:crypto";',
        },
      ]),
    ).toEqual([{ filePath: "src/ui/Bad.tsx", importName: "node:crypto" }]);
  });
});
