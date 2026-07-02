import { useMemo, useState } from "react";

import { buildCommandCentreSnapshot } from "../planner/commandCentreDashboard";
import { buildFireChartsReport, type FireReportSection } from "../planner/fireChartsReports";
import { planGoalGaps, type GoalInput } from "../planner/goalGapPlanner";
import { runSingaporeStressTests } from "../planner/singaporeStressTesting";
import { projectSingaporeFire, type SingaporeFireInput } from "../planner/singaporeFireEngine";
import { applyCorrectionDraft, type CorrectionField } from "../review/correctionWorkflow";
import { calculateImpactPreview, type ImpactPreview } from "../review/impactPreview";
import type { ReviewTransaction } from "../review/reviewInboxModel";
import {
  answerOnboardingQuestion,
  buildPlannerSetupReview,
  calculateOnboardingProgress,
  createInitialOnboardingState,
  getCurrentSection,
  onboardingSections,
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
  home: "Overview",
  cards: "Cards & miles",
  desktop: "Planner",
  reports: "Reports",
};

const desktopNavItems: Array<{
  surface: ProductSurface;
  label: string;
  badge?: string;
}> = [
  { surface: "home", label: "Overview" },
  { surface: "home", label: "Review Inbox", badge: "12" },
  { surface: "cards", label: "Miles", badge: "2" },
  { surface: "desktop", label: "Planner" },
  { surface: "reports", label: "Reports" },
];

const reviewTabs = [
  "Needs decision",
  "Low confidence",
  "Refunds",
  "Miles leakage",
  "Done",
] as const;

type ReviewTab = (typeof reviewTabs)[number];

const onboardingStages: Array<{
  id: "life" | "money" | "assumptions";
  title: string;
  subtitle: string;
  anchorSectionId: ReturnType<typeof createInitialOnboardingState>["currentSectionId"];
  questionIds: string[];
}> = [
  {
    id: "life",
    title: "Your life",
    subtitle: "Goals and lifestyle",
    anchorSectionId: "timeline",
    questionIds: ["currentAge", "targetRetirementAge", "monthlyRetirementSpend", "primaryGoal"],
  },
  {
    id: "money",
    title: "Your money",
    subtitle: "What you have today",
    anchorSectionId: "money_today",
    questionIds: ["liquidAssets", "cpfOa", "cpfSa", "cpfMa", "propertyEquity", "debtBalance"],
  },
  {
    id: "assumptions",
    title: "Your assumptions",
    subtitle: "Future choices and expectations",
    anchorSectionId: "risk",
    questionIds: ["portfolioStyle", "withdrawalStrategy", "annualIncome", "monthlySavings"],
  },
];

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
    action: "Confirm",
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
    action: "Match refund",
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
    action: "Confirm",
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
    action: "Confirm",
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
    action: "Edit",
    tone: "review",
  },
];

type ReviewRow = (typeof transactions)[number] & {
  id: string;
  resolved: boolean;
};

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
const stressTestReport = runSingaporeStressTests({ baseInput: commandCentreFireInput });

export function App() {
  const activeTab = useAppShellStore((state) => state.activeTab);
  const setActiveTab = useAppShellStore((state) => state.setActiveTab);
  const activeSurface = useAppShellStore((state) => state.activeSurface);
  const setActiveSurface = useAppShellStore((state) => state.setActiveSurface);
  const [onboardingState, setOnboardingState] = useState(createInitialOnboardingState);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [plannerApplied, setPlannerApplied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toolbarStatus, setToolbarStatus] = useState("All synced just now");

  return (
    <main className="app-frame">
      <DesktopShell
        activeSurface={activeSurface}
        onboardingOpen={onboardingOpen}
        onApplyPlanner={() => setPlannerApplied(true)}
        onCloseOnboarding={() => setOnboardingOpen(false)}
        onReviewAll={() => setToolbarStatus("All review rows marked reviewed")}
        onStartOnboarding={() => setOnboardingOpen(true)}
        plannerApplied={plannerApplied}
        searchQuery={searchQuery}
        setActiveSurface={setActiveSurface}
        setSearchQuery={setSearchQuery}
        setToolbarStatus={setToolbarStatus}
        onboardingState={onboardingState}
        setOnboardingState={setOnboardingState}
        toolbarStatus={toolbarStatus}
      />
      <MobileShell
        activeTab={activeTab}
        onApplyPlanner={() => setPlannerApplied(true)}
        plannerApplied={plannerApplied}
        setActiveTab={setActiveTab}
      />
    </main>
  );
}

