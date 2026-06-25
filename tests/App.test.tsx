import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useAppShellStore } from "../src/state/appShellStore";
import { App } from "../src/ui/App";

describe("Epic 2 app shell", () => {
  beforeEach(() => {
    useAppShellStore.setState({ activeSurface: "home", activeTab: "home" });
  });

  it("renders the mobile Home landing page without a duplicate Fire Progress card", () => {
    render(<App />);

    const mobilePreview = screen.getByLabelText("Mobile application preview");

    expect(within(mobilePreview).getByText("68%")).toBeInTheDocument();
    expect(within(mobilePreview).getByText("Target corpus")).toBeInTheDocument();
    expect(within(mobilePreview).getByText(/Estimated FI year/i)).toBeInTheDocument();
    expect(within(mobilePreview).getByRole("button", { name: /review 7 imported rows/i }));
    expect(within(mobilePreview).queryByText("Fire Progress card")).not.toBeInTheDocument();
  });

  it("switches to the mobile Cards tab and shows redeemable miles hierarchy", async () => {
    render(<App />);

    const mobileTabs = screen.getByLabelText("Mobile tabs");
    await userEvent.click(within(mobileTabs).getByRole("button", { name: /cards/i }));

    const mobilePreview = screen.getByLabelText("Mobile application preview");

    expect(
      within(mobilePreview).getByRole("heading", { name: /72,000 redeemable miles/i }),
    ).toBeInTheDocument();
    expect(within(mobilePreview).getByText("$430 eligible spend")).toBeInTheDocument();
    expect(within(mobilePreview).getByText(/Apple Refund/i)).toBeInTheDocument();
  });

  it("renders the desktop dashboard with inline review diagnostics", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Mobile Home" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Imported transaction review" })).toBeInTheDocument();
    expect(screen.getByText("Matched refund")).toBeInTheDocument();
    expect(screen.getByText("FI impact")).toBeInTheDocument();
    expect(screen.getByText("Scenario comparison")).toBeInTheDocument();
    expect(screen.getByText(/Baseline: FI age 41/i)).toBeInTheDocument();
    expect(screen.queryByText("MCC confidence")).not.toBeInTheDocument();
  });

  it("shows scenario comparison in the Plan tab", async () => {
    render(<App />);

    const mobileTabs = screen.getByLabelText("Mobile tabs");
    await userEvent.click(within(mobileTabs).getByRole("button", { name: /plan/i }));

    const mobilePreview = screen.getByLabelText("Mobile application preview");

    expect(within(mobilePreview).getByRole("heading", { name: /FI paths/i })).toBeInTheDocument();
    expect(within(mobilePreview).getByText("Baseline")).toBeInTheDocument();
    expect(within(mobilePreview).getByText("Optimistic")).toBeInTheDocument();
    expect(within(mobilePreview).getByText("Conservative")).toBeInTheDocument();
  });

  it("switches desktop preview surfaces", async () => {
    render(<App />);

    const desktopNav = screen.getByLabelText("Workspace sections");
    await userEvent.click(within(desktopNav).getByRole("button", { name: "Desktop Dashboard" }));

    expect(screen.getByRole("heading", { name: "Desktop Dashboard" })).toBeInTheDocument();
  });
});
