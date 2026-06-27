import { describe, expect, it } from "vitest";

import {
  answerOnboardingQuestion,
  buildPlannerSetupReview,
  calculateOnboardingProgress,
  completeCurrentSection,
  createInitialOnboardingState,
  getCurrentSection,
  onboardingSections,
  skipCurrentSection,
} from "../../src/onboarding/wanderGuide";

describe("Wander Guide onboarding", () => {
  it("starts on the timeline section with bundled questions", () => {
    const state = createInitialOnboardingState();
    const section = getCurrentSection(state);

    expect(section).toMatchObject({
      id: "timeline",
      title: "Your timeline",
    });
    expect(section.questions.map((question) => question.id)).toEqual([
      "currentAge",
      "targetRetirementAge",
      "lifeExpectancy",
    ]);
  });

  it("answers questions and calculates required-field confidence", () => {
    let state = createInitialOnboardingState();
    state = answerOnboardingQuestion(state, "currentAge", 36);
    state = answerOnboardingQuestion(state, "targetRetirementAge", 45);
    state = answerOnboardingQuestion(state, "annualIncome", 180_000);

    const progress = calculateOnboardingProgress(state);

    expect(progress.requiredAnswered).toBe(3);
    expect(progress.requiredTotal).toBeGreaterThan(3);
    expect(progress.confidenceScore).toBeGreaterThan(0);
    expect(progress.readyForReview).toBe(false);
  });

  it("tracks completed and skipped sections separately", () => {
    let state = createInitialOnboardingState();
    state = completeCurrentSection(state);

    expect(state.currentSectionId).toBe("fire_life");
    expect(state.completedSectionIds).toEqual(["timeline"]);

    state = skipCurrentSection(state);

    expect(state.currentSectionId).toBe("money_today");
    expect(state.completedSectionIds).toEqual(["timeline"]);
    expect(state.skippedSectionIds).toEqual(["fire_life"]);
  });

  it("builds a structured planner setup review from answers", () => {
    let state = createInitialOnboardingState();
    state = answerOnboardingQuestion(state, "currentAge", 36);
    state = answerOnboardingQuestion(state, "targetRetirementAge", 45);
    state = answerOnboardingQuestion(state, "liquidAssets", 250_000);
    state = answerOnboardingQuestion(state, "annualIncome", 180_000);
    state = answerOnboardingQuestion(state, "monthlySavings", 4_500);
    state = answerOnboardingQuestion(state, "cpfOa", 60_000);
    state = answerOnboardingQuestion(state, "cpfSa", 80_000);
    state = answerOnboardingQuestion(state, "cpfMa", 30_000);
    state = answerOnboardingQuestion(state, "primaryGoal", "Emergency fund");

    const review = buildPlannerSetupReview(state);

    expect(review).toMatchObject({
      timeline: {
        currentAge: 36,
        targetRetirementAge: 45,
      },
      annualIncomeMinor: 18_000_000,
      monthlySavingsMinor: 450_000,
      liquidAssetsMinor: 25_000_000,
      cpfTotalMinor: 17_000_000,
      primaryGoal: "Emergency fund",
    });
    expect(review.missingRequiredQuestionIds).toContain("fireLifestyle");
  });

  it("keeps the preview as the last section", () => {
    expect(onboardingSections.at(-1)?.id).toBe("preview");
  });
});
