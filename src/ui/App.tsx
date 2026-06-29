import { useMemo, useState } from "react";

import { buildCommandCentreSnapshot } from "../planner/commandCentreDashboard";
import { buildFireChartsReport, type FireReportSection } from "../planner/fireChartsReports";
import { planGoalGaps, type GoalInput } from "../planner/goalGapPlanner";
import { projectSingaporeFire, type SingaporeFireInput } from "../planner/singaporeFireEngine";
import { applyCorrectionDraft, type CorrectionField } from "../review/correctionWorkflow";
import { calculateImpactPreview, type ImpactPreview } from "../review/impactPreview";
import type { ReviewTransaction } from "../review/reviewInboxModel";
import {
  answerOnboardingQuestion,
  buildPlannerSetupReview,
  calculateOnboardingProgress,
  completeCurrentSection,
  createInitialOnboardingState,
  getCurrentSection,
  skipCurrentSection,
  type OnboardingQuestion,
} from "../onboarding/wanderGuide";
import { useAppShellStore, type MobileTab, type ProductSurface } from "../state/appShellStore";

const mobileTabs: Array<{ id: MobileTab; label: string; shortLabel: string; badge?: string }> = [
  { id: "home", label: "Home", shortLabel: "Home" },
  { id: "plan", label: "Plan", shortLabel: "Plan" },
  { id: "transactions", label: "Transactions", shortLabel: "Txns", badge: "7" },
  { id: "cards", label: "Cards", shortLabel: "Cards", badge: "2" },
  { id: "profile", label: "Profile", shortLabel: "Me" },
];

const surfaceLabels: Record<ProductSurface, string> = {
  home: "Dashboard",
  onboarding: "Setup",
  cards: "Cards & miles",
  desktop: "Planner",
  reports: "Reports",
};

const spendBreakdown = [
  { label: "Housing", value: "33%" },
  { label: "Transport", value: "20%" },
  { label: "Food", value: "15%" },
  { label: "Shopping", value: "12%" },
  { label: "Lifestyle", value: "10%" },
  { label: "Others", value: "10%" },
];

const transactions = [
  {
    date: "18 May",
    merchant: "Shopee SG",
    note: "SHP-SG-123456",
    category: "Shopping",
    mcc: "5812",
    confidence: "91%",
    card: "Citi Rewards",
    amount: "-128.90",
    status: "Eligible",
    miles: "+516 miles",
    tone: "eligible",
  },
  {
    date: "18 May",
    merchant: "Shopee Refund",
    note: "REF-SG-123456",
    category: "Shopping",
    mcc: "5812",
    confidence: "91%",
    card: "Citi Rewards",
    amount: "+128.90",
    status: "Refund reversal",
    miles: "-516 miles",
    tone: "refund",
  },
  {
    date: "17 May",
    merchant: "Cold Storage",
    note: "TAMPINES 1",
    category: "Groceries",
    mcc: "5422",
    confidence: "95%",
    card: "DBS WWMC",
    amount: "-86.45",
    status: "Eligible",
    miles: "+172 miles",
    tone: "eligible",
  },
  {
    date: "16 May",
    merchant: "Spotify Pte. Ltd.",
    note: "SPOTIFY",
    category: "Entertainment",
    mcc: "5733",
    confidence: "96%",
    card: "HSBC Revolution",
    amount: "-11.98",
    status: "Eligible",
    miles: "+22 miles",
    tone: "eligible",
  },
  {
    date: "14 May",
    merchant: "Amazon SG",
    note: "AMZN Mktp",
    category: "Shopping",
    mcc: "5942",
    confidence: "72%",
    card: "DBS Altitude",
    amount: "-499.00",
    status: "Check category",
    miles: "0 miles",
    tone: "review",
  },
];

const correctionFields: Array<{ value: CorrectionField; label: string }> = [
  { value: "category", label: "Category" },
  { value: "merchant", label: "Merchant" },
  { value: "mcc", label: "MCC" },
  { value: "card", label: "Card" },
  { value: "refund_match", label: "Refund match" },
  { value: "miles_eligibility", label: "Miles eligibility" },
];

const sampleReviewTransaction: ReviewTransaction = {
  id: "transaction_amazon_sg",
  postedDate: "2026-05-14",
  descriptionNormalized: "amazon sg amzn mktp",
  amountMinor: -49_900,
  categoryId: "category_shopping",
  mccCode: "5942",
  merchantId: "merchant_amazon_sg",
  cardId: "card_dbs_altitude",
  confidenceScore: 0.72,
  eligibleForMiles: false,
  needsReview: true,
  transactionKind: "purchase",
};

