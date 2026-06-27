import { expect, test } from "@playwright/test";

test("desktop dashboard renders and primary buttons change state", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 920 });
  await page.goto("/");

  const desktop = page.getByLabel("Wander desktop app");

  await expect(desktop.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(desktop.getByRole("table", { name: "Imported transaction review" })).toBeVisible();
  await expect(desktop.getByText("FI impact")).toBeVisible();

  await desktop.getByRole("button", { name: "Apply to planner" }).first().click();
  await expect(desktop.getByRole("button", { name: "Applied" })).toBeVisible();

  await desktop.getByRole("button", { name: "Why this?" }).first().click();
  await expect(page.getByLabel("Why this explanation")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel("Why this explanation")).toBeHidden();

  await desktop.getByLabel("Workspace sections").getByRole("button", { name: "Planner" }).click();
  await expect(desktop.getByRole("heading", { name: "Current month applied" })).toBeVisible();
});

test("mobile shell renders landing page and switches to cards", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const mobile = page.getByLabel("Wander mobile app");

  await expect(
    mobile.getByRole("heading", { name: /68% to financial independence/i }),
  ).toBeVisible();
  await expect(mobile.getByText("Review 7 imported rows")).toBeVisible();

  await mobile.getByRole("button", { name: /Cards/i }).click();

  await expect(mobile.getByText("72,000 miles")).toBeVisible();
  await expect(mobile.getByText(/Best card now: Citi Rewards/i)).toBeVisible();
});
