import { describe, expect, it } from "vitest";

import { createEvalAuditReport, renderEvalAuditMarkdown } from "../../src/evals/evalAuditReport";

describe("eval audit reports", () => {
  it("summarizes eval manifest gates and renders markdown evidence", () => {
    const report = createEvalAuditReport(
      {
        metadata: {
          name: "sample-evals",
          version: "0.1.0",
        },
        evals: [
          {
            id: "ARCH-001",
            area: "architecture",
            priority: "blocker",
            requirementRefs: ["4.0"],
            grader: { type: "binary" },
            automationLayer: "static-analysis",
            scenario: "Architecture check",
            input: {},
            expected: ["Expected architecture"],
            passCriteria: ["Passes"],
          },
          {
            id: "MCC-001",
            area: "merchant-category-mcc",
            priority: "high",
            requirementRefs: ["4.5"],
            grader: { type: "llm_judge" },
            automationLayer: "llm-eval",
            scenario: "MCC judge check",
            input: {},
            expected: ["Plausible MCC"],
            passCriteria: ["Judge threshold met"],
          },
        ],
      },
      {
        generatedAt: "2026-06-29T00:00:00.000Z",
        reportDir: "tmp/evals",
      },
    );

    expect(report).toMatchObject({
      total: 2,
      automated: 1,
      external: 1,
      blocker: 1,
      byGrader: {
        binary: 1,
        llm_judge: 1,
      },
      reportFiles: {
        json: "tmp/evals/latest.json",
        markdown: "tmp/evals/latest.md",
      },
    });
    expect(report.gateResults.map((gate) => gate.status)).toEqual(["passed", "passed", "pending"]);
    expect(renderEvalAuditMarkdown(report)).toContain(
      "| External or future evidence | pending | 1 |",
    );
  });
});
