import { expect, test } from "@playwright/test";

test("desktop dashboard renders and primary buttons change state", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 920 });
  await page.goto("/");

  const desktop = page.getByLabel("Wander desktop app");

  await expect(desktop.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(desktop.getByRole("table", { name: "Imported transaction review" })).toBeVisible();
  await expect(desktop.getByText("FIRE command centre")).toBeVisible();
  await expect(desktop.getByLabel("FIRE command cards")).toBeVisible();
  await expect(desktop.getByText("Advisor action")).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Apply latest import" })).toHaveCount(0);
  await expect(desktop.getByRole("button", { name: "Why this plan?" })).toHaveCount(0);

  await expect(desktop.getByRole("button", { name: "Confirm" }).first()).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Match refund" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(desktop.getByRole("columnheader", { name: "Issue" })).toHaveCount(0);
  await expect(desktop.getByLabel("Shopee SG category")).toBeVisible();
  await expect(desktop.getByLabel("Why this needs review")).toBeVisible();
  await expect(desktop.getByLabel("Search merchant, note, card, MCC, or refund")).toBeVisible();

  await desktop.getByLabel("Workspace sections").getByRole("button", { name: "Planner" }).click();
  await expect(
    desktop.getByRole("heading", { name: "Waiting for selected changes" }),
  ).toBeVisible();
  await expect(desktop.getByLabel("Scenario stress testing")).toBeVisible();

  await desktop.getByLabel("Workspace sections").getByRole("button", { name: "Reports" }).click();
  await expect(desktop.getByRole("heading", { name: "FIRE journey report" })).toBeVisible();
  await expect(desktop.getByLabel("FIRE trajectory chart")).toBeVisible();
});

test("desktop setup opens Wander Guide onboarding", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 920 });
  await page.goto("/");

  const desktop = page.getByLabel("Wander desktop app");

  await desktop.getByRole("button", { name: "Start guided setup" }).click();
  const modal = page.getByRole("dialog", { name: "Wander Guide" });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("heading", { name: "Wander Guide" })).toBeVisible();
  await expect(modal.getByRole("heading", { name: "Your life" })).toBeVisible();
  await expect(modal.getByText("0/12 required")).toHaveCount(0);

  await page.getByLabel("Current age").fill("36");
  await page.getByLabel("Target retirement age").fill("45");
  await page.getByLabel("Expected monthly retirement spend").fill("6000");
  await modal.getByRole("button", { name: "Continue" }).click();

  await expect(modal.getByRole("heading", { name: "Your money today" })).toBeVisible();
  await modal.getByRole("button", { name: "Back" }).click();
  await expect(modal.getByRole("heading", { name: "Your life" })).toBeVisible();
});

test("mobile shell renders landing page and switches to cards", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const mobile = page.getByLabel("Wander mobile app");

  await expect(
    mobile.getByRole("heading", { name: /89% to financial independence/i }),
  ).toBeVisible();
  await expect(mobile.getByText("Goal funding gap")).toBeVisible();

  await mobile.getByRole("button", { name: /Cards/i }).click();

  await expect(mobile.getByText("72,000 miles")).toBeVisible();
  await expect(mobile.getByText(/Best card now: Citi Rewards/i)).toBeVisible();
});
