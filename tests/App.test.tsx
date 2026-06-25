import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/ui/App";

describe("App shell", () => {
  it("renders the implementation foundation status", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /local-first planning/i })).toBeInTheDocument();
    expect(screen.getByText("FP-1")).toBeInTheDocument();
    expect(screen.getByText("FP-1.1")).toBeInTheDocument();
  });

  it("switches between planned product surfaces", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "cards" }));

    expect(screen.getByRole("heading", { name: "Cards And Miles" })).toBeInTheDocument();
    expect(screen.getByText(/redeemable miles/i)).toBeInTheDocument();
  });
});
