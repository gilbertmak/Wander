export type OnboardingSectionId =
  | "timeline"
  | "fire_life"
  | "money_today"
  | "monthly_engine"
  | "cpf"
  | "property"
  | "healthcare"
  | "goals"
  | "risk"
  | "preview";

export type OnboardingQuestionType = "number" | "money" | "select" | "text";

export type OnboardingQuestion = {
  id: string;
  label: string;
  helper: string;
  type: OnboardingQuestionType;
  required: boolean;
  options?: string[];
};

export type OnboardingSection = {
  id: OnboardingSectionId;
  title: string;
  guidePrompt: string;
  questions: OnboardingQuestion[];
};

export type OnboardingAnswerValue = string | number | undefined;

export type OnboardingState = {
  currentSectionId: OnboardingSectionId;
  answers: Record<string, OnboardingAnswerValue>;
  completedSectionIds: OnboardingSectionId[];
  skippedSectionIds: OnboardingSectionId[];
};

export type OnboardingProgress = {
  completedSections: number;
  totalSections: number;
  requiredAnswered: number;
  requiredTotal: number;
  confidenceScore: number;
  readyForReview: boolean;
};

export type PlannerSetupReview = {
  timeline: {
    currentAge?: number;
    targetRetirementAge?: number;
    lifeExpectancy?: number;
  };
  annualIncomeMinor?: number;
  monthlySavingsMinor?: number;
  liquidAssetsMinor?: number;
  cpfTotalMinor?: number;
  primaryGoal?: string;
  confidenceScore: number;
  missingRequiredQuestionIds: string[];
};

