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
  review: "Review Inbox",
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
  { surface: "review", label: "Review Inbox", badge: "12" },
  { surface: "cards", label: "Miles", badge: "2" },
  { surface: "desktop", label: "Planner" },
  { surface: "reports", label: "Reports" },
];

const reviewTabMeta = [
  { id: "Needs decision", icon: "clipboard" },
  { id: "Low confidence", icon: "warning" },
  { id: "Refunds", icon: "refund" },
  { id: "Miles leakage", icon: "plane" },
  { id: "Done", icon: "check" },
] as const;

type ReviewTab = (typeof reviewTabMeta)[number]["id"];
type ReviewIconId = (typeof reviewTabMeta)[number]["icon"] | "spark" | "sliders" | "dots";

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
    date: "18 May 2026",
    merchant: "Shopee SG",
    merchantMark: "S",
    merchantTone: "orange",
    note: "SHP-SG-123456",
    category: "Shopping",
    mcc: "5812",
    confidence: "91%",
    card: "Citi Rewards",
    cardNetwork: "Visa",
    cardLast4: "1234",
    cardTone: "blue",
    amount: "-128.90",
    status: "Eligible",
    miles: "+516 miles",
    action: "Confirm",
    tone: "eligible",
  },
  {
    date: "18 May 2026",
    merchant: "Shopee Refund",
    merchantMark: "S",
    merchantTone: "orange",
    note: "REF-SG-123456",
    category: "Shopping",
    mcc: "5812",
    confidence: "91%",
    card: "Citi Rewards",
    cardNetwork: "Visa",
    cardLast4: "1234",
    cardTone: "blue",
    amount: "+128.90",
    status: "Refund reversal",
    miles: "-516 miles",
    action: "Match refund",
    tone: "refund",
  },
  {
    date: "17 May 2026",
    merchant: "Cold Storage",
    merchantMark: "C",
    merchantTone: "green",
    note: "TAMPINES 1",
    category: "Groceries",
    mcc: "5422",
    confidence: "95%",
    card: "DBS WWMC",
    cardNetwork: "Mastercard",
    cardLast4: "8821",
    cardTone: "black",
    amount: "-86.45",
    status: "Eligible",
    miles: "+172 miles",
    action: "Confirm",
    tone: "eligible",
  },
  {
    date: "16 May 2026",
    merchant: "Spotify Pte. Ltd.",
    merchantMark: "Sp",
    merchantTone: "green",
    note: "SPOTIFY",
    category: "Entertainment",
    mcc: "5733",
    confidence: "96%",
    card: "HSBC Revolution",
    cardNetwork: "Visa",
    cardLast4: "8888",
    cardTone: "navy",
    amount: "-11.98",
    status: "Eligible",
    miles: "+22 miles",
    action: "Confirm",
    tone: "eligible",
  },
  {
    date: "14 May 2026",
    merchant: "Amazon SG",
    merchantMark: "a",
    merchantTone: "gold",
    note: "AMZN Mktp",
    category: "Shopping",
    mcc: "5942",
    confidence: "72%",
    card: "DBS Altitude",
    cardNetwork: "Visa",
    cardLast4: "4318",
    cardTone: "black",
    amount: "-499.00",
    status: "Check category",
    miles: "0 miles",
    action: "Fix miles",
    tone: "review",
  },
  {
    date: "13 May 2026",
    merchant: "Grab",
    merchantMark: "G",
    merchantTone: "green",
    note: "Taxi to office",
    category: "Transport",
    mcc: "4121",
    confidence: "95%",
    card: "UOB Preferred Platinum",
    cardNetwork: "Visa",
    cardLast4: "6612",
    cardTone: "black",
    amount: "-18.60",
    status: "Looks good",
    miles: "+74 miles",
    action: "Confirm",
    tone: "eligible",
  },
  {
    date: "12 May 2026",
    merchant: "SP Group",
    merchantMark: "SP",
    merchantTone: "blue",
    note: "Utilities",
    category: "Bills",
    mcc: "4900",
    confidence: "88%",
    card: "DBS Woman's World",
    cardNetwork: "Mastercard",
    cardLast4: "2408",
    cardTone: "black",
    amount: "-128.43",
    status: "Looks good",
    miles: "+128 miles",
    action: "Confirm",
    tone: "eligible",
  },
  {
    date: "11 May 2026",
    merchant: "Lazada",
    merchantMark: "L",
    merchantTone: "pink",
    note: "Order 987654321234",
    category: "Shopping",
    mcc: "5942",
    confidence: "68%",
    card: "Citi PremierMiles",
    cardNetwork: "Visa",
    cardLast4: "7201",
    cardTone: "blue",
    amount: "-210.00",
    status: "Miles leakage",
    miles: "0 miles",
    action: "Fix miles",
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

  function openOnboardingAtMoneyStep() {
    setOnboardingState((state) => ({
      ...state,
      currentSectionId: "money_today",
      completedSectionIds: [...new Set([...state.completedSectionIds, "timeline" as const])],
      answers: {
        liquidAssets: 25_000,
        cpfOa: 52_000,
        cpfSa: 68_000,
        cpfMa: 18_000,
        propertyEquity: 350_000,
        debtBalance: -25_000,
        ...state.answers,
      },
    }));
    setOnboardingOpen(true);
  }

  return (
    <main className="app-frame">
      <DesktopShell
        activeSurface={activeSurface}
        onboardingOpen={onboardingOpen}
        onApplyPlanner={() => setPlannerApplied(true)}
        onCloseOnboarding={() => setOnboardingOpen(false)}
        onReviewAll={() => setToolbarStatus("All review rows marked reviewed")}
        onStartOnboarding={openOnboardingAtMoneyStep}
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
            plannerApplied={plannerApplied}
            searchQuery={searchQuery}
            setActiveSurface={setActiveSurface}
            setToolbarStatus={setToolbarStatus}
          />
        )}
        {activeSurface === "review" && (
          <ReviewInboxSurface
            onReviewAll={onReviewAll}
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
  searchQuery,
  setActiveSurface,
  setToolbarStatus,
}: {
  plannerApplied: boolean;
  onStartSetup: () => void;
  searchQuery: string;
  setActiveSurface: (surface: ProductSurface) => void;
  setToolbarStatus: (status: string) => void;
}) {
  const dashboardSearchActive = searchQuery.trim().length > 0;

  function openReviewInbox() {
    setActiveSurface("review");
    setToolbarStatus("Review Inbox opened");
  }

  return (
    <div className="dashboard-grid">
      <CommandCentreHero plannerApplied={plannerApplied} />
      <WhatChangedStrip />

      <section className="dashboard-card-grid" aria-label="Dashboard guidance">
        <GoalGapCard />
        <CpfHealthCard />
        <ExpenseSnapshotCard />
        <MilesOverviewCard />
      </section>

      <aside className="insight-column" aria-label="Today and benchmark insights">
        <TodayActionsCard
          onOpenReviewInbox={openReviewInbox}
          onStartSetup={onStartSetup}
          searchActive={dashboardSearchActive}
        />
        <SingaporeBenchmarkCard />
        <WanderGuideCard onStartSetup={onStartSetup} />
        <AdvisorActionCard />
      </aside>
    </div>
  );
}

