import { formatCurrency, formatPercent } from "../domain/planner/format";
import { deriveAnnualizedExpenses } from "../domain/planner/projection";
import { samplePlannerViewModel } from "../domain/planner/sampleData";
import type { ProjectionResult } from "../domain/planner/types";
import { useAppShellStore, type MobileTab } from "../state/appShellStore";

const mobileTabs: Array<{ id: MobileTab; label: string; badge?: string }> = [
  { id: "home", label: "Home" },
  { id: "plan", label: "Plan" },
  { id: "transactions", label: "Txns", badge: "7" },
  { id: "cards", label: "Cards", badge: "2" },
  { id: "profile", label: "Profile" },
];

const reviewRows = [
  {
    merchant: "Grab *Trip",
    amount: "-$18.40",
    status: "Likely MCC",
    impact: "+74 miles",
    confidence: "82%",
  },
  {
    merchant: "Apple Refund",
    amount: "+$129.00",
    status: "Matched refund",
    impact: "-516 miles",
    confidence: "94%",
  },
  {
    merchant: "Cold Storage",
    amount: "-$67.20",
    status: "Needs category",
    impact: "Expense snapshot",
    confidence: "61%",
  },
];

export function App() {
  const activeSurface = useAppShellStore((state) => state.activeSurface);
  const setActiveSurface = useAppShellStore((state) => state.setActiveSurface);
  const activeTab = useAppShellStore((state) => state.activeTab);
  const setActiveTab = useAppShellStore((state) => state.setActiveTab);

  return (
    <main className="app-frame">
      <section className="mobile-shell" aria-label="Mobile application preview">
        <div className="mobile-status" aria-hidden="true">
          <span>9:41</span>
          <span>SG</span>
        </div>

        <div className="mobile-content">
          {activeTab === "home" && <MobileHome />}
          {activeTab === "cards" && <CardsTab />}
          {activeTab === "plan" && <PlanTab scenarios={samplePlannerViewModel.scenarios} />}
          {activeTab === "transactions" && (
            <PlaceholderPanel
              title="Transactions"
              copy="Imported statement rows, refund matches, categories, and MCC review will be managed from this surface."
            />
          )}
          {activeTab === "profile" && (
            <PlaceholderPanel
              title="Profile"
              copy="Profile settings, local data controls, export, and card setup will live here."
            />
          )}
        </div>

        <nav className="bottom-tabs" aria-label="Mobile tabs">
          {mobileTabs.map((tab) => (
            <button
              aria-current={tab.id === activeTab ? "page" : undefined}
              className={tab.id === activeTab ? "active" : ""}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <span>{tab.label}</span>
              {tab.badge ? <strong aria-label={`${tab.badge} pending`}>{tab.badge}</strong> : null}
            </button>
          ))}
        </nav>
      </section>

      <section className="workspace" aria-label="Desktop workspace preview">
        <aside className="sidebar" aria-label="Desktop navigation">
          <div>
            <p className="eyebrow">Wander</p>
            <h1>Financial independence cockpit</h1>
          </div>
          <nav className="desktop-nav" aria-label="Workspace sections">
            {(["home", "cards", "desktop"] as const).map((surface) => (
              <button
                aria-current={surface === activeSurface ? "page" : undefined}
                className={surface === activeSurface ? "active" : ""}
                key={surface}
                onClick={() => setActiveSurface(surface)}
                type="button"
              >
                {surfaceLabels[surface]}
              </button>
            ))}
          </nav>
        </aside>

        <DesktopDashboard activeSurface={activeSurface} />
      </section>
    </main>
  );
}

