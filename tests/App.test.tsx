import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useAppShellStore } from "../src/state/appShellStore";
import { App } from "../src/ui/App";

describe("App shell", () => {
  beforeEach(() => {
    useAppShellStore.setState({ activeSurface: "home", activeTab: "home" });
  });

  it("renders the FIRE command centre dashboard with advisor hierarchy", () => {
    render(<App />);

    const desktop = screen.getByLabelText("Wander desktop app");

    expect(within(desktop).getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(
      within(desktop).getByRole("heading", { name: /89% to financial independence/i }),
    ).toBeInTheDocument();
    expect(within(desktop).getByLabelText("FIRE command cards")).toBeInTheDocument();
    expect(within(desktop).getByLabelText("What changed since last import")).toBeInTheDocument();
    expect(within(desktop).getByLabelText("Today's actions")).toBeInTheDocument();
    expect(within(desktop).getByLabelText("Singapore benchmark")).toBeInTheDocument();
    expect(within(desktop).getByText("Advisor action")).toBeInTheDocument();
    expect(within(desktop).getByText("Goals and gap")).toBeInTheDocument();
    expect(
      within(desktop).queryByRole("table", { name: "Imported transaction review" }),
    ).not.toBeInTheDocument();
    expect(within(desktop).getByText("Miles overview")).toBeInTheDocument();
    expect(within(desktop).getByText("Expense snapshot")).toBeInTheDocument();
    expect(
      within(desktop).queryByRole("button", { name: "Apply latest import" }),
    ).not.toBeInTheDocument();
    expect(
      within(desktop).queryByRole("button", { name: "Why this plan?" }),
    ).not.toBeInTheDocument();
  });

  it("makes desktop navigation and planner CTA visibly interactive", async () => {
    render(<App />);

    const desktop = screen.getByLabelText("Wander desktop app");
    const nav = within(desktop).getByLabelText("Workspace sections");

    await userEvent.click(within(nav).getByRole("button", { name: /Miles/i }));

    expect(
      within(desktop).getByRole("heading", { name: "72,000 redeemable miles" }),
    ).toBeInTheDocument();

    await userEvent.click(within(desktop).getByRole("button", { name: "Apply to planner" }));
    await userEvent.click(within(nav).getByRole("button", { name: "Planner" }));

    expect(within(desktop).getByRole("heading", { name: "Current month applied" }));
    expect(within(desktop).getByLabelText("Scenario stress testing")).toBeInTheDocument();
  });

  it("opens FIRE reports with chart sections", async () => {
    render(<App />);

    const desktop = screen.getByLabelText("Wander desktop app");
    const nav = within(desktop).getByLabelText("Workspace sections");

    await userEvent.click(within(nav).getByRole("button", { name: "Reports" }));

    expect(
      within(desktop).getByRole("heading", { name: "FIRE journey report" }),
    ).toBeInTheDocument();
    expect(within(desktop).getByLabelText("FIRE trajectory chart")).toBeInTheDocument();
    expect(within(desktop).getByText("Current wealth mix")).toBeInTheDocument();
  });

  it("opens Wander Guide setup and advances bundled onboarding questions", async () => {
    render(<App />);

    const desktop = screen.getByLabelText("Wander desktop app");
    await userEvent.click(within(desktop).getByRole("button", { name: "Start guided setup" }));

    const modal = screen.getByRole("dialog", { name: "Wander Guide" });

    expect(within(modal).getByRole("heading", { name: "Wander Guide" })).toBeInTheDocument();
    expect(within(modal).getByRole("heading", { name: "Your money today" })).toBeInTheDocument();
    expect(within(modal).getByLabelText(/setup progress/i)).toBeInTheDocument();
    expect(within(modal).queryByText(/required/i)).not.toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: /Why am I/i })).not.toBeInTheDocument();
    expect(within(modal).getByText("64% plan confidence")).toBeInTheDocument();
    expect(screen.getByLabelText("Cash and liquid investments")).toHaveValue("25,000");
    expect(screen.getByLabelText("CPF OA balance")).toHaveValue("52,000");

    await userEvent.click(within(modal).getByRole("button", { name: "View summary" }));
    expect(within(modal).getByText("Structured plan preview")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Cash and liquid investments"));
    await userEvent.type(screen.getByLabelText("Cash and liquid investments"), "30000");
    await userEvent.click(within(modal).getByRole("button", { name: "Continue" }));

    expect(within(modal).getByRole("heading", { name: "Your assumptions" })).toBeInTheDocument();
    expect(within(modal).getByText(/Step 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Portfolio style")).toBeInTheDocument();

    await userEvent.click(within(modal).getByRole("button", { name: "Back" }));

    expect(within(modal).getByRole("heading", { name: "Your money today" })).toBeInTheDocument();
  });

  it("opens the dedicated review inbox with visual action model", async () => {
    render(<App />);

    const desktop = screen.getByLabelText("Wander desktop app");
    const nav = within(desktop).getByLabelText("Workspace sections");
    await userEvent.click(within(nav).getByRole("button", { name: /Review Inbox/i }));

    const table = within(desktop).getByRole("table", { name: "Imported transaction review" });

    expect(within(table).queryByRole("columnheader", { name: "Issue" })).not.toBeInTheDocument();
    expect(within(table).getAllByRole("button", { name: "Confirm" }).length).toBeGreaterThan(0);
    expect(within(table).getByRole("button", { name: "Match refund" })).toBeInTheDocument();
    expect(within(table).getAllByRole("button", { name: "Fix miles" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Shopee SG category")).toHaveClass("category-select");
    expect(screen.getByAltText("Amazon SG logo")).toBeInTheDocument();
    expect(screen.getByAltText("DBS Altitude card image")).toBeInTheDocument();
    expect(screen.getAllByText("-S$499.00")[0]).toHaveClass("problem");
    expect(screen.getByText("+S$128.90")).toHaveClass("refund");
    expect(screen.getByLabelText("Why this needs review")).toBeInTheDocument();
    expect(screen.getByLabelText("Search merchant, note, card, MCC, or refund")).toHaveAttribute(
      "placeholder",
      "Search merchant, note, card, MCC, or refund",
    );

    await userEvent.click(within(table).getAllByRole("button", { name: "Confirm" })[0]);

    expect(screen.getByText("Confirm saved")).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Search merchant, note, card, MCC, or refund"),
      "amazon",
    );

    expect(within(table).getByText("Amazon SG")).toBeInTheDocument();
    expect(within(table).queryByText("Cold Storage")).not.toBeInTheDocument();
  });

  it("saves a correction and reports recalculation triggers", async () => {
    render(<App />);

    const desktop = screen.getByLabelText("Wander desktop app");
    const nav = within(desktop).getByLabelText("Workspace sections");
    await userEvent.click(within(nav).getByRole("button", { name: "Planner" }));

    await userEvent.selectOptions(screen.getByLabelText("Correction"), "mcc");
    await userEvent.clear(screen.getByLabelText("New value"));
    await userEvent.type(screen.getByLabelText("New value"), "5812");
    await userEvent.click(screen.getByRole("button", { name: "Save correction" }));

    expect(screen.getByText(/Saved mcc correction/i)).toBeInTheDocument();
    expect(screen.getByText(/mcc_corrected, miles_eligibility_changed/i)).toBeInTheDocument();
  });

  it("renders and switches the mobile landing tabs", async () => {
    render(<App />);

    const mobile = screen.getByLabelText("Wander mobile app");
    const mobileTabs = within(mobile).getByLabelText("Mobile tabs");

    expect(within(mobile).getByRole("heading", { name: /89% to financial independence/i }));
    expect(within(mobile).getByText("Goal funding gap")).toBeInTheDocument();

    await userEvent.click(within(mobileTabs).getByRole("button", { name: /Cards/i }));

    expect(within(mobile).getByText("72,000 miles")).toBeInTheDocument();
    expect(within(mobile).getByText(/Best card now: Citi Rewards/i)).toBeInTheDocument();
  });
});
