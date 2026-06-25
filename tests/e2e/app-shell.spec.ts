import { expect, test } from "@playwright/test";

test("renders the Epic 2 mobile shell and Cards tab", async ({ page }) => {
  await page.goto("/");

  const mobilePreview = page.getByLabel("Mobile application preview");

  await expect(mobilePreview).toBeVisible();
  await expect(mobilePreview.getByText("68%", { exact: true })).toBeVisible();
  await expect(mobilePreview.getByRole("button", { name: /Review 7 imported rows/i })).toBeVisible();

  await mobilePreview.getByRole("button", { name: /Cards/i }).click();

  await expect(mobilePreview.getByRole("heading", { name: /72,000 redeemable miles/i })).toBeVisible();
  await expect(mobilePreview.getByText("$430 eligible spend")).toBeVisible();
});

test("renders the Epic 2 desktop review dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByLabel("Desktop workspace preview")).toBeVisible();
  await expect(page.getByRole("table", { name: "Imported transaction review" })).toBeVisible();
  await expect(page.getByText("Matched refund")).toBeVisible();
  await expect(page.getByText("Baseline FI at age 41.")).toBeVisible();
  await expect(page.getByText("Scenario comparison")).toBeVisible();
});

test("renders the Epic 3 plan scenario comparison", async ({ page }) => {
  await page.goto("/");

  const mobilePreview = page.getByLabel("Mobile application preview");
  await mobilePreview.getByRole("button", { name: /Plan/i }).click();

  await expect(mobilePreview.getByRole("heading", { name: /FI paths/i })).toBeVisible();
  await expect(mobilePreview.getByText("Baseline")).toBeVisible();
  await expect(mobilePreview.getByText("Optimistic")).toBeVisible();
  await expect(mobilePreview.getByText("Conservative")).toBeVisible();
});