function DesktopShell({
  activeSurface,
  setActiveSurface,
  onboardingOpen,
  plannerApplied,
  onApplyPlanner,
  onReviewAll,
  onStartOnboarding,
  onCloseOnboarding,
  searchQuery,
  setSearchQuery,
  setToolbarStatus,
  onboardingState,
  setOnboardingState,
  toolbarStatus,
}: {
  activeSurface: ProductSurface;
  setActiveSurface: (surface: ProductSurface) => void;
  onboardingOpen: boolean;
  plannerApplied: boolean;
  onApplyPlanner: () => void;
  onReviewAll: () => void;
  onStartOnboarding: () => void;
  onCloseOnboarding: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setToolbarStatus: (status: string) => void;
  onboardingState: ReturnType<typeof createInitialOnboardingState>;
  setOnboardingState: (state: ReturnType<typeof createInitialOnboardingState>) => void;
  toolbarStatus: string;
}) {
  function handleNavClick(item: (typeof desktopNavItems)[number]) {
    setActiveSurface(item.surface);
    if (item.label === "Review Inbox") {
      window.requestAnimationFrame(() => {
        document.getElementById("review-inbox")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }

  return (
    <section className="desktop-shell" aria-label="Wander desktop app">
      <aside className="desktop-sidebar" aria-label="Desktop navigation">
        <div>
          <p className="brand">Wander</p>
          <p className="eyebrow">Local-first FIRE</p>
        </div>
        <nav aria-label="Workspace sections">
          {desktopNavItems.map((item) => (
            <button
              aria-current={
                activeSurface === item.surface &&
                (item.surface !== "home" || item.label === "Overview")
                  ? "page"
                  : undefined
              }
              className={
                activeSurface === item.surface &&
                (item.surface !== "home" || item.label === "Overview")
                  ? "active"
                  : ""
              }
              key={item.label}
              onClick={() => handleNavClick(item)}
              type="button"
            >
              <span>{item.label}</span>
              {item.badge ? <strong>{item.badge}</strong> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-sync-card">
          <span>All synced</span>
          <strong>Just now</strong>
        </div>
      </aside>

      <section className="desktop-workspace">
        <header className="desktop-topbar">
          <h1>{activeSurface === "home" ? "Dashboard" : surfaceLabels[activeSurface]}</h1>
          <label className="topbar-search">
            <span>Search</span>
            <input
              aria-label="Search merchant, note, card, MCC, or refund"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search merchant, note, card, MCC, or refund"
              value={searchQuery}
            />
            <strong>Ctrl K</strong>
          </label>
          <div className="topbar-actions">
            <button
              onClick={() => setToolbarStatus("Help opened for dashboard workflows")}
              type="button"
            >
              Help
            </button>
            <button
              aria-label="Notifications"
              onClick={() => setToolbarStatus("No new alerts")}
              type="button"
            >
              Alerts
            </button>
            <button
              aria-label="Settings"
              onClick={() => setToolbarStatus("Settings are ready for local data controls")}
              type="button"
            >
              Settings
            </button>
          </div>
          <p className="topbar-status" role="status">
            {toolbarStatus}
          </p>
        </header>

        {activeSurface === "home" && (
          <DashboardSurface
            onStartSetup={onStartOnboarding}
            onReviewAll={onReviewAll}
            plannerApplied={plannerApplied}
            searchQuery={searchQuery}
            setToolbarStatus={setToolbarStatus}
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
      {onboardingOpen && (
        <WanderGuideOnboarding
          onboardingState={onboardingState}
          onClose={onCloseOnboarding}
          setOnboardingState={setOnboardingState}
        />
      )}
    </section>
  );
}

function DashboardSurface({
  plannerApplied,
  onStartSetup,
  onReviewAll,
  searchQuery,
  setToolbarStatus,
}: {
  plannerApplied: boolean;
  onStartSetup: () => void;
  onReviewAll: () => void;
  searchQuery: string;
  setToolbarStatus: (status: string) => void;
}) {
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>(() =>
    transactions.map((transaction, index) => ({
      ...transaction,
      id: `${transaction.date}-${transaction.merchant}-${index}`,
      resolved: false,
    })),
  );
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTab>("Needs decision");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState("14 May-Amazon SG-4");
  const [explanationOpen, setExplanationOpen] = useState(true);
  const [newestFirst, setNewestFirst] = useState(true);
  const [dateFilter, setDateFilter] = useState("All");
  const [accountFilter, setAccountFilter] = useState("All");
  const [cardFilter, setCardFilter] = useState("All");

  const pendingCount = reviewRows.filter((row) => !row.resolved).length;
  const selectedReview = reviewRows.find((row) => row.id === selectedReviewId) ?? reviewRows[0];
  const visibleReviewRows = reviewRows
    .filter((row) => matchesReviewTab(row, activeReviewTab))
    .filter((row) => matchesControlFilters(row, dateFilter, accountFilter, cardFilter))
    .filter((row) => matchesReviewSearch(row, searchQuery))
    .sort((left, right) => (newestFirst ? 0 : left.date.localeCompare(right.date)));
  const allVisibleSelected =
    visibleReviewRows.length > 0 &&
    visibleReviewRows.every((row) => selectedRowIds.includes(row.id));

  function updateRow(rowId: string, updates: Partial<ReviewRow>) {
    setReviewRows((rows) => rows.map((row) => (row.id === rowId ? { ...row, ...updates } : row)));
  }

  function resolveRow(rowId: string, actionLabel: string) {
    updateRow(rowId, { resolved: true });
    setSelectedRowIds((ids) => ids.filter((id) => id !== rowId));
    setToolbarStatus(`${actionLabel} saved`);
  }

  function handleRowAction(row: ReviewRow) {
    setSelectedReviewId(row.id);
    setExplanationOpen(true);

    if (row.action === "Edit") {
      setToolbarStatus(`Reviewing ${row.merchant}`);
      return;
    }

    resolveRow(row.id, row.action);
  }

  function markAllReviewed() {
    setReviewRows((rows) => rows.map((row) => ({ ...row, resolved: true })));
    setSelectedRowIds([]);
    onReviewAll();
    setToolbarStatus("All review rows marked reviewed");
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedRowIds((ids) =>
        ids.filter((id) => !visibleReviewRows.some((row) => row.id === id)),
      );
      return;
    }

    setSelectedRowIds((ids) => [...new Set([...ids, ...visibleReviewRows.map((row) => row.id)])]);
  }

  function resolveSelected() {
    setReviewRows((rows) =>
      rows.map((row) => (selectedRowIds.includes(row.id) ? { ...row, resolved: true } : row)),
    );
    setToolbarStatus(`${selectedRowIds.length} selected rows confirmed`);
    setSelectedRowIds([]);
  }

  return (
    <div className="dashboard-grid">
      <CommandCentreHero plannerApplied={plannerApplied} />

      <section className="review-table-card" aria-labelledby="review-title" id="review-inbox">
        <div className="section-heading">
          <div>
            <h2 id="review-title">Review Inbox</h2>
            <span>{pendingCount} needs review</span>
          </div>
          <div className="table-tools">
            <button onClick={markAllReviewed} type="button">
              {pendingCount === 0 ? "Reviewed" : "Mark all reviewed"}
            </button>
          </div>
        </div>

        <div className="review-tabs" aria-label="Review inbox filters">
          {reviewTabs.map((tab) => (
            <button
              className={activeReviewTab === tab ? "active" : ""}
              key={tab}
              onClick={() => setActiveReviewTab(tab)}
              type="button"
            >
              {tab}
              <strong>{getReviewTabCount(reviewRows, tab)}</strong>
            </button>
          ))}
        </div>

        <div className="review-control-bar" aria-label="Review inbox controls">
          <label>
            <input checked={allVisibleSelected} onChange={toggleSelectAllVisible} type="checkbox" />
            <span>{selectedRowIds.length} selected</span>
          </label>
          <button onClick={toggleSelectAllVisible} type="button">
            {allVisibleSelected ? "Clear visible" : `Select all ${visibleReviewRows.length}`}
          </button>
          <button
            onClick={() => setDateFilter(cycleFilter(dateFilter, ["All", "18 May", "14 May"]))}
            type="button"
          >
            Date: {dateFilter}
          </button>
          <button
            onClick={() =>
              setAccountFilter(cycleFilter(accountFilter, ["All", "Citi", "DBS", "HSBC"]))
            }
            type="button"
          >
            Account: {accountFilter}
          </button>
          <button
            onClick={() =>
              setCardFilter(
                cycleFilter(cardFilter, ["All", "Citi Rewards", "DBS Altitude", "DBS WWMC"]),
              )
            }
            type="button"
          >
            Card: {cardFilter}
          </button>
          <button onClick={() => setToolbarStatus("More filters coming next")} type="button">
            More filters
          </button>
          <button onClick={() => setNewestFirst((value) => !value)} type="button">
            {newestFirst ? "Newest first" : "Oldest first"}
          </button>
        </div>

        {visibleReviewRows.length === 0 ? (
          <p className="review-search-hint">No results? Try different keywords or clear filters.</p>
        ) : null}

        <div className="review-inbox-layout">
          <table aria-label="Imported transaction review">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th>MCC & confidence</th>
                <th>Card</th>
                <th>Amount</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {visibleReviewRows.map((transaction) => (
                <tr
                  className={`${transaction.tone} ${transaction.resolved ? "resolved" : ""} ${
                    transaction.id === selectedReviewId ? "selected" : ""
                  }`}
                  key={transaction.id}
                  onClick={() => {
                    setSelectedReviewId(transaction.id);
                    setExplanationOpen(true);
                  }}
                >
                  <td>{transaction.date}</td>
                  <td>
                    <strong>{transaction.merchant}</strong>
                    <span>{transaction.note}</span>
                  </td>
                  <td>
                    <select
                      aria-label={`${transaction.merchant} category`}
                      className="category-select"
                      onChange={(event) =>
                        updateRow(transaction.id, { category: event.target.value })
                      }
                      value={transaction.category}
                    >
                      <option>Shopping</option>
                      <option>Groceries</option>
                      <option>Transport</option>
                      <option>Entertainment</option>
                      <option>Bills</option>
                    </select>
                  </td>
                  <td>
                    <strong>MCC {transaction.mcc}</strong>
                    <span>{transaction.confidence} confidence</span>
                    <small>
                      {transaction.status} · {transaction.miles}
                    </small>
                  </td>
                  <td>{transaction.card}</td>
                  <td>{transaction.amount}</td>
                  <td>
                    <button
                      className={transaction.tone === "review" ? "edit-action" : "reviewed-action"}
                      disabled={transaction.resolved}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRowAction(transaction);
                      }}
                      type="button"
                    >
                      {transaction.resolved ? "Done" : transaction.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {explanationOpen && selectedReview ? (
            <aside className="review-explain-panel" aria-label="Why this needs review">
              <div className="section-heading compact">
                <h3>Why this needs review</h3>
                <button
                  aria-label="Close review explanation"
                  onClick={() => setExplanationOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
              <span className="review-reason">
                {selectedReview.resolved ? "Reviewed" : getReviewReason(selectedReview)}
              </span>
              <p>{getReviewExplanation(selectedReview)}</p>
              <dl>
                <div>
                  <dt>Merchant</dt>
                  <dd>{selectedReview.merchant}</dd>
                </div>
                <div>
                  <dt>Detected</dt>
                  <dd>
                    MCC {selectedReview.mcc} · {selectedReview.confidence} confidence
                  </dd>
                </div>
                <div>
                  <dt>Why</dt>
                  <dd>{selectedReview.status}</dd>
                </div>
              </dl>
              <div className="future-rule-card">
                <strong>Creates future rule</strong>
                <p>Confirming remembers this for similar {selectedReview.merchant} transactions.</p>
              </div>
              <button
                className="primary-action full"
                disabled={selectedReview.resolved}
                onClick={() => {
                  updateRow(selectedReview.id, { category: "Shopping", resolved: true });
                  setToolbarStatus(`${selectedReview.merchant} confirmed as Shopping`);
                }}
                type="button"
              >
                Confirm as Shopping
              </button>
              <button
                className="secondary-action full"
                onClick={() => {
                  updateRow(selectedReview.id, { category: "Groceries" });
                  setToolbarStatus(`${selectedReview.merchant} category changed to Groceries`);
                }}
                type="button"
              >
                Choose different category
              </button>
              {selectedRowIds.length > 0 ? (
                <button className="secondary-action full" onClick={resolveSelected} type="button">
                  Confirm selected
                </button>
              ) : null}
            </aside>
          ) : null}
        </div>
      </section>

      <aside className="insight-column" aria-label="Insights">
        <WanderGuideCard onStartSetup={onStartSetup} />
        <AdvisorActionCard />
        <GoalGapCard />
        <CpfHealthCard />
        <MilesOverviewCard />
        <ExpenseSnapshotCard />
      </aside>
    </div>
  );
}

function matchesReviewSearch(row: ReviewRow, query: string) {
  if (query.trim() === "") return true;

  const haystack = [
    row.merchant,
    row.note,
    row.category,
    row.mcc,
    row.confidence,
    row.card,
    row.status,
    row.miles,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.trim().toLowerCase());
}

function matchesReviewTab(row: ReviewRow, tab: ReviewTab) {
  if (tab === "Done") return row.resolved;
  if (row.resolved) return false;
  if (tab === "Low confidence") return Number.parseInt(row.confidence, 10) < 80;
  if (tab === "Refunds") return row.tone === "refund";
  if (tab === "Miles leakage") return row.miles === "0 miles";
  return true;
}

function matchesControlFilters(row: ReviewRow, date: string, account: string, card: string) {
  const accountMatches = account === "All" || row.card.startsWith(account);
  const dateMatches = date === "All" || row.date === date;
  const cardMatches = card === "All" || row.card === card;

  return accountMatches && dateMatches && cardMatches;
}

function cycleFilter(currentValue: string, values: string[]) {
  const currentIndex = values.indexOf(currentValue);
  return values[(currentIndex + 1) % values.length] ?? values[0];
}

function getReviewTabCount(rows: ReviewRow[], tab: ReviewTab) {
  return rows.filter((row) => matchesReviewTab(row, tab)).length;
}

function getReviewReason(row: ReviewRow) {
  if (row.tone === "refund") return "Refund match";
  if (row.miles === "0 miles") return "Miles leakage";
  if (Number.parseInt(row.confidence, 10) < 80) return "Low confidence match";
  return "Ready to confirm";
}

function getReviewExplanation(row: ReviewRow) {
  if (row.tone === "refund") {
    return "This looks like a refund reversal and needs to be matched before miles and net spend are final.";
  }
  if (row.miles === "0 miles") {
    return "This transaction has no miles recorded, so Wander needs a card and eligibility check.";
  }
  if (Number.parseInt(row.confidence, 10) < 80) {
    return "Wander is not very confident about the merchant category for this transaction.";
  }
  return "This row has enough confidence to confirm and teach future imports.";
}

function CommandCentreHero({ plannerApplied }: { plannerApplied: boolean }) {
  return (
    <section className={`command-centre-hero ${commandCentreSnapshot.status}`}>
      <div className="command-hero-copy">
        <p className="eyebrow">FIRE command centre</p>
        <h2>{commandCentreSnapshot.fireProgressPercent}% to financial independence</h2>
        <p>
          {plannerApplied
            ? "Planner is synced to the current month."
            : commandCentreSnapshot.headline}
        </p>
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

function AdvisorActionCard() {
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
        Answer guided question bundles for timeline, assets, CPF, property, healthcare, and risk
        comfort. The answers tune the dashboard without taking you away from it.
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
  onClose,
}: {
  onboardingState: ReturnType<typeof createInitialOnboardingState>;
  setOnboardingState: (state: ReturnType<typeof createInitialOnboardingState>) => void;
  onClose: () => void;
}) {
  const section = getCurrentSection(onboardingState);
  const progress = calculateOnboardingProgress(onboardingState);
  const review = buildPlannerSetupReview(onboardingState);
  const currentStepIndex = Math.max(
    0,
    onboardingStages.findIndex((stage) => stage.anchorSectionId === section.id),
  );
  const currentStage = onboardingStages[currentStepIndex] ?? onboardingStages[0];
  const stageQuestions = currentStage.questionIds
    .map((questionId) => findOnboardingQuestion(questionId))
    .filter((question): question is OnboardingQuestion => question !== undefined);
  const progressPercent = Math.round(((currentStepIndex + 1) / onboardingStages.length) * 100);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === onboardingStages.length - 1;

  function goToStage(nextIndex: number) {
    const nextStage =
      onboardingStages[Math.max(0, Math.min(nextIndex, onboardingStages.length - 1))];
    setOnboardingState({
      ...onboardingState,
      currentSectionId: nextStage.anchorSectionId,
    });
  }

  return (
    <section className="modal-backdrop" aria-label="Wander Guide setup modal">
      <div
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <aside className="guide-panel">
          <div>
            <p className="eyebrow">Wander Guide</p>
            <h2 id="onboarding-title">Wander Guide</h2>
          </div>
          <ol className="onboarding-stage-list" aria-label="Onboarding stages">
            {onboardingStages.map((stage, index) => (
              <li
                className={
                  index === currentStepIndex ? "active" : index < currentStepIndex ? "done" : ""
                }
                key={stage.id}
              >
                <span>{index < currentStepIndex ? "Done" : index + 1}</span>
                <div>
                  <strong>{stage.title}</strong>
                  <p>{stage.subtitle}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="local-data-note">
            <strong>Data stays on this device</strong>
            <p>Your data is private and never leaves your device.</p>
          </div>
        </aside>

        <section className="question-card" aria-labelledby="question-card-title">
          <div className="onboarding-modal-header">
            <div className="modal-progress-wrap">
              <div className="modal-progress" aria-label={`${progressPercent}% setup progress`}>
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <span>
                Step {currentStepIndex + 1} of {onboardingStages.length}
              </span>
            </div>
            <strong>{Math.round(progress.confidenceScore * 100)}% plan confidence</strong>
            <button
              className="modal-close"
              onClick={onClose}
              type="button"
              aria-label="Close setup"
            >
              Close
            </button>
          </div>

          <div className="onboarding-stage-content">
            <div>
              <h2 id="question-card-title">
                {currentStage.id === "money" ? "Your money today" : currentStage.title}
              </h2>
              <p>
                {currentStage.id === "money"
                  ? "Tell us what you have now. Use your best estimate and refine it later."
                  : section.guidePrompt}
              </p>
            </div>
            <div className="profile-preview" aria-label="Planner setup preview">
              <span>Plan confidence</span>
              <strong>{Math.round(progress.confidenceScore * 100)}%</strong>
              <p>FI age estimate: {review.timeline.targetRetirementAge ?? "?"}</p>
            </div>
          </div>

          {currentStage.id === "assumptions" ? <PlannerSetupReviewCard review={review} /> : null}

          <div className="onboarding-field-list">
            {stageQuestions.map((question) => (
              <OnboardingStageField
                key={question.id}
                onChange={(value) =>
                  setOnboardingState(answerOnboardingQuestion(onboardingState, question.id, value))
                }
                question={question}
                value={onboardingState.answers[question.id]}
              />
            ))}
          </div>

          <p className="local-inline-note">
            These numbers are stored locally on your device and never shared.
          </p>

          <div className="onboarding-actions">
            <button
              className="secondary-action"
              disabled={isFirstStep}
              onClick={() => goToStage(currentStepIndex - 1)}
              type="button"
            >
              Back
            </button>
            <button
              className="secondary-action"
              onClick={() => (isLastStep ? onClose() : goToStage(currentStepIndex + 1))}
              type="button"
            >
              Skip for now
            </button>
            <button
              className="primary-action"
              onClick={() => (isLastStep ? onClose() : goToStage(currentStepIndex + 1))}
              type="button"
            >
              {isLastStep ? "Finish setup" : "Continue"}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function findOnboardingQuestion(questionId: string) {
  return onboardingSections
    .flatMap((candidate) => candidate.questions)
    .find((question) => question.id === questionId);
}

function OnboardingStageField({
  question,
  value,
  onChange,
}: {
  question: OnboardingQuestion;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
}) {
  return (
    <label className="onboarding-stage-field">
      <span aria-hidden="true">{question.label.slice(0, 1)}</span>
      <div>
        <strong>
          {question.label}
          {question.required ? " *" : ""}
        </strong>
        <small>{question.helper}</small>
      </div>
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
        <div className="currency-input">
          {question.type === "money" ? <b>SGD</b> : null}
          <input
            aria-label={question.label}
            inputMode={question.type === "text" ? "text" : "decimal"}
            onChange={(event) => onChange(event.target.value)}
            placeholder={question.type === "money" ? "0" : undefined}
            type="text"
            value={value ?? ""}
          />
        </div>
      )}
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
      <StressTestingPanel />
    </div>
  );
}

function StressTestingPanel() {
  return (
    <section className="insight-card wide" aria-label="Scenario stress testing">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Scenario and stress testing</p>
          <h2>{stressTestReport.summary}</h2>
        </div>
      </div>
      <div className="stress-grid">
        {stressTestReport.results.map((result) => (
          <article className={result.severity} key={result.scenario.id}>
            <span>{result.scenario.label}</span>
            <strong>
              {result.fireReadyAgeDelta === undefined
                ? "No FI date"
                : `${result.fireReadyAgeDelta >= 0 ? "+" : ""}${result.fireReadyAgeDelta} years`}
            </strong>
            <p>{result.recommendedAction}</p>
          </article>
        ))}
      </div>
    </section>
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
