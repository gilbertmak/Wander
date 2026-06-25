import { expect, test } from "@playwright/test";

test("renders the FP-1.1 app shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /local-first planning/i })).toBeVisible();
  await expect(page.getByText("FP-1.1")).toBeVisible();
});