const sampleImpactPreview = calculateImpactPreview({
  projectionInput: {
    currentAge: 35,
    targetRetirementAge: 45,
    currentNetWorthMinor: 80_000_000,
    annualExpensesMinor: 4_800_000,
    annualSavingsMinor: 3_000_000,
    safeWithdrawalRate: 0.035,
    expectedReturnRate: 0.05,
    inflationRate: 0.02,
    maxYears: 30,
  },
  currentMonthlyNetSpendMinor: 400_000,
  nextMonthlyNetSpendMinor: 450_000,
  currentMiles: 10_000,
  nextMiles: 9_200,
  recalculationTriggers: ["refund_match_changed", "miles_eligibility_changed"],
});

const commandCentreFireInput: SingaporeFireInput = {
  currentAge: 40,
  targetRetirementAge: 55,
  lifeExpectancyAge: 90,
  currentYear: 2026,
  liquidAssetsMinor: 160_000_000,
  cpf: {
    oaMinor: 20_000_000,
    saMinor: 14_000_000,
    maMinor: 6_000_000,
  },
  annualIncomeMinor: 14_400_000,
  annualBonusMinor: 2_000_000,
  monthlyInvestmentMinor: 800_000,
  annualRetirementSpendMinor: 6_000_000,
  annualHealthcareSpendMinor: 800_000,
  propertyValueMinor: 120_000_000,
  mortgageBalanceMinor: 55_000_000,
  annualMortgagePaymentMinor: 3_600_000,
  safeWithdrawalRate: 0.035,
  liquidReturnRate: 0.045,
  inflationRate: 0.025,
  propertyGrowthRate: 0.01,
};

const commandCentreGoals: GoalInput[] = [
  {
    id: "goal_parent_support",
    goalType: "parent_support",
    label: "Parent support reserve",
    targetAmountMinor: 18_000_000,
    currentAmountMinor: 2_000_000,
    targetDate: "2030-06-01",
    priority: 2,
    status: "active",
  },
  {
    id: "goal_sabbatical",
    goalType: "travel",
    label: "Sabbatical travel",
    targetAmountMinor: 2_400_000,
    currentAmountMinor: 600_000,
    targetDate: "2028-06-01",
    priority: 4,
    status: "active",
    inflationAdjusted: false,
  },
];

const commandCentreProjection = projectSingaporeFire(commandCentreFireInput);
const commandCentreGoalPlan = planGoalGaps({
  currentDate: "2026-06-01",
  monthlyAvailableForGoalsMinor: 250_000,
  monthlyReturnRate: 0.003,
  inflationRate: 0.025,
  goals: commandCentreGoals,
  projection: commandCentreProjection,
});
const commandCentreAdvisorPlan = {
  summary: {
    criticalCount: 1,
    warningCount: 0,
    infoCount: 0,
    topAction: "Increase goal funding by S$1,691 monthly or resize the lowest-priority goal.",
  },
  insights: [
    {
      title: "Goal funding gap",
      severity: "critical",
      confidenceScore: 0.9,
      recommendedAction:
        "Increase goal funding by S$1,691 monthly or resize the lowest-priority goal.",
    },
  ],
};
const commandCentreSnapshot = buildCommandCentreSnapshot({
  projection: commandCentreProjection,
  goalPlan: commandCentreGoalPlan,
  advisorPlan: commandCentreAdvisorPlan,
  monthlyNetSpendMinor: 600_000,
  emergencyReserveMinor: 4_000_000,
});
const fireChartsReport = buildFireChartsReport({
  generatedAt: "2026-06-29",
  projection: commandCentreProjection,
  goalPlan: commandCentreGoalPlan,
  sampleEveryYears: 10,
});

export function App() {
  const activeTab = useAppShellStore((state) => state.activeTab);
  const setActiveTab = useAppShellStore((state) => state.setActiveTab);
  const activeSurface = useAppShellStore((state) => state.activeSurface);
  const setActiveSurface = useAppShellStore((state) => state.setActiveSurface);
  const [onboardingState, setOnboardingState] = useState(createInitialOnboardingState);
  const [plannerApplied, setPlannerApplied] = useState(false);
  const [reviewCompleted, setReviewCompleted] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <main className="app-frame">
      <DesktopShell
        activeSurface={activeSurface}
        onApplyPlanner={() => setPlannerApplied(true)}
        onExplain={() => setWhyOpen(true)}
        onReviewAll={() => setReviewCompleted(true)}
        plannerApplied={plannerApplied}
        reviewCompleted={reviewCompleted}
        setActiveSurface={setActiveSurface}
        onboardingState={onboardingState}
        setOnboardingState={setOnboardingState}
      />
      <MobileShell
        activeTab={activeTab}
        onApplyPlanner={() => setPlannerApplied(true)}
        plannerApplied={plannerApplied}
        setActiveTab={setActiveTab}
      />
      {whyOpen && <WhyThisDrawer onClose={() => setWhyOpen(false)} />}
    </main>
  );
}

