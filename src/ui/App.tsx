import { useAppShellStore } from "../state/appShellStore";

const statusCards = [
  { label: "Epic", value: "FP-1", description: "App foundation" },
  { label: "Task", value: "FP-1.1", description: "React shell and tooling" },
  { label: "Mode", value: "Local", description: "Vite UI with future Node API" },
];

export function App() {
  const activeSurface = useAppShellStore((state) => state.activeSurface);
  const setActiveSurface = useAppShellStore((state) => state.setActiveSurface);

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="app-title">
        <p className="eyebrow">FIRE Planner</p>
        <h1 id="app-title">Local-first planning, statement ingestion, and miles tracking.</h1>
        <p className="hero-copy">
          This shell establishes the Epic 1 foundation before database migrations, parser
          integration, and reward calculations land in separate traceable PRs.
        </p>
        <div className="surface-switcher" aria-label="Preview surface">
          {(["home", "cards", "desktop"] as const).map((surface) => (
            <button
              className={surface === activeSurface ? "active" : ""}
              key={surface}
              onClick={() => setActiveSurface(surface)}
              type="button"
            >
              {surface}
            </button>
          ))}
        </div>
      </section>

      <section className="status-grid" aria-label="Implementation status">
        {statusCards.map((card) => (
          <article className="status-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.description}</p>
          </article>
        ))}
      </section>

      <section className="preview-panel" aria-label="Selected product surface">
        <h2>{surfaceLabels[activeSurface]}</h2>
        <p>{surfaceDescriptions[activeSurface]}</p>
      </section>
    </main>
  );
}

const surfaceLabels = {
  home: "Mobile Home",
  cards: "Cards And Miles",
  desktop: "Desktop Dashboard",
} as const;

const surfaceDescriptions = {
  home: "Hero FIRE percentage, corpus progress, runway, review actions, and expense snapshot CTA.",
  cards: "Redeemable miles, accumulated miles, pending miles, reversals, and spend-to-next chunk.",
  desktop: "Dense review inbox with FI impact, miles overview, and expense snapshot side panels.",
} as const;
