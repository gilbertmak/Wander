import { expect, test } from "@playwright/test";

test("renders the FP-2 mobile shell and bottom tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /FIRE and miles/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest import mostly verified" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Home" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Cards" }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("button", { name: "Cards" })
    .click();

  await expect(page.getByRole("heading", { name: "Miles runway" })).toBeVisible();
  await expect(page.getByLabel("Miles summary").getByText("48,000 mi")).toBeVisible();
  await expect(page.getByLabel("Miles leakage monitor")).toBeVisible();
});

test("renders the FP-2 desktop dashboard without duplicate diagnostic cards", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Command center" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /FI at 45/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /3 items need confirmation/i })).toBeVisible();
  await expect(page.getByText(/Matched merchant text/i)).toBeVisible();
  await expect(page.getByText("Needs review")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confirm merchant" })).toBeVisible();
  await expect(
    page.getByLabel("Confirm merchant actions").getByRole("button", { name: "Ignore" }),
  ).toBeVisible();
  await expect(page.getByLabel("Refund tracker timeline")).toBeVisible();
  await expect(page.getByRole("heading", { name: /annual expenses \+S\$6,000/i })).toBeVisible();
  await expect(page.getByLabel("Insights")).toBeVisible();

  await page.getByLabel("Correction").selectOption("mcc");
  await page.getByLabel("New value").fill("4900");
  await page.getByRole("button", { name: "Save correction" }).click();

  await expect(page.getByText(/Saved mcc correction/i)).toBeVisible();
test("renders the Epic 2 mobile shell and Cards tab", async ({ page }) => {
  await page.goto("/");

  const mobilePreview = page.getByLabel("Mobile application preview");

  await expect(mobilePreview).toBeVisible();
  await expect(mobilePreview.getByText("68%")).toBeVisible();
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
  await expect(page.getByText("Expense snapshot lowers FI date by 3 months.")).toBeVisible();
});
