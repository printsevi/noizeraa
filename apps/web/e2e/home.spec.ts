import { expect, test } from "@playwright/test";

// Placeholder smoke test — the real Playwright coverage per tech
// proposal §1/§12 targets the listener flow (/l/[token]) once it
// exists. This just proves the CI e2e job and webServer wiring work.
test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Noizera" })).toBeVisible();
});