export const onboardingSections: OnboardingSection[] = [
  {
    id: "timeline",
    title: "Your timeline",
    guidePrompt: "Let us anchor the plan in time first. A FIRE date without ages is theatre.",
    questions: [
      {
        id: "currentAge",
        label: "Current age",
        helper: "Used as the starting point for every projection year.",
        type: "number",
        required: true,
      },
      {
        id: "targetRetirementAge",
        label: "Target retirement age",
        helper: "This becomes the first goalpost for the FIRE gap.",
        type: "number",
        required: true,
      },
      {
        id: "lifeExpectancy",
        label: "Planning age",
        helper: "How long the plan should support spending.",
        type: "number",
        required: false,
      },
    ],
  },
  {
    id: "fire_life",
    title: "Your FIRE life",
    guidePrompt: "Now define the life we are trying to fund, not just a number to chase.",
    questions: [
      {
        id: "fireLifestyle",
        label: "Retirement lifestyle",
        helper: "Lean, regular, fat, or custom spending path.",
        type: "select",
        required: true,
        options: ["Lean", "Regular", "Fat", "Custom"],
      },
      {
        id: "monthlyRetirementSpend",
        label: "Expected monthly retirement spend",
        helper: "Used to estimate the FIRE number before statement history refines it.",
        type: "money",
        required: true,
      },
      {
        id: "dependantSupport",
        label: "Dependants or parent support",
        helper: "Adds planned support obligations to spending.",
        type: "money",
        required: false,
      },
    ],
  },
  {
    id: "money_today",
    title: "Your money today",
    guidePrompt: "Assets, liabilities, and CPF form separate buckets. We keep them visible.",
    questions: [
      {
        id: "liquidAssets",
        label: "Cash and liquid investments",
        helper: "Available assets outside CPF and property.",
        type: "money",
        required: true,
      },
      {
        id: "propertyEquity",
        label: "Property equity",
        helper: "Estimated property value less mortgage.",
        type: "money",
        required: false,
      },
      {
        id: "debtBalance",
        label: "Other debt",
        helper: "Credit, loans, and other liabilities.",
        type: "money",
        required: false,
      },
    ],
  },
  {
    id: "monthly_engine",
    title: "Your monthly engine",
    guidePrompt: "This tells us how quickly the plan can move without heroic assumptions.",
    questions: [
      {
        id: "annualIncome",
        label: "Annual income",
        helper: "Salary and recurring income before tax.",
        type: "money",
        required: true,
      },
      {
        id: "annualBonus",
        label: "Annual bonus",
        helper: "Used for CPF, tax, and savings estimates.",
        type: "money",
        required: false,
      },
      {
        id: "monthlySavings",
        label: "Monthly savings or investment",
        helper: "Regular amount invested toward FIRE and goals.",
        type: "money",
        required: true,
      },
    ],
  },
  {
    id: "cpf",
    title: "Your CPF",
    guidePrompt: "CPF changes the answer materially in Singapore, so we model it directly.",
    questions: [
      {
        id: "cpfOa",
        label: "CPF OA balance",
        helper: "Ordinary Account balance.",
        type: "money",
        required: false,
      },
      {
        id: "cpfSa",
        label: "CPF SA balance",
        helper: "Special Account balance.",
        type: "money",
        required: false,
      },
      {
        id: "cpfMa",
        label: "CPF MA balance",
        helper: "MediSave Account balance.",
        type: "money",
        required: false,
      },
    ],
  },
  {
    id: "property",
    title: "Property",
    guidePrompt:
      "Housing can be a home, an asset, a liability, or all three. Annoying, but useful.",
    questions: [
      {
        id: "homeValue",
        label: "Estimated home value",
        helper: "Used for property equity and possible downsizing.",
        type: "money",
        required: false,
      },
      {
        id: "mortgageBalance",
        label: "Mortgage balance",
        helper: "Outstanding loan amount.",
        type: "money",
        required: false,
      },
      {
        id: "monthlyMortgage",
        label: "Monthly mortgage payment",
        helper: "Projected as a cash-flow item.",
        type: "money",
        required: false,
      },
    ],
  },
  {
    id: "healthcare",
    title: "Healthcare",
    guidePrompt: "Healthcare assumptions keep the retirement spending estimate less flimsy.",
    questions: [
      {
        id: "annualPremium",
        label: "Annual insurance premium",
        helper: "Integrated Shield, riders, CareShield, or other recurring premiums.",
        type: "money",
        required: false,
      },
      {
        id: "annualOutOfPocketHealthcare",
        label: "Annual out-of-pocket healthcare",
        helper: "Expected cash spending not covered by insurance or MediSave.",
        type: "money",
        required: false,
      },
    ],
  },
  {
    id: "goals",
    title: "Goals",
    guidePrompt: "A retirement plan has to make room for life before retirement too.",
    questions: [
      {
        id: "primaryGoal",
        label: "Most important goal",
        helper: "Emergency fund, home, education, travel, parent support, or custom.",
        type: "select",
        required: true,
        options: ["Emergency fund", "Home", "Education", "Travel", "Parent support", "Custom"],
      },
      {
        id: "primaryGoalAmount",
        label: "Goal amount",
        helper: "Target amount to fund this goal.",
        type: "money",
        required: true,
      },
      {
        id: "primaryGoalYear",
        label: "Target year",
        helper: "When you want this funded.",
        type: "number",
        required: true,
      },
    ],
  },
  {
    id: "risk",
    title: "Risk comfort",
    guidePrompt:
      "Return assumptions need a temperament check. Future you has to live with the ride.",
    questions: [
      {
        id: "portfolioStyle",
        label: "Portfolio style",
        helper: "Used to seed return and volatility assumptions.",
        type: "select",
        required: true,
        options: ["Conservative", "Balanced", "Growth", "Custom"],
      },
      {
        id: "withdrawalStrategy",
        label: "Withdrawal strategy",
        helper: "The first decumulation rule to compare.",
        type: "select",
        required: true,
        options: ["Constant dollar", "VPW", "Guardrails", "Floor-ceiling"],
      },
    ],
  },
  {
    id: "preview",
    title: "Plan preview",
    guidePrompt: "Review the inputs before Wander turns them into a planning profile.",
    questions: [],
  },
];

export function createInitialOnboardingState(): OnboardingState {
  return {
    currentSectionId: onboardingSections[0].id,
    answers: {},
    completedSectionIds: [],
    skippedSectionIds: [],
  };
}

export function getCurrentSection(state: OnboardingState) {
  return (
    onboardingSections.find((section) => section.id === state.currentSectionId) ??
    onboardingSections[0]
  );
}