function ReviewInboxSurface({
  onReviewAll,
  searchQuery,
  setToolbarStatus,
}: {
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
  const [selectedReviewId, setSelectedReviewId] = useState("14 May 2026-Amazon SG-4");
  const [explanationOpen, setExplanationOpen] = useState(true);
  const [newestFirst, setNewestFirst] = useState(true);
  const [dateFilter, setDateFilter] = useState("All");
  const [accountFilter, setAccountFilter] = useState("All");
  const [cardFilter, setCardFilter] = useState("All");
  const [issueFilter, setIssueFilter] = useState("All");

  const pendingCount = reviewRows.filter((row) => !row.resolved).length;
  const selectedReview = reviewRows.find((row) => row.id === selectedReviewId) ?? reviewRows[0];
  const visibleReviewRows = reviewRows
    .filter((row) => matchesReviewTab(row, activeReviewTab))
    .filter((row) => matchesControlFilters(row, dateFilter, accountFilter, cardFilter, issueFilter))
    .filter((row) => matchesReviewSearch(row, searchQuery))
    .sort((left, right) =>
      newestFirst ? right.date.localeCompare(left.date) : left.date.localeCompare(right.date),
    );
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

    if (row.action === "Fix miles") {
      setToolbarStatus(`Checking miles eligibility for ${row.merchant}`);
      return;
    }

    if (getReviewReason(row) === "Low confidence match") {
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
    <div className="review-page">
      <section className="review-table-card review-workbench" aria-labelledby="review-title">
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
          {reviewTabMeta.map((tab) => (
            <button
              className={activeReviewTab === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => setActiveReviewTab(tab.id)}
              type="button"
            >
              <ReviewIcon icon={tab.icon} />
              <span>{tab.id}</span>
              <strong>{getReviewTabCount(reviewRows, tab.id)}</strong>
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
            onClick={() =>
              setDateFilter(cycleFilter(dateFilter, ["All", "18 May 2026", "14 May 2026"]))
            }
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
          <button
            onClick={() =>
              setIssueFilter(
                cycleFilter(issueFilter, ["All", "Low confidence", "Refund", "Miles leakage"]),
              )
            }
            type="button"
          >
            Issue: {issueFilter}
          </button>
          <button onClick={() => setToolbarStatus("Advanced filters opened")} type="button">
            <ReviewIcon icon="sliders" />
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
          <div className="review-table-scroll">
            <table aria-label="Imported transaction review">
              <thead>
                <tr>
                  <th aria-label="Select rows" />
                  <th>Merchant</th>
                  <th>Note</th>
                  <th>Category</th>
                  <th>MCC & confidence</th>
                  <th>Card</th>
                  <th>Amount</th>
                  <th>Action</th>
                  <th aria-label="More row actions" />
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
                    <td>
                      <input
                        aria-label={`Select ${transaction.merchant}`}
                        checked={selectedRowIds.includes(transaction.id)}
                        onChange={(event) => {
                          event.stopPropagation();
                          setSelectedRowIds((ids) =>
                            ids.includes(transaction.id)
                              ? ids.filter((id) => id !== transaction.id)
                              : [...ids, transaction.id],
                          );
                        }}
                        onClick={(event) => event.stopPropagation()}
                        type="checkbox"
                      />
                    </td>
                    <td>
                      <MerchantIdentity row={transaction} />
                    </td>
                    <td>
                      <span>{transaction.note}</span>
                      <small>{transaction.date}</small>
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
                    <td className={`confidence-cell ${getConfidenceTone(transaction)}`}>
                      <strong>MCC {transaction.mcc}</strong>
                      <span>
                        <i aria-hidden="true" /> {transaction.confidence} confidence
                      </span>
                      <small>
                        {transaction.status} · {transaction.miles}
                      </small>
                    </td>
                    <td>
                      <CardIdentity row={transaction} />
                    </td>
                    <td className={`amount-cell ${getAmountTone(transaction)}`}>
                      {formatReviewAmount(transaction.amount)}
                    </td>
                    <td>
                      <button
                        className={
                          transaction.tone === "review" ? "edit-action" : "reviewed-action"
                        }
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
                    <td>
                      <button
                        aria-label={`More actions for ${transaction.merchant}`}
                        className="icon-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setToolbarStatus(`More actions opened for ${transaction.merchant}`);
                        }}
                        type="button"
                      >
                        <ReviewIcon icon="dots" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                  <dt>Amount</dt>
                  <dd>{formatReviewAmount(selectedReview.amount)}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{selectedReview.date}</dd>
                </div>
                <div>
                  <dt>Card</dt>
                  <dd>
                    {selectedReview.card} ending {selectedReview.cardLast4}
                  </dd>
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
                  updateRow(selectedReview.id, { resolved: true });
                  setToolbarStatus(`${getPrimaryReviewAction(selectedReview)} saved`);
                }}
                type="button"
              >
                {getPrimaryReviewAction(selectedReview)}
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
              <button
                className="link-action"
                onClick={() => setToolbarStatus(`${selectedReview.merchant} skipped for now`)}
                type="button"
              >
                Not sure? Skip for now
              </button>
              {selectedRowIds.length > 0 ? (
                <button className="secondary-action full" onClick={resolveSelected} type="button">
                  Confirm selected
                </button>
              ) : null}
            </aside>
          ) : null}
        </div>

        <div className="review-bulk-footer" aria-label="Bulk review actions">
          <span>{selectedRowIds.length} selected</span>
          <button disabled={selectedRowIds.length === 0} onClick={resolveSelected} type="button">
            Confirm selected
          </button>
          <button
            disabled={selectedRowIds.length === 0}
            onClick={() => setToolbarStatus(`${selectedRowIds.length} selected rows ready to edit`)}
            type="button"
          >
            Edit selected
          </button>
          <button
            disabled={selectedRowIds.length === 0}
            onClick={() =>
              setToolbarStatus(`${selectedRowIds.length} selected rows queued for refund matching`)
            }
            type="button"
          >
            Match refunds
          </button>
          <button
            disabled={selectedRowIds.length === 0}
            onClick={() =>
              setToolbarStatus(`${selectedRowIds.length} selected rows queued for miles review`)
            }
            type="button"
          >
            Resolve miles leakage
          </button>
        </div>
      </section>
      <CorrectionPanel />
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