function DesktopShell({
  activeSurface,
  setActiveSurface,
  plannerApplied,
  reviewCompleted,
  onApplyPlanner,
  onReviewAll,
  onExplain,
  onboardingState,
  setOnboardingState,
}: {
  activeSurface: ProductSurface;
  setActiveSurface: (surface: ProductSurface) => void;
  plannerApplied: boolean;
  reviewCompleted: boolean;
  onApplyPlanner: () => void;
  onReviewAll: () => void;
  onExplain: () => void;
  onboardingState: ReturnType<typeof createInitialOnboardingState>;
  setOnboardingState: (state: ReturnType<typeof createInitialOnboardingState>) => void;
}) {
  return (
    <section className="desktop-shell" aria-label="Wander desktop app">
      <aside className="desktop-sidebar" aria-label="Desktop navigation">
        <div>
          <p className="brand">Wander</p>
          <p className="eyebrow">Local-first FIRE</p>
        </div>
        <nav aria-label="Workspace sections">
          {(Object.keys(surfaceLabels) as ProductSurface[]).map((surface) => (
            <button
              aria-current={activeSurface === surface ? "page" : undefined}
              className={activeSurface === surface ? "active" : ""}
              key={surface}
              onClick={() => setActiveSurface(surface)}
              type="button"
            >
              {surfaceLabels[surface]}
            </button>
          ))}
        </nav>
        <button className="import-button" onClick={onReviewAll} type="button">
          Import statements
        </button>
      </aside>

      <section className="desktop-workspace">
        <header className="desktop-topbar">
          <h1>{surfaceLabels[activeSurface]}</h1>
          <div className="topbar-actions">
            <button type="button">1-31 May 2026</button>
            <button type="button">SGD</button>
            <span aria-label="Profile initials">GM</span>
          </div>
        </header>

        {activeSurface === "home" && (
          <DashboardSurface
            onStartSetup={() => setActiveSurface("onboarding")}
            onApplyPlanner={onApplyPlanner}
            onExplain={onExplain}
            onReviewAll={onReviewAll}
            plannerApplied={plannerApplied}
            reviewCompleted={reviewCompleted}
          />
        )}
        {activeSurface === "onboarding" && (
          <WanderGuideOnboarding
            onboardingState={onboardingState}
            setOnboardingState={setOnboardingState}
          />
        )}
        {activeSurface === "cards" && (
          <CardsSurface onApplyPlanner={onApplyPlanner} plannerApplied={plannerApplied} />
        )}
        {activeSurface === "desktop" && (
          <PlannerSurface preview={sampleImpactPreview} plannerApplied={plannerApplied} />
        )}
        {activeSurface === "reports" && <ReportsSurface />}
      </section>
    </section>
  );
}

function DashboardSurface({
  plannerApplied,
  reviewCompleted,
  onStartSetup,
  onApplyPlanner,
  onReviewAll,
  onExplain,
}: {
  plannerApplied: boolean;
  reviewCompleted: boolean;
  onStartSetup: () => void;
  onApplyPlanner: () => void;
  onReviewAll: () => void;
  onExplain: () => void;
}) {
  return (
    <div className="dashboard-grid">
      <CommandCentreHero
        onApplyPlanner={onApplyPlanner}
        onExplain={onExplain}
        plannerApplied={plannerApplied}
      />

      <section className="review-table-card" aria-labelledby="review-title">
        <div className="section-heading">
          <div>
            <h2 id="review-title">Review Inbox</h2>
            <span>{reviewCompleted ? "0 needs review" : "12 needs review"}</span>
          </div>
          <div className="table-tools">
            <input aria-label="Search merchant or note" placeholder="Search merchant or note" />
            <button onClick={onReviewAll} type="button">
              {reviewCompleted ? "Reviewed" : "Review all"}
            </button>
          </div>
        </div>

        <table aria-label="Imported transaction review">
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Category</th>
              <th>MCC & confidence</th>
              <th>Card</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr className={transaction.tone} key={`${transaction.date}-${transaction.merchant}`}>
                <td>{transaction.date}</td>
                <td>
                  <strong>{transaction.merchant}</strong>
                  <span>{transaction.note}</span>
                </td>
                <td>
                  <span className="category-pill">{transaction.category}</span>
                </td>
                <td>
                  <strong>MCC {transaction.mcc}</strong>
                  <span>Confidence {transaction.confidence}</span>
                </td>
                <td>{transaction.card}</td>
                <td>{transaction.amount}</td>
                <td>
                  <span className="status-pill">{transaction.status}</span>
                  <small>{transaction.miles}</small>
                </td>
                <td>
                  <button onClick={onExplain} type="button">
                    Why this?
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <aside className="insight-column" aria-label="Insights">
        <WanderGuideCard onStartSetup={onStartSetup} />
        <AdvisorActionCard onExplain={onExplain} />
        <GoalGapCard />
        <CpfHealthCard />
        <MilesOverviewCard />
        <ExpenseSnapshotCard />
      </aside>
    </div>
  );
}

