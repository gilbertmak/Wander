import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/ui/App";

describe("App shell", () => {
  it("renders the mobile Home surface", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /FIRE and miles/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "49%" })).toBeInTheDocument();
    expect(screen.getByText(/Confirm May expense snapshot/i)).toBeInTheDocument();
  });

  it("switches between mobile tabs", async () => {
    render(<App />);

    for (const tab of ["Home", "Plan", "Transactions", "Cards", "Profile"]) {
      expect(screen.getByRole("button", { name: tab })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole("button", { name: "Cards" }));

    expect(screen.getByRole("heading", { name: "Miles runway" })).toBeInTheDocument();
    expect(screen.getByText("48,000 mi")).toBeInTheDocument();
    expect(screen.getByText(/S\$50 to next 5,000-point block/i)).toBeInTheDocument();
  });
});
