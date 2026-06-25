import { useAppShellStore, type AppTab } from "../state/appShellStore";

const tabs: Array<{ id: AppTab; label: string }> = [
  { id: "home", label: "Home" },
  { id: "plan", label: "Plan" },
  { id: "transactions", label: "Transactions" },
  { id: "cards", label: "Cards" },
  { id: "profile", label: "Profile" },
];

const homeMetrics = [
  { label: "FI number", value: "S$1.72M" },
  { label: "Current corpus", value: "S$842K" },
  { label: "FI age", value: "45" },
];

const cardMetrics = [
  { label: "Redeemable", value: "48,000 mi", tone: "progress" },
  { label: "Pending", value: "7,240 mi", tone: "warning" },
  { label: "Reversed", value: "-1,200 mi", tone: "reversal" },
];

export function App() {
  const activeTab = useAppShellStore((state) => state.activeTab);
  const setActiveTab = useAppShellStore((state) => state.setActiveTab);

  return (
    <main className="app-frame">
      <section className="mobile-shell" aria-label="Wander mobile app">
        <header className="mobile-header">
          <div>
            <p className="eyebrow">Wander</p>
            <h1>FIRE and miles, in one loop.</h1>
          </div>
          <div className="profile-chip" aria-label="Profile score">
            92
          </div>
        </header>

        <div className="tab-panels">
          {activeTab === "home" && <HomePanel />}
          {activeTab === "cards" && <CardsPanel />}
          {activeTab === "plan" && (
            <EmptyPanel title="Plan" copy="Scenario comparison and CPF assumptions are ready for the planning view." />
          )}
          {activeTab === "transactions" && (
            <EmptyPanel title="Transactions" copy="Imported spend, refunds, MCC tags, and review actions will land here." />
          )}
          {activeTab === "profile" && (
            <EmptyPanel title="Profile" copy="Local-first profile, card settings, and import preferences." />
          )}
        </div>

        <nav className="bottom-tabs" aria-label="Primary">
          {tabs.map((tab) => (
            <button
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <span aria-hidden="true">{tab.label.slice(0, 1)}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}

function HomePanel() {
  return (
    <section className="mobile-panel" aria-labelledby="home-title">
      <div className="fire-hero">
        <p className="eyebrow">FIRE progress</p>
        <h2 id="home-title">49%</h2>
        <p>On track for FI at 45 if imported expenses stay near the latest net-spend snapshot.</p>
      </div>

      <div className="metric-strip" aria-label="FIRE summary">
        {homeMetrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>

      <section className="action-list" aria-label="Priority actions">
        <ActionRow label="Confirm May expense snapshot" detail="S$5.4K monthly net spend" tone="warning" />
        <ActionRow label="Review 3 merchant matches" detail="MCC confidence below 80%" tone="progress" />
        <ActionRow label="Next miles transfer chunk" detail="S$50 spend to DBS block" tone="success" />
      </section>
    </section>
  );
}

function CardsPanel() {
  return (
    <section className="mobile-panel" aria-labelledby="cards-title">
      <div className="panel-heading">
        <p className="eyebrow">Cards</p>
        <h2 id="cards-title">Miles runway</h2>
        <p>Redeemable miles, pending earns, reversals, and next transfer chunks.</p>
      </div>

      <div className="metric-strip cards" aria-label="Miles summary">
        {cardMetrics.map((metric) => (
          <article className={metric.tone} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>

      <section className="card-stack" aria-label="Card recommendations">
        <article>
          <div>
            <h3>DBS Woman's World</h3>
            <p>S$50 to next 5,000-point block</p>
          </div>
          <strong>4 mpd</strong>
        </article>
        <article>
          <div>
            <h3>UOB Lady's</h3>
            <p>Dining category selected, S$740 cap left</p>
          </div>
          <strong>4 mpd</strong>
        </article>
      </section>
    </section>
  );
}

function EmptyPanel({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="mobile-panel empty-panel" aria-labelledby={`${title}-title`}>
      <p className="eyebrow">Coming next</p>
      <h2 id={`${title}-title`}>{title}</h2>
      <p>{copy}</p>
    </section>
  );
}

function ActionRow({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: "success" | "warning" | "progress";
}) {
  return (
    <article className={tone}>
      <div>
        <h3>{label}</h3>
        <p>{detail}</p>
      </div>
      <span aria-hidden="true">›</span>
    </article>
  );
}
