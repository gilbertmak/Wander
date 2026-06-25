import { useAppShellStore, type MobileTab } from "../state/appShellStore";

const mobileTabs: Array<{ id: MobileTab; label: string; badge?: string }> = [
  { id: "home", label: "Home" },
  { id: "plan", label: "Plan" },
  { id: "transactions", label: "Txns", badge: "7" },
  { id: "cards", label: "Cards", badge: "2" },
  { id: "profile", label: "Profile" },
];

const homeMetrics = [
  { label: "Net Worth", value: "$742k", detail: "+$4.8k this month" },
  { label: "CPF", value: "$218k", detail: "29% of FI corpus" },
  { label: "Net Spend", value: "$4.2k", detail: "$620 below plan" },
  { label: "Miles Bank", value: "86.4k", detail: "72k redeemable" },
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
          {activeTab === "plan" && (
            <PlaceholderPanel
              title="Plan"
              copy="Scenario comparison, expense snapshots, and FIRE assumptions land here after the database and planner epics."
            />
          )}
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
  return (
    <article className="screen-panel mobile-home">
      <header>
        <p className="eyebrow">FIRE Progress</p>
        <div className="fire-score">
          <span>68%</span>
          <p>to FI target</p>
        </div>
      </header>

      <section className="corpus-card" aria-label="Corpus progress">
        <div>
          <span>Target corpus</span>
          <strong>$1.1m / $1.62m</strong>
        </div>
        <div className="progress-track" aria-label="68 percent complete">
          <span style={{ width: "68%" }} />
        </div>
        <p>Estimated FI date: Aug 2034 · Runway: 8.2 years</p>
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
        <Kpi label="FI Progress" value="68%" trend="+1.2%" />
        <Kpi label="Net Spend" value="$4.2k" trend="-$620" />
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
          <InsightCard title="FI impact" value="Expense snapshot lowers FI date by 3 months." />
          <InsightCard title="Miles overview" value="Refund reversals are netted from accumulated miles." />
          <InsightCard title="Expense snapshot" value="$50.4k annualized from latest import." />
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