function WhatChangedStrip() {
  const changes = [
    { label: "Net worth", value: "+S$18,400", detail: "Since last import", tone: "good" },
    { label: "Spending", value: "-S$236", detail: "Month to date", tone: "good" },
    { label: "Income", value: "+S$4,800", detail: "Salary posted", tone: "good" },
    { label: "Savings rate", value: "61%", detail: "+4pp this month", tone: "good" },
  ];

  return (
    <section className="what-changed-strip" aria-label="What changed since last import">
      <div>
        <ReviewIcon icon="spark" />
        <strong>What changed</strong>
        <span>Since your last import at 9:15 AM</span>
      </div>
      {changes.map((change) => (
        <article className={change.tone} key={change.label}>
          <span>{change.label}</span>
          <strong>{change.value}</strong>
          <small>{change.detail}</small>
        </article>
      ))}
    </section>
  );
}

function TodayActionsCard({
  onOpenReviewInbox,
  onStartSetup,
  searchActive,
}: {
  onOpenReviewInbox: () => void;
  onStartSetup: () => void;
  searchActive: boolean;
}) {
  return (
    <section className="insight-card today-actions-card" aria-label="Today's actions">
      <div className="section-title-row">
        <h2>Today's actions</h2>
        <strong>4</strong>
      </div>
      <button onClick={onStartSetup} type="button">
        <span className="action-icon bank" aria-hidden="true">
          $
        </span>
        <div>
          <strong>Complete FIRE profile</strong>
          <small>CPF, property, and assumptions</small>
        </div>
      </button>
      <button onClick={onOpenReviewInbox} type="button">
        <span className="action-icon inbox" aria-hidden="true">
          !
        </span>
        <div>
          <strong>Review flagged items</strong>
          <small>12 transactions need a decision</small>
        </div>
      </button>
      <button onClick={onOpenReviewInbox} type="button">
        <span className="action-icon miles" aria-hidden="true">
          +
        </span>
        <div>
          <strong>Recover miles leakage</strong>
          <small>Check card eligibility and MCCs</small>
        </div>
      </button>
      <button onClick={onOpenReviewInbox} type="button">
        <span className="action-icon search" aria-hidden="true">
          /
        </span>
        <div>
          <strong>{searchActive ? "Review filtered results" : "Search transactions"}</strong>
          <small>Merchant, note, card, MCC, refund</small>
        </div>
      </button>
    </section>
  );
}

