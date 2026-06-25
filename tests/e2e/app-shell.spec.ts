import { expect, test } from "@playwright/test";

test("renders the FP-2 mobile shell and bottom tabs", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /FIRE and miles/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();

  await page.getByRole("button", { name: "Cards" }).click();

  await expect(page.getByRole("heading", { name: "Miles runway" })).toBeVisible();
  await expect(page.getByText("48,000 mi")).toBeVisible();
});
