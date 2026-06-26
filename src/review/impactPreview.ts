import { projectFire, type ProjectionInput } from "../planner/projectionEngine";
import type { RecalculationTrigger } from "../transactions/reviewModel";

export type ImpactPreviewInput = {
  projectionInput: ProjectionInput;
  currentMonthlyNetSpendMinor: number;
  nextMonthlyNetSpendMinor: number;
  currentMiles: number;
  nextMiles: number;
  recalculationTriggers: RecalculationTrigger[];
};

export type ImpactPreview = {
  monthlyNetSpendDeltaMinor: number;
  annualizedExpensesDeltaMinor: number;
  currentFiAge?: number;
  projectedFiAge?: number;
  fiAgeDelta?: number;
  milesDelta: number;
  affectedAreas: Array<"expenses" | "planner" | "miles" | "refunds">;
  summary: string;
};

export function calculateImpactPreview(input: ImpactPreviewInput): ImpactPreview {
  const monthlyNetSpendDeltaMinor =
    input.nextMonthlyNetSpendMinor - input.currentMonthlyNetSpendMinor;
  const annualizedExpensesDeltaMinor = monthlyNetSpendDeltaMinor * 12;
  const currentProjection = projectFire(input.projectionInput);
  const projectedProjection = projectFire({
    ...input.projectionInput,
    annualExpensesMinor: Math.max(
      0,
      input.projectionInput.annualExpensesMinor + annualizedExpensesDeltaMinor,
    ),
  });
  const milesDelta = input.nextMiles - input.currentMiles;
  const affectedAreas = affectedAreasForTriggers(input.recalculationTriggers, annualizedExpensesDeltaMinor);

  return {
    monthlyNetSpendDeltaMinor,
    annualizedExpensesDeltaMinor,
    currentFiAge: currentProjection.fiAge,
    projectedFiAge: projectedProjection.fiAge,
    fiAgeDelta: compareOptionalNumber(projectedProjection.fiAge, currentProjection.fiAge),
    milesDelta,
    affectedAreas,
    summary: buildSummary(annualizedExpensesDeltaMinor, milesDelta, projectedProjection.fiAge, currentProjection.fiAge),
  };
}

function affectedAreasForTriggers(
  triggers: RecalculationTrigger[],
  annualizedExpensesDeltaMinor: number,
): ImpactPreview["affectedAreas"] {
  const areas = new Set<ImpactPreview["affectedAreas"][number]>();

  if (annualizedExpensesDeltaMinor !== 0 || triggers.includes("category_corrected")) {
    areas.add("expenses");
    areas.add("planner");
  }

  if (triggers.includes("refund_match_changed")) {
    areas.add("refunds");
    areas.add("expenses");
    areas.add("planner");
  }

  if (
    triggers.includes("mcc_corrected") ||
    triggers.includes("miles_eligibility_changed") ||
    triggers.includes("refund_match_changed")
  ) {
    areas.add("miles");
  }

  return [...areas];
}

function buildSummary(
  annualizedExpensesDeltaMinor: number,
  milesDelta: number,
  projectedFiAge: number | undefined,
  currentFiAge: number | undefined,
) {
  const expenseText =
    annualizedExpensesDeltaMinor === 0
      ? "annual expenses unchanged"
      : `annual expenses ${formatSignedMoney(annualizedExpensesDeltaMinor)}`;
  const milesText =
    milesDelta === 0 ? "miles unchanged" : `miles ${milesDelta > 0 ? "+" : ""}${milesDelta}`;
  const fiText =
    projectedFiAge === undefined || currentFiAge === undefined
      ? "FI date unavailable"
      : projectedFiAge === currentFiAge
        ? `FI age remains ${projectedFiAge}`
        : `FI age moves to ${projectedFiAge}`;

  return `${expenseText}; ${milesText}; ${fiText}.`;
}

function compareOptionalNumber(left: number | undefined, right: number | undefined) {
  if (left === undefined || right === undefined) {
    return undefined;
  }

  return left - right;
}

function formatSignedMoney(valueMinor: number) {
  const sign = valueMinor > 0 ? "+" : "-";
  return `${sign}S$${Math.abs(valueMinor / 100).toLocaleString("en-SG", {
    maximumFractionDigits: 0,
  })}`;
}