function CommandCentreHero({
  plannerApplied,
  onApplyPlanner,
  onExplain,
}: {
  plannerApplied: boolean;
  onApplyPlanner: () => void;
  onExplain: () => void;
}) {
  return (
    <section className={`command-centre-hero ${commandCentreSnapshot.status}`}>
      <div className="command-hero-copy">
        <p className="eyebrow">FIRE command centre</p>
        <h2>{commandCentreSnapshot.fireProgressPercent}% to financial independence</h2>
        <p>{commandCentreSnapshot.headline}</p>
        <div className="command-actions">
          <button className="primary-action" onClick={onApplyPlanner} type="button">
            {plannerApplied ? "Planner updated" : "Apply latest import"}
          </button>
          <button className="secondary-action" onClick={onExplain} type="button">
            Why this plan?
          </button>
        </div>
      </div>

      <div className="command-orb" aria-hidden="true">
        <span>{commandCentreSnapshot.status.replace("_", " ")}</span>
      </div>

      <div className="command-card-grid" aria-label="FIRE command cards">
        {commandCentreSnapshot.commandCards.map((card) => (
          <article className={card.tone} key={card.id}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>

      <ol className="milestone-track" aria-label="FIRE milestones">
        {commandCentreSnapshot.nextMilestones.map((milestone) => (
          <li className={milestone.tone} key={milestone.label}>
            <span>{milestone.label}</span>
            <strong>
              Age {milestone.age} · {milestone.calendarYear}
            </strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AdvisorActionCard({ onExplain }: { onExplain: () => void }) {
  const topInsight = commandCentreAdvisorPlan.insights[0];

  return (
    <section className="insight-card advisor-card">
      <p className="eyebrow">Advisor action</p>
      <h2>{topInsight?.title ?? "Review planner assumptions"}</h2>
      <p>{topInsight?.recommendedAction ?? commandCentreSnapshot.topAdvisorAction}</p>
      <dl className="impact-list">
        <div>
          <dt>Severity</dt>
          <dd>{topInsight?.severity ?? "info"}</dd>
          <strong>{Math.round((topInsight?.confidenceScore ?? 0.75) * 100)}% confidence</strong>
        </div>
      </dl>
      <button className="secondary-action full" onClick={onExplain} type="button">
        Why this recommendation?
      </button>
    </section>
  );
}

function GoalGapCard() {
  return (
    <section className="insight-card">
      <p className="eyebrow">Goals and gap</p>
      <h2>{commandCentreSnapshot.activeGoalCount} active goals</h2>
      <dl className="impact-list">
        <div>
          <dt>Remaining gap</dt>
          <dd>{formatMinor(commandCentreGoalPlan.totalRemainingGapMinor)}</dd>
          <strong>
            {formatMinor(commandCentreSnapshot.monthlyGoalShortfallMinor)} monthly shortfall
          </strong>
        </div>
        <div>
          <dt>FIRE conflict</dt>
          <dd>{formatMinor(commandCentreSnapshot.retirementGoalConflictMinor)}</dd>
          <strong>
            {commandCentreSnapshot.retirementGoalConflictMinor > 0
              ? "Review timing"
              : "No conflict"}
          </strong>
        </div>
      </dl>
    </section>
  );
}

function CpfHealthCard() {
  return (
    <section className="insight-card">
      <p className="eyebrow">CPF and reserve</p>
      <h2>
        CPF FRS{" "}
        {commandCentreSnapshot.cpfFullRetirementSumAge
          ? `age ${commandCentreSnapshot.cpfFullRetirementSumAge}`
          : "needs review"}
      </h2>
      <div className="split-stat">
        <div>
          <span>Emergency reserve</span>
          <strong>{commandCentreSnapshot.emergencyReserveMonths} months</strong>
        </div>
        <div>
          <span>FIRE ready</span>
          <strong>Age {commandCentreSnapshot.fireReadyAge ?? "n/a"}</strong>
        </div>
      </div>
    </section>
  );
}

function WanderGuideCard({ onStartSetup }: { onStartSetup: () => void }) {
  return (
    <section className="insight-card wander-guide-card">
      <div className="guide-orb small" aria-hidden="true">
        <span />
      </div>
      <p className="eyebrow">Wander Guide</p>
      <h2>Build your FIRE profile</h2>
      <p>
        Answer guided question bundles for timeline, assets, CPF, goals, and risk comfort. Voice and
        cloud AI stay out until the final release step.
      </p>
      <button className="primary-action full" onClick={onStartSetup} type="button">
        Start guided setup
      </button>
    </section>
  );
}

function WanderGuideOnboarding({
  onboardingState,
  setOnboardingState,
}: {
  onboardingState: ReturnType<typeof createInitialOnboardingState>;
  setOnboardingState: (state: ReturnType<typeof createInitialOnboardingState>) => void;
}) {
  const section = getCurrentSection(onboardingState);
  const progress = calculateOnboardingProgress(onboardingState);
  const review = buildPlannerSetupReview(onboardingState);

  return (
    <section className="onboarding-surface" aria-labelledby="onboarding-title">
      <aside className="guide-panel">
        <div className="guide-orb thinking" aria-hidden="true">
          <span />
        </div>
        <p className="eyebrow">Relational setup</p>
        <h2 id="onboarding-title">Wander Guide</h2>
        <p>{section.guidePrompt}</p>
        <div className="guide-progress" aria-label="Onboarding progress">
          <span>
            Step {progress.completedSections + 1} of {progress.totalSections}
          </span>
          <strong>{Math.round(progress.confidenceScore * 100)}% confidence</strong>
        </div>
      </aside>

      <section className="question-card" aria-labelledby="question-card-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Guided setup</p>
            <h2 id="question-card-title">{section.title}</h2>
          </div>
          <span>
            {progress.requiredAnswered}/{progress.requiredTotal} required
          </span>
        </div>

        {section.id === "preview" ? (
          <PlannerSetupReviewCard review={review} />
        ) : (
          <div className="question-grid">
            {section.questions.map((question) => (
              <OnboardingQuestionField
                key={question.id}
                onChange={(value) =>
                  setOnboardingState(answerOnboardingQuestion(onboardingState, question.id, value))
                }
                question={question}
                value={onboardingState.answers[question.id]}
              />
            ))}
          </div>
        )}

        <div className="onboarding-actions">
          {section.id !== "preview" && (
            <button
              className="secondary-action"
              onClick={() => setOnboardingState(skipCurrentSection(onboardingState))}
              type="button"
            >
              Skip for now
            </button>
          )}
          <button
            className="primary-action"
            onClick={() => setOnboardingState(completeCurrentSection(onboardingState))}
            type="button"
          >
            {section.id === "preview" ? "Review complete" : "Continue"}
          </button>
        </div>
      </section>
    </section>
  );
}

function OnboardingQuestionField({
  question,
  value,
  onChange,
}: {
  question: OnboardingQuestion;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
}) {
  return (
    <label className="question-field">
      <span>
        {question.label}
        {question.required ? " *" : ""}
      </span>
      {question.type === "select" ? (
        <select
          aria-label={question.label}
          onChange={(event) => onChange(event.target.value)}
          value={value ?? ""}
        >
          <option value="">Choose one</option>
          {question.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-label={question.label}
          inputMode={question.type === "text" ? "text" : "decimal"}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.type === "money" ? "SGD amount" : undefined}
          type={question.type === "text" ? "text" : "number"}
          value={value ?? ""}
        />
      )}
      <small>{question.helper}</small>
      <button className="why-link" type="button">
        Why am I being asked this?
      </button>
    </label>
  );
}

function PlannerSetupReviewCard({
  review,
}: {
  review: ReturnType<typeof buildPlannerSetupReview>;
}) {
  return (
    <div className="planner-review-card">
      <h3>Structured plan preview</h3>
      <dl>
        <div>
          <dt>Timeline</dt>
          <dd>
            Age {review.timeline.currentAge ?? "?"} to {review.timeline.targetRetirementAge ?? "?"}
          </dd>
        </div>
        <div>
          <dt>Annual income</dt>
          <dd>{formatMinor(review.annualIncomeMinor)}</dd>
        </div>
        <div>
          <dt>Monthly savings</dt>
          <dd>{formatMinor(review.monthlySavingsMinor)}</dd>
        </div>
        <div>
          <dt>CPF total</dt>
          <dd>{formatMinor(review.cpfTotalMinor)}</dd>
        </div>
      </dl>
      {review.missingRequiredQuestionIds.length > 0 ? (
        <p>{review.missingRequiredQuestionIds.length} required answers still need review.</p>
      ) : (
        <p>Ready to save into the planner model after final confirmation.</p>
      )}
    </div>
  );
}

function MilesOverviewCard() {
  return (
    <section className="insight-card">
      <p className="eyebrow">Miles overview</p>
      <div className="split-stat">
        <div>
          <span>Redeemable</span>
          <strong>72,000 miles</strong>
        </div>
        <div>
          <span>Next chunk</span>
          <strong>S$184</strong>
        </div>
      </div>
      <div className="progress-track" aria-label="72,000 of 82,000 miles">
        <span style={{ width: "78%" }} />
      </div>
      <div className="card-callout">
        <span>Best card now</span>
        <strong>Citi Rewards</strong>
        <p>Online Shopping (MCC 5812), 4 miles per S$1</p>
      </div>
    </section>
  );
}

function ExpenseSnapshotCard() {
  return (
    <section className="insight-card">
      <p className="eyebrow">Expense snapshot</p>
      <h2>S$4,230</h2>
      <div className="stacked-bar" aria-label="Expense category split">
        {spendBreakdown.map((item) => (
          <span key={item.label}>{item.value}</span>
        ))}
      </div>
      <ul className="spend-list">
        {spendBreakdown.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardsSurface({
  plannerApplied,
  onApplyPlanner,
}: {
  plannerApplied: boolean;
  onApplyPlanner: () => void;
}) {
  const [savedPurchase, setSavedPurchase] = useState(false);

  return (
    <div className="secondary-surface">
      <section className="insight-card wide">
        <p className="eyebrow">Cards & miles</p>
        <h2>72,000 redeemable miles</h2>
        <div className="score-grid">
          <article>
            <span>Earned</span>
            <strong>18,450</strong>
          </article>
          <article>
            <span>Pending</span>
            <strong>7,240</strong>
          </article>
          <article>
            <span>Reversed</span>
            <strong>-1,200</strong>
          </article>
          <article>
            <span>Missed</span>
            <strong>860</strong>
          </article>
        </div>
      </section>

      <section className="insight-card wide" aria-label="Plan a purchase">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Plan a purchase</p>
            <h2>Haidilao, S$120, contactless</h2>
          </div>
          <button className="primary-action" onClick={() => setSavedPurchase(true)} type="button">
            {savedPurchase ? "Saved" : "Save planned purchase"}
          </button>
        </div>
        <ol className="ranked-cards">
          <li>
            <strong>HSBC Revolution</strong>
            <span>480 miles, S$880 cap left</span>
          </li>
          <li>
            <strong>UOB Lady's</strong>
            <span>480 miles, dining category selected</span>
          </li>
          <li>
            <strong>DBS Woman's World</strong>
            <span>48 miles, offline spend warning</span>
          </li>
        </ol>
      </section>

      <section className="insight-card wide">
        <p className="eyebrow">Recoverable leakage</p>
        <h2>600 miles can still be fixed</h2>
        <button className="primary-action" onClick={onApplyPlanner} type="button">
          {plannerApplied ? "Planner synced" : "Apply to planner"}
        </button>
      </section>
    </div>
  );
}

function PlannerSurface({
  preview,
  plannerApplied,
}: {
  preview: ImpactPreview;
  plannerApplied: boolean;
}) {
  return (
    <div className="secondary-surface">
      <section className="insight-card wide">
        <p className="eyebrow">Planner</p>
        <h2>{plannerApplied ? "Current month applied" : "Waiting for selected changes"}</h2>
        <dl className="score-grid">
          <div>
            <dt>Monthly net spend</dt>
            <dd>{formatSignedMoney(preview.monthlyNetSpendDeltaMinor)}</dd>
          </div>
          <div>
            <dt>Annual expenses</dt>
            <dd>{formatSignedMoney(preview.annualizedExpensesDeltaMinor)}</dd>
          </div>
          <div>
            <dt>FI age</dt>
            <dd>{preview.fiAgeDelta ?? "n/a"}</dd>
          </div>
          <div>
            <dt>Miles</dt>
            <dd>{preview.milesDelta}</dd>
          </div>
        </dl>
      </section>
      <CorrectionPanel />
    </div>
  );
}

function ReportsSurface() {
  return (
    <div className="reports-surface" aria-label="FIRE charts and reports">
      <section className="insight-card wide report-summary-card">
        <p className="eyebrow">Reports</p>
        <h2>FIRE journey report</h2>
        <div className="score-grid">
          {fireChartsReport.reportCards.map((card) => (
            <article key={card.id}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <ReportChartCard section={fireChartsReport.fireTrajectory} />
      <ReportChartCard section={fireChartsReport.fireGap} />
      <ReportChartCard section={fireChartsReport.retirementSpending} />
      <ReportChartCard section={fireChartsReport.cpfTrajectory} />
      <ReportChartCard section={fireChartsReport.goalFunding} />

      <section className="insight-card report-chart-card">
        <p className="eyebrow">Asset buckets</p>
        <h2>Current wealth mix</h2>
        <div className="asset-bucket-bars">
          {fireChartsReport.assetBuckets.map((bucket) => (
            <div key={bucket.label}>
              <span>{bucket.label}</span>
              <strong>{formatMinor(bucket.valueMinor)}</strong>
              <div className={`report-bar ${bucket.tone}`}>
                <i style={{ width: `${bucket.percent}%` }} />
              </div>
              <small>{bucket.percent}%</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportChartCard({ section }: { section: FireReportSection }) {
  const maxValue = Math.max(
    1,
    ...section.points.map((point) => point.secondaryValueMinor ?? point.valueMinor),
  );

  return (
    <section className="insight-card report-chart-card">
      <p className="eyebrow">{section.title}</p>
      <h2>{section.summary}</h2>
      <div className="report-bars" role="img" aria-label={`${section.title} chart`}>
        {section.points.slice(0, 8).map((point) => (
          <div key={`${section.id}-${point.label}`}>
            <span>{point.label}</span>
            <div className="report-bar">
              <i style={{ width: `${Math.min(100, (point.valueMinor / maxValue) * 100)}%` }} />
              {point.secondaryValueMinor !== undefined ? (
                <b
                  style={{
                    left: `${Math.min(100, (point.secondaryValueMinor / maxValue) * 100)}%`,
                  }}
                />
              ) : null}
            </div>
            <strong>{formatMinor(point.valueMinor)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function MobileShell({
  activeTab,
  setActiveTab,
  plannerApplied,
  onApplyPlanner,
}: {
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
  plannerApplied: boolean;
  onApplyPlanner: () => void;
}) {
  return (
    <section className="mobile-shell" aria-label="Wander mobile app">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">Wander</p>
          <h1>{commandCentreSnapshot.fireProgressPercent}% to financial independence</h1>
        </div>
        <span aria-label="Profile score">92</span>
      </header>

      <div className="mobile-content">
        {activeTab === "home" && (
          <MobileHome plannerApplied={plannerApplied} onApplyPlanner={onApplyPlanner} />
        )}
        {activeTab === "cards" && <MobileCards />}
        {activeTab === "plan" && (
          <MobilePlaceholder title="Plan" copy="Scenario impact is ready." />
        )}
        {activeTab === "transactions" && (
          <MobilePlaceholder title="Transactions" copy="7 imported rows need a quick review." />
        )}
        {activeTab === "profile" && (
          <MobilePlaceholder title="Profile" copy="Local data and card settings live here." />
        )}
      </div>

      <nav className="bottom-tabs" aria-label="Mobile tabs">
        {mobileTabs.map((tab) => (
          <button
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <span>{tab.shortLabel}</span>
            {tab.badge ? <strong aria-label={`${tab.badge} pending`}>{tab.badge}</strong> : null}
          </button>
        ))}
      </nav>
    </section>
  );
}

function MobileHome({
  plannerApplied,
  onApplyPlanner,
}: {
  plannerApplied: boolean;
  onApplyPlanner: () => void;
}) {
  return (
    <section className="mobile-panel">
      <div className="mobile-score-card">
        <span>FI progress</span>
        <strong>{commandCentreSnapshot.fireProgressPercent}%</strong>
        <div
          className="progress-track"
          aria-label={`${commandCentreSnapshot.fireProgressPercent} percent complete`}
        >
          <span style={{ width: `${Math.min(100, commandCentreSnapshot.fireProgressPercent)}%` }} />
        </div>
        <p>
          FIRE ready age {commandCentreSnapshot.fireReadyAge ?? "n/a"}; reserve{" "}
          {commandCentreSnapshot.emergencyReserveMonths} months.
        </p>
      </div>

      <section className="mobile-actions" aria-label="Priority actions">
        <button onClick={onApplyPlanner} type="button">
          {plannerApplied ? "Planner updated" : "Apply this month to planner"}
        </button>
        <article>
          <strong>{commandCentreAdvisorPlan.insights[0]?.title ?? "Review imported rows"}</strong>
          <p>{commandCentreSnapshot.topAdvisorAction}</p>
        </article>
        <article>
          <strong>S$184 to next miles chunk</strong>
          <p>Citi Rewards is best for the next online shop.</p>
        </article>
      </section>
    </section>
  );
}

function MobileCards() {
  return (
    <section className="mobile-panel">
      <div className="mobile-score-card gold">
        <span>Redeemable</span>
        <strong>72,000 miles</strong>
        <p>S$184 to next 10k transfer chunk.</p>
      </div>
      <article className="mobile-action-card">
        <strong>Best card now: Citi Rewards</strong>
        <p>Online Shopping, MCC 5812, 4 miles per S$1.</p>
      </article>
    </section>
  );
}

function MobilePlaceholder({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="mobile-panel">
      <article className="mobile-action-card">
        <h2>{title}</h2>
        <p>{copy}</p>
      </article>
    </section>
  );
}

function CorrectionPanel() {
  const [field, setField] = useState<CorrectionField>("category");
  const [nextValue, setNextValue] = useState("category_shopping");
  const [createHeuristic, setCreateHeuristic] = useState(true);
  const [message, setMessage] = useState("No correction saved yet.");
  const triggerPreview = useMemo(
    () =>
      applyCorrectionDraft(sampleReviewTransaction, {
        transactionId: sampleReviewTransaction.id,
        field,
        nextValue: field === "miles_eligibility" ? nextValue === "true" : nextValue,
        createHeuristic,
        correctedAt: "2026-06-26T00:00:00.000Z",
      }),
    [createHeuristic, field, nextValue],
  );

  return (
    <form
      className="correction-panel"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(
          `Saved ${triggerPreview.correction.field} correction; triggers ${triggerPreview.recalculationTriggers.join(", ")}.`,
        );
      }}
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Correction loop</p>
          <h2>Teach future imports</h2>
        </div>
        <button className="primary-action" type="submit">
          Save correction
        </button>
      </div>
      <div className="form-grid">
        <label>
          Correction
          <select
            aria-label="Correction"
            onChange={(event) => {
              const selectedField = event.target.value as CorrectionField;
              setField(selectedField);
              setNextValue(selectedField === "miles_eligibility" ? "false" : "category_shopping");
            }}
            value={field}
          >
            {correctionFields.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          New value
          <input
            aria-label="New value"
            onChange={(event) => setNextValue(event.target.value)}
            value={nextValue}
          />
        </label>
        <label className="checkbox-field">
          <input
            checked={createHeuristic}
            onChange={(event) => setCreateHeuristic(event.target.checked)}
            type="checkbox"
          />
          Create future rule
        </label>
      </div>
      <p aria-live="polite">{message}</p>
    </form>
  );
}

function WhyThisDrawer({ onClose }: { onClose: () => void }) {
  return (
    <aside className="why-drawer" aria-label="Why this explanation">
      <div>
        <p className="eyebrow">Why this?</p>
        <h2>Refund reversal</h2>
        <p>
          Merchant alias, MCC 5812, equal opposite amount, and adjacent statement date linked the
          refund to the original Shopee charge.
        </p>
      </div>
      <dl>
        <div>
          <dt>Rules fired</dt>
          <dd>refund_matcher, trust_score, reward_reversal</dd>
        </div>
        <div>
          <dt>Caveats</dt>
          <dd>Statement balances were unavailable, so reconciliation confidence is capped.</dd>
        </div>
      </dl>
      <button className="primary-action" onClick={onClose} type="button">
        Close
      </button>
    </aside>
  );
}

function formatSignedMoney(amountMinor: number): string {
  const sign = amountMinor > 0 ? "+" : amountMinor < 0 ? "-" : "";
  return `${sign}S$${Math.abs(amountMinor / 100).toLocaleString("en-SG", {
    maximumFractionDigits: 0,
  })}`;
}

function formatMinor(amountMinor: number | undefined): string {
  if (amountMinor === undefined) return "Not provided";

  return `S$${(amountMinor / 100).toLocaleString("en-SG", {
    maximumFractionDigits: 0,
  })}`;
}
