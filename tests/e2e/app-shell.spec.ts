import { expect, test } from "@playwright/test";

test("renders the FP-2 mobile shell and bottom tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /FIRE and miles/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Cards" })).toBeVisible();

  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Cards" }).click();

  await expect(page.getByRole("heading", { name: "Miles runway" })).toBeVisible();
  await expect(page.getByLabel("Miles summary").getByText("48,000 mi")).toBeVisible();
});

test("renders the FP-2 desktop dashboard without duplicate diagnostic cards", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Command center" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /FI at 45/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /3 items need confirmation/i })).toBeVisible();
  await expect(page.getByText(/Matched merchant text/i)).toBeVisible();
  await expect(page.getByLabel("Insights")).toBeVisible();
});
