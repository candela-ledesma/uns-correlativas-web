import { test, expect } from "@playwright/test";

test("la página carga correctamente", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/correlativas|plan|uns/i);
});