export function answerOnboardingQuestion(
  state: OnboardingState,
  questionId: string,
  value: OnboardingAnswerValue,
): OnboardingState {
  return {
    ...state,
    answers: {
      ...state.answers,
      [questionId]: value,
    },
  };
}

export function completeCurrentSection(state: OnboardingState): OnboardingState {
  const currentIndex = getSectionIndex(state.currentSectionId);
  const nextSection = onboardingSections[Math.min(currentIndex + 1, onboardingSections.length - 1)];

  return {
    ...state,
    currentSectionId: nextSection.id,
    completedSectionIds: uniqueSectionIds([...state.completedSectionIds, state.currentSectionId]),
    skippedSectionIds: state.skippedSectionIds.filter((id) => id !== state.currentSectionId),
  };
}

export function skipCurrentSection(state: OnboardingState): OnboardingState {
  const currentIndex = getSectionIndex(state.currentSectionId);
  const nextSection = onboardingSections[Math.min(currentIndex + 1, onboardingSections.length - 1)];

  return {
    ...state,
    currentSectionId: nextSection.id,
    skippedSectionIds: uniqueSectionIds([...state.skippedSectionIds, state.currentSectionId]),
  };
}

export function calculateOnboardingProgress(state: OnboardingState): OnboardingProgress {
  const requiredQuestions = onboardingSections.flatMap((section) =>
    section.questions.filter((question) => question.required),
  );
  const requiredAnswered = requiredQuestions.filter((question) =>
    hasAnswer(state.answers[question.id]),
  ).length;
  const completedSections = state.completedSectionIds.length;
  const confidenceScore =
    requiredQuestions.length === 0 ? 1 : roundRatio(requiredAnswered / requiredQuestions.length);

  return {
    completedSections,
    totalSections: onboardingSections.length,
    requiredAnswered,
    requiredTotal: requiredQuestions.length,
    confidenceScore,
    readyForReview:
      state.currentSectionId === "preview" && requiredAnswered === requiredQuestions.length,
  };
}

export function buildPlannerSetupReview(state: OnboardingState): PlannerSetupReview {
  const missingRequiredQuestionIds = onboardingSections
    .flatMap((section) => section.questions)
    .filter((question) => question.required && !hasAnswer(state.answers[question.id]))
    .map((question) => question.id);
  const cpfTotalMinor =
    toMoneyMinor(state.answers.cpfOa) +
    toMoneyMinor(state.answers.cpfSa) +
    toMoneyMinor(state.answers.cpfMa);

  return {
    timeline: {
      currentAge: toOptionalNumber(state.answers.currentAge),
      targetRetirementAge: toOptionalNumber(state.answers.targetRetirementAge),
      lifeExpectancy: toOptionalNumber(state.answers.lifeExpectancy),
    },
    annualIncomeMinor: toOptionalMoneyMinor(state.answers.annualIncome),
    monthlySavingsMinor: toOptionalMoneyMinor(state.answers.monthlySavings),
    liquidAssetsMinor: toOptionalMoneyMinor(state.answers.liquidAssets),
    cpfTotalMinor,
    primaryGoal:
      typeof state.answers.primaryGoal === "string" ? state.answers.primaryGoal : undefined,
    confidenceScore: calculateOnboardingProgress(state).confidenceScore,
    missingRequiredQuestionIds,
  };
}

function getSectionIndex(sectionId: OnboardingSectionId) {
  return Math.max(
    0,
    onboardingSections.findIndex((section) => section.id === sectionId),
  );
}

function uniqueSectionIds(sectionIds: OnboardingSectionId[]) {
  return [...new Set(sectionIds)];
}

function hasAnswer(value: OnboardingAnswerValue) {
  return value !== undefined && value !== "";
}

function toOptionalNumber(value: OnboardingAnswerValue) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return undefined;
}

function toMoneyMinor(value: OnboardingAnswerValue) {
  return toOptionalMoneyMinor(value) ?? 0;
}

function toOptionalMoneyMinor(value: OnboardingAnswerValue) {
  const numericValue = toOptionalNumber(value);
  return numericValue === undefined || Number.isNaN(numericValue)
    ? undefined
    : Math.round(numericValue * 100);
}

function roundRatio(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