function MobileHome() {
  const { activeSnapshot, baseline } = samplePlannerViewModel;
  const fireProgress = formatPercent(baseline.currentFireProgress);
  const annualizedSnapshot = deriveAnnualizedExpenses(activeSnapshot);
  const homeMetrics = [
    {
      label: "Net Worth",
      value: formatCurrency(baseline.points[0].netWorth, true),
      detail: `${fireProgress} of FI corpus`,
    },
    {
      label: "FI Corpus",
      value: formatCurrency(baseline.targetFireNumber, true),
      detail: `${baseline.yearsToFire ?? "No"} years to FI`,
    },
    {
      label: "Net Spend",
      value: formatCurrency(activeSnapshot.netSpend, true),
      detail: `${formatCurrency(annualizedSnapshot, true)} annualized`,
    },
    { label: "Miles Bank", value: "86.4k", detail: "72k redeemable" },
  ];

  return (
    <article className="screen-panel mobile-home">
      <header>
        <p className="eyebrow">FIRE Progress</p>
        <div className="fire-score">
          <span>{fireProgress}</span>
          <p>to FI target</p>
        </div>
      </header>

      <section className="corpus-card" aria-label="Corpus progress">
        <div>
          <span>Target corpus</span>
          <strong>
            {formatCurrency(baseline.points[0].netWorth, true)} /{" "}
            {formatCurrency(baseline.targetFireNumber, true)}
          </strong>
        </div>
        <div className="progress-track" aria-label={`${fireProgress} complete`}>
          <span style={{ width: fireProgress }} />
        </div>
        <p>
          Estimated FI year: {baseline.projectedFireYear ?? "Outside projection"} · Runway:{" "}
          {baseline.yearsToFire ?? "No"} years
        </p>
      </section>

      <section className="metric-grid" aria-label="Financial summary">
        {homeMetrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <button className="primary-action" type="button">
        Review 7 imported rows
      </button>
    </article>
  );
}

function PlanTab({ scenarios }: { scenarios: ProjectionResult[] }) {
  return (
    <article className="screen-panel plan-tab">
      <header>
        <p className="eyebrow">Scenario Comparison</p>
        <h2>FI paths from current assumptions</h2>
        <p>Expense snapshots can update annual spend after user confirmation.</p>
      </header>

      <section className="scenario-list" aria-label="FIRE scenario comparison">
        {scenarios.map((scenario) => (
          <article key={scenario.scenarioId}>
            <div>
              <strong>{scenario.label}</strong>
              <p>{formatCurrency(scenario.targetFireNumber, true)} target corpus</p>
            </div>
            <span>{scenario.projectedFireAge ? `Age ${scenario.projectedFireAge}` : "No FI"}</span>
          </article>
        ))}
      </section>
    </article>
  );
}

function CardsTab() {
  return (
    <article className="screen-panel cards-tab">
      <header>
        <p className="eyebrow">Miles Vault</p>
        <h2>72,000 redeemable miles</h2>
        <p>14,400 pending · 1,032 reversed · rule check due in 12 days</p>
      </header>

      <section className="chunk-card" aria-label="Spend to next redeemable chunk">
        <span>Next redeemable chunk</span>
        <strong>$430 eligible spend</strong>
        <p>Use DBS Woman's World for online travel until the monthly cap is full.</p>
      </section>

      <section className="activity-list" aria-label="Recent miles activity">
        {reviewRows.slice(0, 2).map((row) => (
          <article key={row.merchant}>
            <div>
              <strong>{row.merchant}</strong>
              <p>
                {row.status} · {row.confidence}
              </p>
            </div>
            <span>{row.impact}</span>
          </article>
        ))}
      </section>
    </article>
  );
}

function DesktopDashboard({ activeSurface }: { activeSurface: string }) {
  const { activeSnapshot, baseline, scenarios } = samplePlannerViewModel;
  const annualizedSnapshot = deriveAnnualizedExpenses(activeSnapshot);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Epic 2 Preview</p>
          <h2>{surfaceLabels[activeSurface as keyof typeof surfaceLabels]}</h2>
        </div>
        <button className="primary-action compact" type="button">
          Apply snapshot
        </button>
      </header>

      <section className="kpi-row" aria-label="Key planning metrics">
        <Kpi label="FI Progress" value={formatPercent(baseline.currentFireProgress)} trend="Computed" />
        <Kpi
          label="Net Spend"
          value={formatCurrency(activeSnapshot.netSpend, true)}
          trend={`${formatCurrency(annualizedSnapshot, true)} annualized`}
        />
        <Kpi label="Redeemable Miles" value="72k" trend="+3.4k" />
      </section>

      <section className="desktop-grid">
        <article className="review-inbox" aria-labelledby="review-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Review Inbox</p>
              <h3 id="review-title">7 rows need attention</h3>
            </div>
            <button type="button">Filter</button>
          </div>

          <div className="review-table" role="table" aria-label="Imported transaction review">
            {reviewRows.map((row) => (
              <div className="review-row" role="row" key={row.merchant}>
                <div role="cell">
                  <strong>{row.merchant}</strong>
                  <p>{row.amount}</p>
                </div>
                <span className="status-pill" role="cell">
                  {row.status}
                </span>
                <span role="cell">{row.confidence}</span>
                <strong role="cell">{row.impact}</strong>
              </div>
            ))}
          </div>
        </article>

        <aside className="insight-column" aria-label="Planning insights">
          <InsightCard
            title="FI impact"
            value={`Baseline FI at age ${baseline.projectedFireAge ?? "outside projection"}.`}
          />
          <InsightCard title="Miles overview" value="Refund reversals are netted from accumulated miles." />
          <InsightCard
            title="Expense snapshot"
            value={`${formatCurrency(annualizedSnapshot, true)} annualized from latest import.`}
          />
          <article className="insight-card scenario-card">
            <span>Scenario comparison</span>
            {scenarios.map((scenario) => (
              <p key={scenario.scenarioId}>
                {scenario.label}:{" "}
                {scenario.projectedFireAge ? `FI age ${scenario.projectedFireAge}` : "outside projection"}
              </p>
            ))}
          </article>
        </aside>
      </section>
    </div>
  );
}

function Kpi({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <article className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{trend}</p>
    </article>
  );
}

function InsightCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="insight-card">
      <span>{title}</span>
      <p>{value}</p>
    </article>
  );
}

function PlaceholderPanel({ title, copy }: { title: string; copy: string }) {
  return (
    <article className="screen-panel placeholder-panel">
      <p className="eyebrow">{title}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
    </article>
  );
}

const surfaceLabels = {
  home: "Mobile Home",
  cards: "Cards And Miles",
  desktop: "Desktop Dashboard",
} as const;
