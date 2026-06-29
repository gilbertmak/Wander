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

  await desktop.getByRole("button", { name: "Apply latest import" }).click();
  await expect(desktop.getByRole("button", { name: "Planner updated" })).toBeVisible();

  await desktop.getByRole("button", { name: "Why this?" }).first().click();
  await expect(page.getByLabel("Why this explanation")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel("Why this explanation")).toBeHidden();

  await desktop.getByLabel("Workspace sections").getByRole("button", { name: "Planner" }).click();
  await expect(desktop.getByRole("heading", { name: "Current month applied" })).toBeVisible();
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
  await expect(desktop.getByRole("heading", { name: "Wander Guide" })).toBeVisible();
  await expect(desktop.getByRole("heading", { name: "Your timeline" })).toBeVisible();

  await page.getByLabel("Current age").fill("36");
  await page.getByLabel("Target retirement age").fill("45");
  await page.getByLabel("Planning age").fill("90");
  await desktop.getByRole("button", { name: "Continue" }).click();

  await expect(desktop.getByRole("heading", { name: "Your FIRE life" })).toBeVisible();
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
