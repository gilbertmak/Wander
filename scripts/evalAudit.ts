import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const evalSchema = z.object({
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

const manifestSchema = z.object({
  metadata: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
  evals: z.array(evalSchema).min(1),
});

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

const manifestPath = join(process.cwd(), "docs", "evals.json");
const manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
const ids = new Set<string>();
const duplicateIds = new Set<string>();

for (const item of manifest.evals) {
  if (ids.has(item.id)) {
    duplicateIds.add(item.id);
  }
  ids.add(item.id);
}

if (duplicateIds.size > 0) {
  throw new Error(`Duplicate eval IDs: ${[...duplicateIds].join(", ")}`);
}

const automated = manifest.evals.filter((item) => executableLayers.has(item.automationLayer));
const external = manifest.evals.filter((item) => externalLayers.has(item.automationLayer));
const unmapped = manifest.evals.filter(
  (item) => !executableLayers.has(item.automationLayer) && !externalLayers.has(item.automationLayer),
);

if (unmapped.length > 0) {
  throw new Error(`Unmapped automation layers: ${unmapped.map((item) => `${item.id}:${item.automationLayer}`).join(", ")}`);
}

console.log(
  JSON.stringify(
    {
      name: manifest.metadata.name,
      version: manifest.metadata.version,
      total: manifest.evals.length,
      automated: automated.length,
      external: external.length,
      blocker: manifest.evals.filter((item) => item.priority === "blocker").length,
    },
    null,
    2,
  ),
);
