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
    expect(within(desktop).getByText("Advisor action")).toBeInTheDocument();
    expect(within(desktop).getByText("Goals and gap")).toBeInTheDocument();
    expect(within(desktop).getByRole("table", { name: "Imported transaction review" }));
    expect(within(desktop).getByText("Miles overview")).toBeInTheDocument();
    expect(within(desktop).getByText("Expense snapshot")).toBeInTheDocument();
  });

  it("makes desktop navigation and planner CTA visibly interactive", async () => {
    render(<App />);

    const desktop = screen.getByLabelText("Wander desktop app");
    const nav = within(desktop).getByLabelText("Workspace sections");

    await userEvent.click(within(nav).getByRole("button", { name: "Cards & miles" }));

    expect(
      within(desktop).getByRole("heading", { name: "72,000 redeemable miles" }),
    ).toBeInTheDocument();

    await userEvent.click(within(desktop).getByRole("button", { name: "Apply to planner" }));
    await userEvent.click(within(nav).getByRole("button", { name: "Planner" }));

    expect(within(desktop).getByRole("heading", { name: "Current month applied" }));
  });

  it("opens Wander Guide setup and advances bundled onboarding questions", async () => {
    render(<App />);

    const desktop = screen.getByLabelText("Wander desktop app");
    await userEvent.click(within(desktop).getByRole("button", { name: "Start guided setup" }));

    expect(within(desktop).getByRole("heading", { name: "Wander Guide" })).toBeInTheDocument();
    expect(within(desktop).getByRole("heading", { name: "Your timeline" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Current age"), "36");
    await userEvent.type(screen.getByLabelText("Target retirement age"), "45");
    await userEvent.type(screen.getByLabelText("Planning age"), "90");
    await userEvent.click(within(desktop).getByRole("button", { name: "Continue" }));

    expect(within(desktop).getByRole("heading", { name: "Your FIRE life" })).toBeInTheDocument();
    expect(within(desktop).getByText(/Step 2 of 10/i)).toBeInTheDocument();
  });

  it("opens and closes the explanation drawer from transaction actions", async () => {
    render(<App />);

    await userEvent.click(screen.getAllByRole("button", { name: "Why this?" })[0]);

    expect(screen.getByLabelText("Why this explanation")).toBeInTheDocument();
    expect(screen.getByText(/refund_matcher, trust_score, reward_reversal/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByLabelText("Why this explanation")).not.toBeInTheDocument();
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
