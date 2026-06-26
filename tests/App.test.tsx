import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useAppShellStore } from "../src/state/appShellStore";
import { App } from "../src/ui/App";

describe("App shell", () => {
  it("renders the mobile Home surface", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /FIRE and miles/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "49%" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Latest import mostly verified" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Confirm May expense snapshot/i)).toBeInTheDocument();
  });

  it("switches between mobile tabs", async () => {
describe("Epic 2 app shell", () => {
  beforeEach(() => {
    useAppShellStore.setState({ activeSurface: "home", activeTab: "home" });
  });

  it("renders the mobile Home landing page without a duplicate Fire Progress card", () => {
    render(<App />);

    const mobilePreview = screen.getByLabelText("Mobile application preview");

    expect(within(mobilePreview).getByText("68%")).toBeInTheDocument();
    expect(within(mobilePreview).getByText("Target corpus")).toBeInTheDocument();
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
    expect(screen.queryByText("MCC confidence")).not.toBeInTheDocument();
  });

  it("switches desktop preview surfaces", async () => {
    render(<App />);
    const mobileNav = screen.getByRole("navigation", { name: "Primary" });

    for (const tab of ["Home", "Plan", "Transactions", "Cards", "Profile"]) {
      expect(within(mobileNav).getByRole("button", { name: tab })).toBeInTheDocument();
    }

    await userEvent.click(within(mobileNav).getByRole("button", { name: "Cards" }));

    expect(screen.getByRole("heading", { name: "Miles runway" })).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Miles summary")).getByText("48,000 mi"),
    ).toBeInTheDocument();
    expect(screen.getByText(/S\$50 to next 5,000-point block/i)).toBeInTheDocument();
  });

  it("renders the desktop dashboard sections", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Command center" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /3 items need confirmation/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Insights")).toBeInTheDocument();
    expect(screen.getByText(/Matched merchant text/i)).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /annual expenses \+S\$6,000/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Monthly net spend")).toBeInTheDocument();
  });

  it("saves a desktop correction and reports recalculation triggers", async () => {
    render(<App />);

    await userEvent.selectOptions(screen.getByLabelText("Correction"), "mcc");
    await userEvent.clear(screen.getByLabelText("New value"));
    await userEvent.type(screen.getByLabelText("New value"), "4900");
    await userEvent.click(screen.getByRole("button", { name: "Save correction" }));

    expect(screen.getByText(/Saved mcc correction/i)).toBeInTheDocument();
    expect(screen.getByText(/mcc_corrected, miles_eligibility_changed/i)).toBeInTheDocument();
    const desktopNav = screen.getByLabelText("Workspace sections");
    await userEvent.click(within(desktopNav).getByRole("button", { name: "Desktop Dashboard" }));

    expect(screen.getByRole("heading", { name: "Desktop Dashboard" })).toBeInTheDocument();
  });
});
