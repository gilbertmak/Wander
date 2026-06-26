import { useState } from "react";

import { applyCorrectionDraft, type CorrectionField } from "../review/correctionWorkflow";
import { calculateImpactPreview, type ImpactPreview } from "../review/impactPreview";
import type { ReviewTransaction } from "../review/reviewInboxModel";
import { useAppShellStore, type AppTab } from "../state/appShellStore";
import { useAppShellStore, type MobileTab } from "../state/appShellStore";

const mobileTabs: Array<{ id: MobileTab; label: string; badge?: string }> = [
  { id: "home", label: "Home" },
  { id: "plan", label: "Plan" },
  { id: "transactions", label: "Txns", badge: "7" },
  { id: "cards", label: "Cards", badge: "2" },
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

const leakageReasons = [
  { label: "Missing card assignment", value: "420 mi", action: "Review 3 transactions" },
  { label: "Cap exhausted", value: "260 mi", action: "Switch card next month" },
  { label: "Low-confidence MCC", value: "180 mi", action: "Confirm MCC" },
];

const reviewGroups = [
  {
    label: "Confirm merchant",
    count: 2,
    amount: "S$188",
    detail: "Local aliases improve future imports.",
  },
  {
    label: "Confirm MCC",
    count: 1,
    amount: "S$94",
    detail: "Miles calculation waits for merchant category code confidence.",
  },
  {
    label: "Assign card",
    count: 1,
    amount: "S$36",
    detail: "Card assignment unlocks earn and cap checks.",
  },
];

const refundTimelineEvents = [
  { label: "Original charge", value: "S$129 · Apple App Store" },
  { label: "Expected refund", value: "S$129 by 1 Jul" },
  { label: "Received refund", value: "Pending" },
  { label: "Miles reversal", value: "-516 mi when received" },
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
  id: "transaction_sp_services",
  postedDate: "2026-06-20",
  descriptionNormalized: "sp services utilities",
  amountMinor: -9400,
  categoryId: null,
  mccCode: "4900",
  merchantId: "merchant_sp_services",
  cardId: "card_citi_rewards",
  confidenceScore: 0.61,
  eligibleForMiles: true,
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

export function App() {
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

function DesktopShell({
  activeTab,
  setActiveTab,
}: {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <section className="desktop-shell" aria-label="Wander desktop dashboard">
      <aside className="desktop-sidebar" aria-label="Desktop navigation">
        <div>
          <p className="eyebrow">Wander</p>
          <h1>Command center</h1>
        </div>
        <nav aria-label="Desktop primary">
          {tabs.map((tab) => (
            <button
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="desktop-main" aria-labelledby="desktop-title">
        <div className="desktop-hero">
          <div>
            <p className="eyebrow">FIRE dashboard</p>
            <h2 id="desktop-title">FI at 45, with 49% funded</h2>
            <p>Scenario, expense, transaction review, and miles impacts in one working surface.</p>
          </div>
          <div className="desktop-progress" aria-label="FIRE progress 49 percent">
            <span>49%</span>
          </div>
        </div>

        <section className="review-inbox" aria-labelledby="review-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Review inbox</p>
              <h2 id="review-title">3 items need confirmation</h2>
            </div>
            <button type="button">Review all</button>
          </div>
          <CorrectionPanel />
          <ImpactPreviewPanel preview={sampleImpactPreview} />
          <ReviewGroupPanel />
          <RefundTimelinePanel />
          <ReviewRow
            title="SP Services Utilities"
            meta="MCC 4900 · Utilities · no miles"
            impact="Expense snapshot +S$94"
            diagnostic="Matched merchant text, category confidence 95%"
            onExplain={() => setWhyOpen(true)}
            trustLabel="Medium trust"
            tone="warning"
          />
          <ReviewRow
            title="Grab Trip Singapore"
            meta="MCC 4121 · Transport · 4 mpd eligible"
            impact="DBS block needs S$50"
            diagnostic="Refund matcher found no offset"
            onExplain={() => setWhyOpen(true)}
            trustLabel="High trust"
            tone="progress"
          />
          <ReviewRow
            title="Town Council Payment"
            meta="MCC 9399 · Government · excluded"
            impact="No miles earned"
            diagnostic="Learned from prior correction"
            onExplain={() => setWhyOpen(true)}
            trustLabel="Needs review"
            tone="success"
          />
        </section>
      </section>

      <aside className="desktop-insights" aria-label="Insights">
        <section>
          <p className="eyebrow">Plan</p>
          <h2>Scenario spread</h2>
          <dl>
            <div>
              <dt>Optimistic</dt>
              <dd>FI 2 years earlier</dd>
            </div>
            <div>
              <dt>Conservative</dt>
              <dd>Target +S$86K</dd>
            </div>
          </dl>
        </section>
        <section>
          <p className="eyebrow">Cards</p>
          <h2>Miles health</h2>
          <dl>
            <div>
              <dt>Redeemable</dt>
              <dd>48,000 mi</dd>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>7,240 mi</dd>
            </div>
            <div>
              <dt>Reversed</dt>
              <dd>-1,200 mi</dd>
            </div>
          </dl>
        </section>
      </aside>
      {whyOpen && <WhyThisDrawer onClose={() => setWhyOpen(false)} />}
    </section>
  );
}

function ImpactPreviewPanel({ preview }: { preview: ImpactPreview }) {
  return (
    <section className="impact-preview" aria-labelledby="impact-preview-title">
      <div>
        <p className="eyebrow">Impact preview</p>
        <h3 id="impact-preview-title">{preview.summary}</h3>
      </div>
      <dl>
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
          <dd>
            {preview.fiAgeDelta === undefined
              ? "n/a"
              : `${preview.fiAgeDelta > 0 ? "+" : ""}${preview.fiAgeDelta}`}
          </dd>
        </div>
        <div>
          <dt>Miles</dt>
          <dd>{preview.milesDelta > 0 ? `+${preview.milesDelta}` : preview.milesDelta}</dd>
        </div>
      </dl>
    </section>
  );
}

function ReviewGroupPanel() {
  return (
    <section className="review-groups" aria-label="Grouped review queue">
      {reviewGroups.map((group) => (
        <article key={group.label}>
          <div>
            <span>{group.count} open</span>
            <h3>{group.label}</h3>
            <p>
              {group.amount} impact · {group.detail}
            </p>
          </div>
          <div className="review-actions" aria-label={`${group.label} actions`}>
            <button type="button">Accept</button>
            <button type="button">Edit</button>
            <button type="button">Ignore</button>
          </div>
        </article>
      ))}
    </section>
  );
}

function RefundTimelinePanel() {
  return (
    <section className="refund-timeline" aria-label="Refund tracker timeline">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Refund tracker</p>
          <h3>Apple refund unresolved</h3>
        </div>
        <strong>Missing</strong>
      </div>
      <ol>
        {refundTimelineEvents.map((event) => (
          <li key={event.label}>
            <span>{event.label}</span>
            <p>{event.value}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WhyThisDrawer({ onClose }: { onClose: () => void }) {
  return (
    <aside className="why-drawer" aria-label="Why this explanation">
      <div>
        <p className="eyebrow">Why this?</p>
        <h2>Medium trust</h2>
        <p>
          Parser confidence, merchant match, MCC confidence, and reconciliation status were used.
        </p>
      </div>
      <dl>
        <div>
          <dt>Rules fired</dt>
          <dd>trust_score · merchant_resolver</dd>
        </div>
        <div>
          <dt>Caveats</dt>
          <dd>Statement balances unavailable for this import.</dd>
        </div>
        <div>
          <dt>Linked records</dt>
          <dd>transaction_sp_services</dd>
        </div>
      </dl>
      <button onClick={onClose} type="button">
        Close
      </button>
    </aside>
  );
}

function CorrectionPanel() {
  const [field, setField] = useState<CorrectionField>("category");
  const [nextValue, setNextValue] = useState("category_utilities");
  const [createHeuristic, setCreateHeuristic] = useState(true);
  const [message, setMessage] = useState("No correction saved yet.");

  return (
    <form
      className="correction-panel"
      onSubmit={(event) => {
        event.preventDefault();
        const result = applyCorrectionDraft(sampleReviewTransaction, {
          transactionId: sampleReviewTransaction.id,
          field,
          nextValue: field === "miles_eligibility" ? nextValue === "true" : nextValue,
          createHeuristic,
          correctedAt: "2026-06-26T00:00:00.000Z",
        });

        setMessage(
          `Saved ${result.correction.field} correction; triggers ${result.recalculationTriggers.join(", ")}.`,
        );
      }}
    >
      <div>
        <label htmlFor="correction-field">Correction</label>
        <select
          id="correction-field"
          onChange={(event) => {
            const selectedField = event.target.value as CorrectionField;
            setField(selectedField);
            setNextValue(
              selectedField === "miles_eligibility"
                ? "false"
                : defaultCorrectionValue(selectedField),
            );
          }}
          value={field}
        >
          {correctionFields.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="correction-value">New value</label>
        <input
          id="correction-value"
          onChange={(event) => setNextValue(event.target.value)}
          value={nextValue}
        />
      </div>
      <label className="checkbox-field">
        <input
          checked={createHeuristic}
          onChange={(event) => setCreateHeuristic(event.target.checked)}
          type="checkbox"
        />
        Create heuristic
      </label>
      <button type="submit">Save correction</button>
      <p aria-live="polite">{message}</p>
    </form>
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
      </div>

      <section className="action-list" aria-label="Priority actions">
        <ImportQualityCard />
        <ActionRow
          label="Confirm May expense snapshot"
          detail="S$5.4K monthly net spend"
          tone="warning"
        />
        <ActionRow
          label="Review 3 merchant matches"
          detail="MCC confidence below 80%"
          tone="progress"
        />
        <ActionRow
          label="Next miles transfer chunk"
          detail="S$50 spend to DBS block"
          tone="success"
        />
      </section>
    </section>
  );
}

function ImportQualityCard() {
  return (
    <article className="import-quality">
      <div>
        <h3>Latest import mostly verified</h3>
        <p>42 rows checked · statement balances unavailable</p>
      </div>
      <strong>86%</strong>
    </article>
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

      <MilesLeakageCard />

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

function MilesLeakageCard() {
  return (
    <section className="leakage-card" aria-label="Miles leakage monitor">
      <div>
        <p className="eyebrow">Leakage monitor</p>
        <h3>860 missed miles this month</h3>
        <p>Recoverable actions exclude refunded spend and confirmed excluded MCCs.</p>
      </div>
      <dl>
        <div>
          <dt>Cap used</dt>
          <dd>74%</dd>
        </div>
        <div>
          <dt>Excluded spend</dt>
          <dd>S$312</dd>
        </div>
        <div>
          <dt>Recoverable</dt>
          <dd>600 mi</dd>
        </div>
      </dl>
      <ul>
        {leakageReasons.map((reason) => (
          <li key={reason.label}>
            <span>{reason.label}</span>
            <strong>{reason.value}</strong>
            <p>{reason.action}</p>
          </li>
        ))}
      </ul>
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

function ReviewRow({
  title,
  meta,
  impact,
  diagnostic,
  onExplain,
  trustLabel,
  tone,
}: {
  title: string;
  meta: string;
  impact: string;
  diagnostic: string;
  onExplain: () => void;
  trustLabel: string;
  tone: "success" | "warning" | "progress";
}) {
  return (
    <article className={`review-row ${tone}`}>
      <div>
        <h3>{title}</h3>
        <p>{meta}</p>
        <span className="trust-badge">{trustLabel}</span>
        <span>{diagnostic}</span>
        <button className="why-link" onClick={onExplain} type="button">
          Why this?
        </button>
      </div>
      <strong>{impact}</strong>
    </article>
  );
}

function defaultCorrectionValue(field: CorrectionField) {
  switch (field) {
    case "category":
      return "category_utilities";
    case "merchant":
      return "merchant_sp_services";
    case "mcc":
      return "4900";
    case "card":
      return "card_citi_rewards";
    case "refund_match":
      return "transaction_purchase";
    case "miles_eligibility":
      return "false";
  }
}

function formatSignedMoney(valueMinor: number) {
  const sign = valueMinor > 0 ? "+" : "-";
  return `${sign}S$${Math.abs(valueMinor / 100).toLocaleString("en-SG", {
    maximumFractionDigits: 0,
  })}`;
}
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
