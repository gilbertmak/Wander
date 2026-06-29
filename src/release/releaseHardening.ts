export type ReleaseHardeningRequirement = {
  requirementId: string;
  epic: string;
  automatedTestIds: string[];
  releaseGate: string;
};

export type ReleaseEval = {
  id: string;
  requirementRefs: string[];
  priority: "blocker" | "high" | "medium" | "low";
  automationLayer: string;
};

export type BrowserImportCheckInput = {
  filePath: string;
  sourceText: string;
};

export type ReleaseHardeningReport = {
  missingRequirementIds: string[];
  missingEvalRequirementIds: string[];
  missingTestRequirementIds: string[];
  forbiddenBrowserImports: Array<{ filePath: string; importName: string }>;
  blockerEvalCount: number;
  ready: boolean;
};

const release3RequirementIds = [
  "REQ-FIRE-002",
  "REQ-DB-002",
  "REQ-FIRE-003",
  "REQ-FIRE-004",
  "REQ-FIRE-005",
  "REQ-UI-003",
  "REQ-FIRE-006",
  "REQ-FIRE-007",
  "REQ-REL-001",
] as const;

const forbiddenBrowserImports = ["node:crypto", "node:fs", "node:path", "better-sqlite3"];

export function buildReleaseHardeningReport(input: {
  requirements: ReleaseHardeningRequirement[];
  evals: ReleaseEval[];
  browserFiles: BrowserImportCheckInput[];
}): ReleaseHardeningReport {
  const requirementIds = new Set(
    input.requirements.map((requirement) => requirement.requirementId),
  );
  const evalRequirementRefs = new Set(input.evals.flatMap((item) => item.requirementRefs));
  const missingRequirementIds = release3RequirementIds.filter((id) => !requirementIds.has(id));
  const missingEvalRequirementIds = release3RequirementIds.filter(
    (id) => !evalRequirementRefs.has(id),
  );
  const missingTestRequirementIds = input.requirements
    .filter((requirement) => release3RequirementIds.includes(requirement.requirementId as never))
    .filter((requirement) => requirement.automatedTestIds.length === 0)
    .map((requirement) => requirement.requirementId);
  const forbiddenImports = findForbiddenBrowserImports(input.browserFiles);

  return {
    missingRequirementIds,
    missingEvalRequirementIds,
    missingTestRequirementIds,
    forbiddenBrowserImports: forbiddenImports,
    blockerEvalCount: input.evals.filter((item) => item.priority === "blocker").length,
    ready:
      missingRequirementIds.length === 0 &&
      missingEvalRequirementIds.length === 0 &&
      missingTestRequirementIds.length === 0 &&
      forbiddenImports.length === 0,
  };
}

export function findForbiddenBrowserImports(files: BrowserImportCheckInput[]) {
  return files.flatMap((file) =>
    forbiddenBrowserImports
      .filter(
        (importName) =>
          file.sourceText.includes(`"${importName}"`) ||
          file.sourceText.includes(`'${importName}'`),
      )
      .map((importName) => ({ filePath: file.filePath, importName })),
  );
}