function SingaporeBenchmarkCard() {
  return (
    <section className="insight-card benchmark-card" aria-label="Singapore benchmark">
      <p className="eyebrow">Singapore benchmark</p>
      <h2>Compare by cohort, not friends</h2>
      <p>
        Show progress against Singapore median income, savings rate, CPF balance, and household
        net-worth bands for your age group.
      </p>
      <dl>
        <div>
          <dt>Age cohort</dt>
          <dd>35-44</dd>
        </div>
        <div>
          <dt>Comparison basis</dt>
          <dd>National averages</dd>
        </div>
        <div>
          <dt>Data status</dt>
          <dd>Official-source mapping needed</dd>
        </div>
      </dl>
      <button className="secondary-action full" type="button">
        See benchmark detail
      </button>
    </section>
  );
}

function MerchantIdentity({ row }: { row: ReviewRow }) {
  return (
    <div className="merchant-identity">
      <img
        alt={`${row.merchant} logo`}
        height="34"
        src={buildBadgeImage(row.merchantMark, getMerchantPalette(row.merchantTone))}
        width="34"
      />
      <div>
        <strong>{row.merchant}</strong>
        <span>{getReviewReason(row)}</span>
      </div>
    </div>
  );
}

function CardIdentity({ row }: { row: ReviewRow }) {
  return (
    <div className="card-identity">
      <img
        alt={`${row.card} card image`}
        height="34"
        src={buildCardImage(row.card, row.cardTone)}
        width="54"
      />
      <div>
        <strong>{row.card}</strong>
        <span>
          {row.cardNetwork} ending {row.cardLast4}
        </span>
      </div>
    </div>
  );
}

