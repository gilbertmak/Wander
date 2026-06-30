import { join } from "node:path";

import { z } from "zod";

export const evalSchema = z.object({
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

export const evalManifestSchema = z.object({
  metadata: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
  evals: z.array(evalSchema).min(1),
});

type EvalItem = z.infer<typeof evalSchema>;
export type EvalManifest = z.infer<typeof evalManifestSchema>;

export type EvalAuditReport = {
  generatedAt: string;
  name: string;
  version: string;
  total: number;
  automated: number;
  external: number;
  blocker: number;
  byPriority: Record<string, number>;
  byGrader: Record<string, number>;
  byAutomationLayer: Record<string, number>;
  gateResults: Array<{
    name: string;
    status: "passed" | "pending";
    count: number;
    description: string;
  }>;
  reportFiles: {
    json: string;
    markdown: string;
  };
};

const executableLayers = new Set([
  "static-analysis",
  "migration-test",
  "contract-test",
  "integration-test",
  "unit-test",
  "domain-test",
  "data-quality-test",
  "security-test",
  "ci-gate",
  "manifest-test",
  "e2e-test",
]);

const externalLayers = new Set([
  "llm-eval",
  "e2e-visual",
  "e2e-accessibility",
  "accessibility-scan",
  "visual-accessibility",
  "design-review",
  "security-review",
  "performance-test",
]);

export function createEvalAuditReport(
  manifest: EvalManifest,
  options: { generatedAt?: string; reportDir?: string } = {},
): EvalAuditReport {
  assertUniqueIds(manifest.evals);
  assertKnownAutomationLayers(manifest.evals);

  const automated = manifest.evals.filter((item) => executableLayers.has(item.automationLayer));
  const external = manifest.evals.filter((item) => externalLayers.has(item.automationLayer));
  const reportDir = options.reportDir ?? join("test-results", "evals");
  const reportFiles = {
    json: join(reportDir, "latest.json"),
    markdown: join(reportDir, "latest.md"),
  };

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    name: manifest.metadata.name,
    version: manifest.metadata.version,
    total: manifest.evals.length,
    automated: automated.length,
    external: external.length,
    blocker: manifest.evals.filter((item) => item.priority === "blocker").length,
    byPriority: countBy(manifest.evals, (item) => item.priority),
    byGrader: countBy(manifest.evals, (item) => item.grader.type),
    byAutomationLayer: countBy(manifest.evals, (item) => item.automationLayer),
    gateResults: [
      {
        name: "Eval manifest audit",
        status: "passed",
        count: manifest.evals.length,
        description: "Manifest schema, unique IDs, and automation layer mapping passed.",
      },
      {
        name: "Automated binary coverage",
        status: "passed",
        count: automated.length,
        description: "Eval cases mapped to local deterministic automation layers.",
      },
      {
        name: "External or future evidence",
        status: external.length > 0 ? "pending" : "passed",
        count: external.length,
        description:
          "LLM, visual, accessibility, security-review, performance, or design evidence tracked outside this audit.",
      },
    ],
    reportFiles,
  };
}

export function renderEvalAuditMarkdown(report: EvalAuditReport) {
  const gateRows = report.gateResults
    .map((gate) => `| ${gate.name} | ${gate.status} | ${gate.count} | ${gate.description} |`)
    .join("\n");
  const layerRows = Object.entries(report.byAutomationLayer)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([layer, count]) => `| ${layer} | ${count} |`)
    .join("\n");

  return `# Eval Audit Report

Generated: ${report.generatedAt}

## Summary

| Metric | Count |
|---|---:|
| Total evals | ${report.total} |
| Automated evals | ${report.automated} |
| External or future evidence evals | ${report.external} |
| Blocker evals | ${report.blocker} |

## Gate Results

| Gate | Status | Count | Description |
|---|---|---:|---|
${gateRows}

## Automation Layers

| Layer | Count |
|---|---:|
${layerRows}
`;
}

function assertUniqueIds(evals: EvalItem[]) {
  const ids = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const item of evals) {
    if (ids.has(item.id)) {
      duplicateIds.add(item.id);
    }
    ids.add(item.id);
  }

  if (duplicateIds.size > 0) {
    throw new Error(`Duplicate eval IDs: ${[...duplicateIds].join(", ")}`);
  }
}

function assertKnownAutomationLayers(evals: EvalItem[]) {
  const unmapped = evals.filter(
    (item) =>
      !executableLayers.has(item.automationLayer) && !externalLayers.has(item.automationLayer),
  );

  if (unmapped.length > 0) {
    throw new Error(
      `Unmapped automation layers: ${unmapped.map((item) => `${item.id}:${item.automationLayer}`).join(", ")}`,
    );
  }
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
