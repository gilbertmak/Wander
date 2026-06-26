import { useState } from "react";

import {
  applyCorrectionDraft,
  type CorrectionField,
} from "../review/correctionWorkflow";
import { calculateImpactPreview, type ImpactPreview } from "../review/impactPreview";
import type { ReviewTransaction } from "../review/reviewInboxModel";
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
  const activeTab = useAppShellStore((state) => state.activeTab);
  const setActiveTab = useAppShellStore((state) => state.setActiveTab);

  return (
    <main className="app-frame">
      <DesktopShell activeTab={activeTab} setActiveTab={setActiveTab} />
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

function DesktopShell({
  activeTab,
  setActiveTab,
}: {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}) {
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
          <ReviewRow
            title="SP Services Utilities"
            meta="MCC 4900 · Utilities · no miles"
            impact="Expense snapshot +S$94"
            diagnostic="Matched merchant text, category confidence 95%"
            tone="warning"
          />
          <ReviewRow
            title="Grab Trip Singapore"
            meta="MCC 4121 · Transport · 4 mpd eligible"
            impact="DBS block needs S$50"
            diagnostic="Refund matcher found no offset"
            tone="progress"
          />
          <ReviewRow
            title="Town Council Payment"
            meta="MCC 9399 · Government · excluded"
            impact="No miles earned"
            diagnostic="Learned from prior correction"
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
          <dd>{preview.fiAgeDelta === undefined ? "n/a" : `${preview.fiAgeDelta > 0 ? "+" : ""}${preview.fiAgeDelta}`}</dd>
        </div>
        <div>
          <dt>Miles</dt>
          <dd>{preview.milesDelta > 0 ? `+${preview.milesDelta}` : preview.milesDelta}</dd>
        </div>
      </dl>
    </section>
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
            setNextValue(selectedField === "miles_eligibility" ? "false" : defaultCorrectionValue(selectedField));
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

function ReviewRow({
  title,
  meta,
  impact,
  diagnostic,
  tone,
}: {
  title: string;
  meta: string;
  impact: string;
  diagnostic: string;
  tone: "success" | "warning" | "progress";
}) {
  return (
    <article className={`review-row ${tone}`}>
      <div>
        <h3>{title}</h3>
        <p>{meta}</p>
        <span>{diagnostic}</span>
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