function ReviewIcon({ icon }: { icon: ReviewIconId }) {
  const paths: Record<ReviewIconId, string> = {
    clipboard: "M8 5h8M9 3h6l1 2h3v16H5V5h3l1-2Zm0 7h6m-6 4h4",
    warning: "M12 4 21 20H3L12 4Zm0 5v5m0 3h.01",
    refund: "M7 7h9a5 5 0 0 1 0 10H8m0 0 3-3m-3 3 3 3M7 7l3-3M7 7l3 3",
    plane: "M3 11 21 4l-7 17-3-7-8-3Zm8 3 4-4",
    check: "M5 12l4 4L19 6",
    spark: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z",
    sliders: "M4 7h10m4 0h2M4 17h4m4 0h8M14 5v4M8 15v4",
    dots: "M6 12h.01M12 12h.01M18 12h.01",
  };

  return (
    <svg aria-hidden="true" className="review-icon" viewBox="0 0 24 24">
      <path d={paths[icon]} />
    </svg>
  );
}

function matchesReviewTab(row: ReviewRow, tab: ReviewTab) {
  if (tab === "Done") return row.resolved;
  if (row.resolved) return false;
  if (tab === "Low confidence") return Number.parseInt(row.confidence, 10) < 80;
  if (tab === "Refunds") return row.tone === "refund";
  if (tab === "Miles leakage") return row.miles === "0 miles";
  return true;
}

function matchesControlFilters(
  row: ReviewRow,
  date: string,
  account: string,
  card: string,
  issue: string,
) {
  const accountMatches = account === "All" || row.card.startsWith(account);
  const dateMatches = date === "All" || row.date === date;
  const cardMatches = card === "All" || row.card === card;
  const issueMatches =
    issue === "All" ||
    (issue === "Low confidence" && Number.parseInt(row.confidence, 10) < 80) ||
    (issue === "Refund" && row.tone === "refund") ||
    (issue === "Miles leakage" && row.miles === "0 miles");

  return accountMatches && dateMatches && cardMatches && issueMatches;
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

function getPrimaryReviewAction(row: ReviewRow) {
  if (row.tone === "refund") return "Match refund";
  if (row.miles === "0 miles") return "Fix miles";
  return `Confirm as ${row.category}`;
}

function getConfidenceTone(row: ReviewRow) {
  const confidence = Number.parseInt(row.confidence, 10);
  if (confidence < 75) return "low";
  if (confidence < 90) return "medium";
  return "high";
}

function getAmountTone(row: ReviewRow) {
  if (row.amount.startsWith("+")) return "refund";
  if (row.tone === "review" || row.miles === "0 miles") return "problem";
  return "spend";
}

function formatReviewAmount(amount: string) {
  const sign = amount.startsWith("+") ? "+" : "-";
  const absoluteAmount = amount.replace(/^[-+]/, "");
  return `${sign}S$${absoluteAmount}`;
}

function buildBadgeImage(mark: string, palette: { bg: string; fg: string }) {
  const safeMark = escapeSvgText(mark.slice(0, 2));
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="68" height="68" viewBox="0 0 68 68">
      <rect width="68" height="68" rx="16" fill="${palette.bg}"/>
      <text x="34" y="42" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" fill="${palette.fg}">${safeMark}</text>
    </svg>`,
  );
}

function buildCardImage(card: string, tone: string) {
  const palette = getCardPalette(tone);
  const safeCard = escapeSvgText(card.split(" ")[0] ?? "Card");
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="68" viewBox="0 0 108 68">
      <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${palette.bg}"/><stop offset="1" stop-color="${palette.alt}"/></linearGradient></defs>
      <rect width="108" height="68" rx="9" fill="url(#g)"/>
      <rect x="10" y="16" width="20" height="14" rx="3" fill="${palette.chip}"/>
      <text x="10" y="52" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="800" fill="white">${safeCard}</text>
      <circle cx="88" cy="18" r="5" fill="rgba(255,255,255,.58)"/>
      <circle cx="96" cy="18" r="5" fill="rgba(255,255,255,.3)"/>
    </svg>`,
  );
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getMerchantPalette(tone: string) {
  const palettes: Record<string, { bg: string; fg: string }> = {
    blue: { bg: "#e7f1ff", fg: "#1559a8" },
    gold: { bg: "#fff2cc", fg: "#8c6500" },
    green: { bg: "#e3f6e9", fg: "#047a4a" },
    orange: { bg: "#fff0df", fg: "#c46600" },
    pink: { bg: "#ffe8f2", fg: "#b42363" },
  };

  return palettes[tone] ?? palettes.green;
}

function getCardPalette(tone: string) {
  const palettes: Record<string, { bg: string; alt: string; chip: string }> = {
    black: { bg: "#111827", alt: "#020617", chip: "#d1d5db" },
    blue: { bg: "#0f3b78", alt: "#061f44", chip: "#f4c542" },
    navy: { bg: "#12213f", alt: "#075985", chip: "#cbd5e1" },
  };

  return palettes[tone] ?? palettes.black;
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
  const retirementGoal = commandCentreGoals[0];
  const sabbaticalGoal = commandCentreGoals[1];
  const retirementProgress = retirementGoal
    ? Math.round((retirementGoal.currentAmountMinor / retirementGoal.targetAmountMinor) * 100)
    : 0;
  const sabbaticalProgress = sabbaticalGoal
    ? Math.round((sabbaticalGoal.currentAmountMinor / sabbaticalGoal.targetAmountMinor) * 100)
    : 0;

  return (
    <section className="insight-card goal-progress-card">
      <div className="card-title-with-icon">
        <span className="action-icon bank" aria-hidden="true">
          G
        </span>
        <div>
          <p className="eyebrow">Goals and gap</p>
          <h2>{commandCentreSnapshot.activeGoalCount} active goals</h2>
        </div>
      </div>
      <div className="goal-progress-list" aria-label="Goal progress">
        {retirementGoal ? (
          <article>
            <div>
              <strong>{retirementGoal.label}</strong>
              <span>{retirementProgress}% funded</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.min(100, retirementProgress)}%` }} />
            </div>
          </article>
        ) : null}
        {sabbaticalGoal ? (
          <article>
            <div>
              <strong>{sabbaticalGoal.label}</strong>
              <span>{sabbaticalProgress}% funded</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.min(100, sabbaticalProgress)}%` }} />
            </div>
          </article>
        ) : null}
      </div>
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
  const [showProfileSummary, setShowProfileSummary] = useState(false);
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
  const displayedConfidence =
    currentStage.id === "money" ? 64 : Math.round(progress.confidenceScore * 100);
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
          <div className="guide-brand-row">
            <span aria-hidden="true">⌁</span>
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
                <span>{index < currentStepIndex ? "✓" : index + 1}</span>
                <div>
                  <strong>{stage.title}</strong>
                  <p>{stage.subtitle}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="guide-footer-copy">
            <strong>We will use this to project your financial independence.</strong>
            <p>You can edit everything later.</p>
          </div>
          <div className="local-data-note">
            <span aria-hidden="true">▣</span>
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
            <strong>{displayedConfidence}% plan confidence</strong>
            <button
              className="modal-close"
              onClick={onClose}
              type="button"
              aria-label="Close setup"
            >
              ×
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
              <div className="profile-preview-heading">
                <strong>Your profile</strong>
                <button onClick={() => setShowProfileSummary((isOpen) => !isOpen)} type="button">
                  {showProfileSummary ? "Hide summary" : "View summary"}
                </button>
              </div>
              <div className="profile-preview-body">
                <span className="confidence-ring" aria-hidden="true" />
                <dl>
                  <div>
                    <dt>Target FI</dt>
                    <dd>S$2,500 /mo</dd>
                  </div>
                  <div>
                    <dt>FI age (est.)</dt>
                    <dd>47</dd>
                  </div>
                  <div>
                    <dt>Plan confidence</dt>
                    <dd>{displayedConfidence}%</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {showProfileSummary || currentStage.id === "assumptions" ? (
            <PlannerSetupReviewCard review={review} />
          ) : null}

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
            onChange={(event) =>
              onChange(
                question.type === "money"
                  ? event.target.value.replaceAll(",", "")
                  : event.target.value,
              )
            }
            placeholder={question.type === "money" ? "0" : undefined}
            type="text"
            value={formatOnboardingInputValue(value, question.type)}
          />
        </div>
      )}
    </label>
  );
}

