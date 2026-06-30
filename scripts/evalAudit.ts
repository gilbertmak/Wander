import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  createEvalAuditReport,
  evalManifestSchema,
  renderEvalAuditMarkdown,
  type EvalAuditReport,
} from "../src/evals/evalAuditReport";

function loadEvalManifest(manifestPath = join(process.cwd(), "docs", "evals.json")) {
  return evalManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
}

function writeEvalAuditReports(report: EvalAuditReport) {
  mkdirSync(dirname(report.reportFiles.json), { recursive: true });
  writeFileSync(report.reportFiles.json, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(report.reportFiles.markdown, renderEvalAuditMarkdown(report));
}

const manifest = loadEvalManifest();
const report = createEvalAuditReport(manifest);
writeEvalAuditReports(report);
console.log(JSON.stringify(report, null, 2));