function formatOnboardingInputValue(
  value: string | number | undefined,
  type: OnboardingQuestion["type"],
) {
  if (value === undefined || value === "") return "";
  if (type !== "money") return value;

  const numericValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numericValue) ? numericValue.toLocaleString("en-SG") : value;
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
  const cardPlans = [
    {
      name: "HSBC Revolution",
      scenario: "Haidilao, S$120, contactless",
      earnedMiles: "480 miles",
      nextTranche: "S$880 to monthly 4 mpd cap",
      redeemedMiles: "0 redeemed",
      detail: "Dining and contactless spend qualifies before the monthly cap.",
    },
    {
      name: "UOB Lady's",
      scenario: "Dining category selected",
      earnedMiles: "480 miles",
      nextTranche: "S$1,000 category cap left",
      redeemedMiles: "12,000 redeemed",
      detail: "Use only while Dining remains the selected bonus category.",
    },
    {
      name: "DBS Woman's World",
      scenario: "Online checkout backup",
      earnedMiles: "48 miles",
      nextTranche: "S$940 to next online tranche",
      redeemedMiles: "24,000 redeemed",
      detail: "Lower earn because this purchase is treated as offline/contactless.",
    },
  ];

  return (
    <div className="secondary-surface miles-surface">
      <section className="insight-card wide miles-hero-card">
        <p className="eyebrow">Cards & miles</p>
        <h2>87,650 earned miles</h2>
        <p>S$22,140 of eligible spend generated those miles at an average 1.18 cents per mile.</p>
        <div className="score-grid">
          <article>
            <span>Earned miles</span>
            <strong>87,650</strong>
          </article>
          <article>
            <span>Spend behind miles</span>
            <strong>S$22,140</strong>
          </article>
          <article>
            <span>Average value</span>
            <strong>1.18 cpm</strong>
          </article>
          <article>
            <span>Redeemable</span>
            <strong>72,000</strong>
          </article>
        </div>
      </section>

      <section className="insight-card wide" aria-label="Plan and purchase">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Plan a purchase</p>
            <h2>Haidilao, S$120, contactless</h2>
          </div>
          <button className="primary-action" onClick={() => setSavedPurchase(true)} type="button">
            {savedPurchase ? "Saved" : "Save planned purchase"}
          </button>
        </div>
        <div className="purchase-card-grid">
          {cardPlans.map((card) => (
            <article key={card.name}>
              <div className="card-title-with-icon">
                <img
                  alt={`${card.name} card image`}
                  height="34"
                  src={buildCardImage(card.name, card.name.includes("HSBC") ? "navy" : "black")}
                  width="54"
                />
                <div>
                  <strong>{card.name}</strong>
                  <span>{card.scenario}</span>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Earned</dt>
                  <dd>{card.earnedMiles}</dd>
                </div>
                <div>
                  <dt>Next tranche</dt>
                  <dd>{card.nextTranche}</dd>
                </div>
                <div>
                  <dt>Redeemed</dt>
                  <dd>{card.redeemedMiles}</dd>
                </div>
              </dl>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="insight-card wide leakage-card">
        <p className="eyebrow">Recoverable leakage</p>
        <h2>600 miles can still be fixed</h2>
        <p>
          Recoverable leakage is miles value Wander believes you have not permanently lost yet. It
          usually comes from transactions with missing card rules, ambiguous MCCs, unmatched
          refunds, or eligibility gaps that can still be corrected before rewards are finalized.
        </p>
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
  const monthlyRetirementSpendMinor = commandCentreFireInput.annualRetirementSpendMinor / 12;
  const propertyEquityMinor =
    (commandCentreFireInput.propertyValueMinor ?? 0) -
    (commandCentreFireInput.mortgageBalanceMinor ?? 0);
  const onboardingStats = [
    { group: "Life", label: "Current age", value: `${commandCentreFireInput.currentAge}` },
    {
      group: "Life",
      label: "Target retirement",
      value: `Age ${commandCentreFireInput.targetRetirementAge}`,
    },
    { group: "Life", label: "Primary goal", value: "Financial independence" },
    {
      group: "Life",
      label: "Target FI spend",
      value: `${formatMinor(monthlyRetirementSpendMinor)}/mo`,
    },
    {
      group: "Money",
      label: "Liquid assets",
      value: formatMinor(commandCentreFireInput.liquidAssetsMinor),
    },
    { group: "Money", label: "CPF OA", value: formatMinor(commandCentreFireInput.cpf.oaMinor) },
    { group: "Money", label: "CPF SA", value: formatMinor(commandCentreFireInput.cpf.saMinor) },
    { group: "Money", label: "CPF MA", value: formatMinor(commandCentreFireInput.cpf.maMinor) },
    { group: "Money", label: "Property equity", value: formatMinor(propertyEquityMinor) },
    { group: "Money", label: "Other debt", value: "S$25,000" },
    {
      group: "Assumptions",
      label: "Annual income",
      value: formatMinor(commandCentreFireInput.annualIncomeMinor),
    },
    {
      group: "Assumptions",
      label: "Monthly investment",
      value: formatMinor(commandCentreFireInput.monthlyInvestmentMinor),
    },
    { group: "Assumptions", label: "Portfolio style", value: "Balanced growth" },
    { group: "Assumptions", label: "Withdrawal strategy", value: "Safe withdrawal" },
    {
      group: "Assumptions",
      label: "Liquid return",
      value: formatRate(commandCentreFireInput.liquidReturnRate),
    },
    {
      group: "Assumptions",
      label: "Inflation",
      value: formatRate(commandCentreFireInput.inflationRate),
    },
    {
      group: "Assumptions",
      label: "Safe withdrawal",
      value: formatRate(commandCentreFireInput.safeWithdrawalRate),
    },
  ];

  return (
    <div className="secondary-surface planner-surface">
      <section className="insight-card wide planner-overview-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Planner</p>
            <h2>{plannerApplied ? "Current month applied" : "Planner profile"}</h2>
          </div>
          <span className="review-reason">
            FIRE met at age {commandCentreProjection.fireReadyAge ?? "n/a"}
          </span>
        </div>
        <dl className="score-grid">
          <div>
            <dt>Monthly net spend impact</dt>
            <dd>{formatSignedMoney(preview.monthlyNetSpendDeltaMinor)}</dd>
          </div>
          <div>
            <dt>Annual expense impact</dt>
            <dd>{formatSignedMoney(preview.annualizedExpensesDeltaMinor)}</dd>
          </div>
          <div>
            <dt>FI age impact</dt>
            <dd>{preview.fiAgeDelta ?? "n/a"}</dd>
          </div>
          <div>
            <dt>Miles impact</dt>
            <dd>{preview.milesDelta}</dd>
          </div>
        </dl>
      </section>

      <section
        className="insight-card wide planner-stat-card"
        aria-label="Onboarding planner stats"
      >
        <p className="eyebrow">Onboarding inputs</p>
        <h2>Profile stats used by the planner</h2>
        <div className="planner-stat-grid">
          {onboardingStats.map((stat) => (
            <article key={`${stat.group}-${stat.label}`}>
              <span>{stat.group}</span>
              <strong>{stat.value}</strong>
              <small>{stat.label}</small>
            </article>
          ))}
        </div>
      </section>

      <section
        className="insight-card wide planner-chart-card"
        aria-label="Planner growth projection"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Projection by age</p>
            <h2>Income, investment, CPF, and net worth growth</h2>
          </div>
        </div>
        <PlannerGrowthChart />
      </section>

      <StressTestingPanel />
    </div>
  );
}

function PlannerGrowthChart() {
  const points = commandCentreProjection.years
    .filter((year) => year.yearIndex % 5 === 0 || year.age === commandCentreProjection.fireReadyAge)
    .slice(0, 9);
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => [
      point.employmentIncomeMinor,
      point.liquidAssetsMinor,
      point.cpfOaMinor + point.cpfSaMinor + point.cpfMaMinor + point.cpfRaMinor,
      point.totalFireAssetsMinor,
    ]),
  );

  return (
    <div className="planner-chart">
      <div className="planner-chart-legend" aria-hidden="true">
        <span className="income">Income</span>
        <span className="investment">Investment</span>
        <span className="cpf">CPF</span>
        <span className="networth">Total net worth</span>
      </div>
      <div
        className="planner-chart-grid"
        role="img"
        aria-label="Projected income, investment, CPF, and net worth by age"
      >
        {points.map((point) => {
          const cpfTotalMinor =
            point.cpfOaMinor + point.cpfSaMinor + point.cpfMaMinor + point.cpfRaMinor;
          const fireMet = point.age === commandCentreProjection.fireReadyAge;

          return (
            <article
              className={fireMet ? "fire-met" : ""}
              key={`${point.calendarYear}-${point.age}`}
            >
              <div className="planner-bars">
                <i
                  className="income"
                  style={{ height: `${getChartHeight(point.employmentIncomeMinor, maxValue)}%` }}
                />
                <i
                  className="investment"
                  style={{ height: `${getChartHeight(point.liquidAssetsMinor, maxValue)}%` }}
                />
                <i
                  className="cpf"
                  style={{ height: `${getChartHeight(cpfTotalMinor, maxValue)}%` }}
                />
                <i
                  className="networth"
                  style={{ height: `${getChartHeight(point.totalFireAssetsMinor, maxValue)}%` }}
                />
              </div>
              <strong>Age {point.age}</strong>
              <span>{formatMinor(point.totalFireAssetsMinor)}</span>
              {fireMet ? <em>FIRE met</em> : null}
            </article>
          );
        })}
      </div>
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

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function getChartHeight(valueMinor: number, maxValueMinor: number): number {
  return Math.max(6, Math.min(100, (valueMinor / maxValueMinor) * 100));
}

function formatMinor(amountMinor: number | undefined): string {
  if (amountMinor === undefined) return "Not provided";

  return `S$${(amountMinor / 100).toLocaleString("en-SG", {
    maximumFractionDigits: 0,
  })}`;
}
